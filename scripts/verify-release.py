"""Verify a fresh release extraction without using local accounts or secrets."""
from pathlib import Path
import http.cookiejar, json, os, re, subprocess, tempfile, time, urllib.request, zipfile
ROOT=Path(__file__).resolve().parents[1]
version=json.loads((ROOT/'package.json').read_text())['version']
output=ROOT/'releases'/('v'+version)
archive=output/('TaDa-v'+version+'.zip')
with tempfile.TemporaryDirectory(prefix='verify-',dir=output) as temporary:
    temporary=Path(temporary).resolve()
    assert temporary.is_relative_to(output.resolve()), 'Validation directory must stay in release workspace'
    with zipfile.ZipFile(archive) as z:
        for name in z.namelist(): assert (temporary/name).resolve().is_relative_to(temporary)
        z.extractall(temporary)
    app=temporary/('TaDa-v'+version)
    assert not (app/'.env').exists() and not (app/'data').exists()
    npm='npm.cmd' if os.name=='nt' else 'npm'
    for command in [[npm,'ci'],[npm,'test'],[npm,'run','build']]:
        result=subprocess.run(command,cwd=app,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
        if result.returncode: raise RuntimeError('Clean extraction check failed:\n'+result.stdout)
        print('Passed: '+' '.join(command),flush=True)
    env=dict(os.environ,PORT='3197',APP_ORIGIN='http://localhost:3197',DATA_DIR=str(temporary/'smoke-data'))
    for key in ['VAPID_PUBLIC_KEY','VAPID_PRIVATE_KEY','VAPID_SUBJECT']:env.pop(key,None)
    process=subprocess.Popen(['node','server/index.js'],cwd=app,env=env,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    try:
        for i in range(60):
            try:
                html=urllib.request.urlopen('http://localhost:3197').read().decode();break
            except Exception:
                if process.poll() is not None:raise RuntimeError('Extracted server exited early')
                time.sleep(.1)
        else:raise RuntimeError('Extracted server did not start')
        asset=re.search(r'src="(/assets/[^\"]+)"',html).group(1)
        assert urllib.request.urlopen('http://localhost:3197'+asset).status==200
        opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
        body=json.dumps({'name':'Release validation','email':'release@example.com','password':'release-secure-password','confirmPassword':'release-secure-password'}).encode()
        request=urllib.request.Request('http://localhost:3197/api/auth/register',data=body,headers={'Content-Type':'application/json','Origin':'http://localhost:3197'})
        assert opener.open(request).status==200
        state=json.loads(opener.open('http://localhost:3197/api/state').read())
        assert state['user']['name']=='Release validation' and len(state['lists'])==3
        print('Passed: extracted server, production web assets, signup and persisted state',flush=True)
    finally:
        process.terminate();process.wait(timeout=10)
print('Fresh extraction verification passed; temporary validation data removed.')
