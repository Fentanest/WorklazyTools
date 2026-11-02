from pathlib import Path
from PIL import Image,ImageChops
import json,re,base64,math,subprocess,os
out=Path(os.environ.get('IEF_OUTPUT','.ief'));p=out/'exports';manifest=json.loads(Path(os.environ.get('IEF_MANIFEST','tests/fixtures/redaction-export/scenes.json')).read_text());rows=[]
for scene in manifest['scenes']:
 name=scene['id'];ref=Image.open(p/f'{name}.reference.png').convert('RGBA')
 js=json.loads((p/f'{name}.json').read_text());tp=json.loads((p/f'{name}.template.json').read_text())
 svg=(p/f'{name}.svg').read_text();src=re.search(r'(data:image/png;base64,[A-Za-z0-9+/=]+)',svg)[1]
 for kind,data in [('svg',src),('json',js['objects'][0]['src']),('template',tp['snapshot']['json']['objects'][0]['src'])]:
  (p/f'{name}.{kind}-base.png').write_bytes(base64.b64decode(data.split(',',1)[1]))
 pdfLossless=b'/DCTDecode' not in (p/f'{name}.pdf').read_bytes()
 for extracted in p.glob(f'{name}.pdfimage-*.png'):extracted.unlink()
 subprocess.run(['pdfimages','-png',str(p/f'{name}.pdf'),str(p/f'{name}.pdfimage')],check=True,stdout=subprocess.DEVNULL)
 pdf=Image.open(p/f'{name}.pdfimage-000.png').convert('RGBA');mask=p/f'{name}.pdfimage-001.png'
 if mask.exists():pdf.putalpha(Image.open(mask).convert('L'))
 pdf.save(p/f'{name}.pdf-rgba.png')
 for fmt,fn in [('png',f'{name}.png'),('jpeg',f'{name}.jpeg'),('webp',f'{name}.webp'),('pdf',f'{name}.pdf-rgba.png'),('svg',f'{name}.svg-base.png'),('json',f'{name}.json-base.png'),('template',f'{name}.template-base.png')]:
  arr=Image.open(p/fn).convert('RGBA');diff=ImageChops.difference(arr,ref);channels=diff.split();maxper=channels[0]
  for channel in channels[1:]: maxper=ImageChops.lighter(maxper,channel)
  hist=maxper.histogram();fraction=sum(hist[:2])/(arr.width*arr.height);maxdiff=max(i for i,n in enumerate(hist) if n);mse=sum(i*i*n for c in channels[:3] for i,n in enumerate(c.histogram()))/(arr.width*arr.height*3);psnr=10*math.log10(255**2/mse) if mse else None
  row={'scene':name,'format':fmt,'dimensions':list(arr.size),'fractionChannelDeltaLE1':fraction,'maxChannelDelta':maxdiff,'PSNRdB':psnr}
  lossless=fmt in ['png','svg','json','template'] or (fmt=='pdf' and pdfLossless)
  if not lossless:
   # PSNR is an RGB display metric: composite both RGBA images onto the same white matte.
   def opaque(image):
    matte=Image.new('RGBA', image.size, 'white');return Image.alpha_composite(matte,image).convert('RGB')
   cd=ImageChops.difference(opaque(arr),opaque(ref));cmse=sum(i*i*n for c in cd.split() for i,n in enumerate(c.histogram()))/(arr.width*arr.height*3)
   row['rawUnassociatedRGBPSNRdB']=psnr;psnr=10*math.log10(255**2/cmse) if cmse else None;row['PSNRdB']=psnr;row['PSNRMatte']='white'
  row['a_pass']=bool((fraction>=.9999 and maxdiff<=8) if lossless else (psnr is None or psnr>=38))
  if scene['mode']=='solid':
   r=manifest['region'];sample=arr.crop((r['left']+2,r['top']+2,r['left']+r['width']-2,r['top']+r['height']-2)).convert('RGB');sd=ImageChops.difference(sample,Image.new('RGB',sample.size,(11,15,26)));ch=sd.split();mx=ImageChops.lighter(ImageChops.lighter(ch[0],ch[1]),ch[2]);sh=mx.histogram();fraction6=sum(sh[:7])/(sample.width*sample.height);solidmax=max(i for i,n in enumerate(sh) if n)
   row['solid']={'fractionDeltaLE6':fraction6,'maxDelta':solidmax}
   row['b_pass']=bool(solidmax==0 if lossless else (fraction6>=.995 and solidmax<=16))
  rows.append(row)
(out/'raw/pixel-metrics.json').write_text(json.dumps(rows,indent=2)+'\n')
print(json.dumps({'rows':len(rows),'aFailures':[r for r in rows if not r['a_pass']],'bFailures':[r for r in rows if not r.get('b_pass',True)],'lossyMinimumPSNRdB':min(r['PSNRdB'] for r in rows if r['format'] in ['jpeg','webp','pdf'] and r['PSNRdB'] is not None)},indent=2))
assert all(r['a_pass'] and r.get('b_pass',True) for r in rows)
