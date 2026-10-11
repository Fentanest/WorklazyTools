"""Incremental quota-bound GET collection; no credential URLs or bodies in logs."""
import argparse,collections,fcntl,hashlib,io,json,os,signal,time,zipfile
from pathlib import Path
from datetime import datetime,timezone
import requests
HERE=Path(__file__).resolve().parent;REPO=HERE.parents[2];STOP=False
ENDPOINT='https://opendart.fss.or.kr/api/document.xml'
def stamp():return datetime.now(timezone.utc).isoformat()
def append(p,r):
 with p.open('a') as f:f.write(json.dumps(r,ensure_ascii=False)+'\n');f.flush()
def atomic(p,r):
 t=p.with_suffix('.tmp');t.write_text(json.dumps(r,ensure_ascii=False,indent=2));t.replace(p)
def load(p):return [json.loads(l) for l in p.open()] if p.exists() else []
def keys():
 found={}
 for l in (REPO/'.env').read_text().splitlines():
  if '=' in l:
   k,v=l.split('=',1)
   if k.strip() in ['DART_API_KEY1','DART_API_KEY2']:found[k.strip()]=v.strip().strip('\"\'')
 for k in ['DART_API_KEY1','DART_API_KEY2']:
  if os.environ.get(k):found[k]=os.environ[k]
 if len(found)!=2 or any(len(v)!=40 for v in found.values()):raise RuntimeError('two valid format DART credentials required')
 if len(set(found.values()))!=2:raise RuntimeError('keys are identical; cannot double quota')
 return found
def stop(*args):
 global STOP;STOP=True

def main():
 global STOP
 ap=argparse.ArgumentParser();ap.add_argument('--interval',type=float,default=3);ap.add_argument('--max-per-key',type=int,default=20000);ap.add_argument('--limit',type=int);ap.add_argument('--defer-parse',action='store_true');ap.add_argument('--max-per-minute',type=int,default=800);args=ap.parse_args()
 if args.interval<0 or args.max_per_minute<1 or args.max_per_minute>800:ap.error('combined request limit must be 1..800 per minute')
 lock=(HERE/'download.lock').open('a');fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
 signal.signal(signal.SIGTERM,stop);signal.signal(signal.SIGINT,stop)
 credential=keys();manifest=json.loads((HERE/'manifest.json').read_text());manifest['keys_distinct_checked']=True;atomic(HERE/'manifest.json',manifest)
 previous=load(HERE/'api-requests.jsonl');reservations=load(HERE/'api-reservations.jsonl')
 identity=lambda r:(r['key_slot'],r['rcept_no'],r.get('started_at'))
 attempts_by_identity={identity(r):r for r in reservations+previous}
 attempts=collections.Counter(r['key_slot'] for r in attempts_by_identity.values())
 completed_attempts={identity(r) for r in previous}
 unknown_reservations=[r for r in reservations if identity(r) not in completed_attempts]
 # Unknown outcomes consume quota and are never automatically sent again.
 # Confirmed maintenance responses remain pending; their calls still count
 # against quota. Unknown reservations and other outcomes are not replayed.
 maintenance={identity(r) for r in previous if str(r.get('api_status'))=='800' and r.get('status')==200 and r.get('zip_received') is False}
 zip_done={r['rcept_no']:r for r in previous if r.get('zip_received')};consumed={r['rcept_no'] for r in attempts_by_identity.values() if identity(r) not in maintenance}
 queue=load(HERE/'api-queue.jsonl');disabled={r['key_slot']:r.get('api_status') for r in previous if r.get('api_status') in ['020','010','011','012','901']}
 corpus_done={r['rcept_no'] for r in load(HERE/'corpus.jsonl')};session=requests.Session();last=0;newgets=0;errors=0
 recent_starts=collections.deque();clock_now=time.monotonic();utc_now=datetime.now(timezone.utc)
 for r in attempts_by_identity.values():
  if r.get('started_at'):
   age=(utc_now-datetime.fromisoformat(r['started_at'])).total_seconds()
   if 0<=age<60:recent_starts.append(clock_now-age)
 recent_starts=collections.deque(sorted(recent_starts));corpus_refresh=0
 atomic(HERE/'download-worker.json',dict(pid=os.getpid(),started_at=stamp(),interval=args.interval,maximum_per_key=args.max_per_key,mode='official_api_get',source_body_preserved=True,deferred_parse=args.defer_parse,combined_maximum_per_minute=args.max_per_minute))
 def progress():
  nonlocal corpus_done,corpus_refresh
  if time.monotonic()-corpus_refresh>=10:
   corpus_done={r['rcept_no'] for r in load(HERE/'corpus.jsonl')};corpus_refresh=time.monotonic()
  atomic(HERE/'download-progress.json',dict(at=stamp(),pid=os.getpid(),request_counts=dict(attempts),downloaded_api_receipts=len(zip_done),corpus_ready_receipts=len(corpus_done),unknown_reserved_requests=len(unknown_reservations),disabled_keys=disabled,transport_failures=errors,requests_this_run=newgets,stopped=STOP,quota_reset_retry=False,interval=args.interval,combined_maximum_per_minute=args.max_per_minute,deferred_parse=args.defer_parse))
 for row in queue:
  if STOP:break
  rid=row['rcept_no'];slot=row['key_slot']
  if rid in consumed:continue
  if slot in disabled or attempts[slot]>=args.max_per_key:
   available=[k for k in credential if k not in disabled and attempts[k]<args.max_per_key]
   if not available:break
   slot=min(available,key=lambda k:attempts[k])
  if args.limit and newgets>=args.limit:break
  moment=time.monotonic()
  while recent_starts and moment-recent_starts[0]>=60:recent_starts.popleft()
  wait=max(0,args.interval-(moment-last))
  if len(recent_starts)>=args.max_per_minute:wait=max(wait,60-(moment-recent_starts[0])+0.001)
  time.sleep(wait)
  if STOP:break
  last=time.monotonic();recent_starts.append(last);start=stamp();attempts[slot]+=1;newgets+=1
  # Reservation records prevent double spending if a process dies during GET.
  reservation=dict(rcept_no=rid,key_slot=slot,started_at=start,attempt_number=attempts[slot],endpoint=ENDPOINT,method='GET')
  append(HERE/'api-reservations.jsonl',reservation)
  try:
   response=session.get(ENDPOINT,params={'crtfc_key':credential[slot],'rcept_no':rid},timeout=(10,35))
   raw=response.content;ok=response.status_code==200 and zipfile.is_zipfile(io.BytesIO(raw));status=None
   if not ok:
    import re
    m=re.search(rb'<status>\s*([^<]+)',raw);status=m[1].decode(errors='replace') if m else 'NON_ZIP'
   result=reservation|dict(ended_at=stamp(),status=response.status_code,api_status=status,zip_received=ok,bytes=len(raw),sha256=hashlib.sha256(raw).hexdigest())
   if ok:
    target=HERE/'api-zips'/f'{rid}.zip';target.parent.mkdir(exist_ok=True);target.write_bytes(raw);result['zip_path']=str(target.relative_to(REPO));zip_done[rid]=result
   else:
    append(HERE/'download-failures.jsonl',result)
    if status in ['020','010','011','012','901']:disabled[slot]=status
    if response.status_code in [429,403] or status in ['800','900','101']:
     STOP=True
   append(HERE/'api-requests.jsonl',result);consumed.add(rid)
   if ok and args.defer_parse:
    print(json.dumps({'downloaded_for_parser':rid,'key_slot':slot},ensure_ascii=False),flush=True)
   elif ok:
    # Store the whole receipt first; parser failure never deletes the ZIP.
    try:
     from source_extract import extract_api_zip
     ev=extract_api_zip(target,row,HERE);append(HERE/'corpus.jsonl',ev);corpus_done.add(rid)
     print(json.dumps({'download_and_enqueue':rid,'corpus_ready':len(corpus_done),'key_slot':slot},ensure_ascii=False),flush=True)
    except Exception as e:append(HERE/'parse-failures.jsonl',dict(rcept_no=rid,error=type(e).__name__,at=stamp(),zip_path=result['zip_path']))
   else:print(json.dumps({'api_status':status,'key_slot':slot,'rcept_no':rid},ensure_ascii=False),flush=True)
  except (requests.RequestException,OSError) as e:
   # Requests exceptions contain authenticated URLs: record type only.
   errors+=1;result=reservation|dict(ended_at=stamp(),error=type(e).__name__,submission_outcome='unknown',zip_received=False)
   append(HERE/'api-requests.jsonl',result);append(HERE/'download-failures.jsonl',result);consumed.add(rid)
   if errors>=3:STOP=True
  progress()
 progress();print(json.dumps({'download_run_finished':True,'stopped':STOP,'requests':dict(attempts),'zip_receipts':len(zip_done),'disabled':disabled}),flush=True)
if __name__=='__main__':main()
