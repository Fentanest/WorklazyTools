import os, subprocess, json
from pathlib import Path
root=Path('/tmp/worklazytools-pqa-fix')
checks=[('build-production','build',{}),('static','test:static',{}),('excel-smoke','test:browser',{'TEST_SCOPE':'excel'}),('hwp-smoke','test:new-tools',{'TEST_ONLY_HWP':'1'}),('utilities','test:utilities',{}),('xls-preserve','test:xls-preserve',{}),('xls-first-load','test:xls-first-load',{})]
results=[]
for name,script,extra in checks:
    env={**os.environ,'TEST_BASE_URL':'http://127.0.0.1:4291',**extra}
    env.pop('VITE_LOCAL_QA',None)
    with (root/f'{name}.log').open('w') as log:
        code=subprocess.run(['npm','run',script],env=env,stdout=log,stderr=subprocess.STDOUT).returncode
    result={'name':name,'command':'npm run '+script,'env':extra,'exitCode':code}
    results.append(result)
    (root/'production-results.json').write_text(json.dumps(results,indent=2)+'\n')
    print(json.dumps(result),flush=True)
    if name=='build-production' and code: break
raise SystemExit(1 if any(r['exitCode'] for r in results) else 0)
