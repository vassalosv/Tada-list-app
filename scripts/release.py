"""Create a release from an explicit payload list, without local user data."""
from pathlib import Path
import hashlib, io, json, re, sqlite3, shutil, zipfile
from datetime import date

ROOT = Path(__file__).resolve().parents[1]
VERSION = json.loads((ROOT/'package.json').read_text(encoding='utf-8'))['version']
NAME = 'TaDa-v'+VERSION
OUT = ROOT/'releases'/('v'+VERSION)
OUT.mkdir(parents=True, exist_ok=True)
ROOT_FILES = ['package.json','package-lock.json','index.html','vite.config.js','capacitor.config.ts','Dockerfile','compose.yaml','.env.example','.gitignore','.dockerignore','README.md','QUICK_START.md','RELEASE_NOTES.md','UPGRADE_v0.1.2.md','UPGRADE_v0.2.0.md']
PAYLOAD = {name:(ROOT/name).read_bytes() for name in ROOT_FILES}
for directory in ['src','server','shared','public','scripts','tests','dist','android']:
    for path in sorted((ROOT/directory).rglob('*')):
        rel=path.relative_to(ROOT)
        if not path.is_file() or path.is_symlink(): continue
        if any(p in {'build','.gradle','.idea','node_modules','data','screenshots','__pycache__'} for p in rel.parts): continue
        if path.name in {'local.properties','google-services.json','.env','.DS_Store'}: continue
        if path.suffix.lower() in {'.log','.sqlite','.db','.jks','.keystore','.pyc','.apk','.aab'}: continue
        PAYLOAD[rel.as_posix()]=path.read_bytes()
# Preserve the applicable notices delivered with installed npm dependencies.
notices=['TaDa '+VERSION+' — npm dependency notices\n\nThis file includes license/notice files supplied with installed npm packages.\n']
lock=json.loads((ROOT/'package-lock.json').read_text(encoding='utf-8'))
for location, metadata in sorted(lock['packages'].items()):
    if not location: continue
    folder=ROOT/location
    if not folder.is_dir(): continue
    files=[p for p in sorted(folder.iterdir()) if p.is_file() and re.match(r'^(licen[sc]e|notice|copying|ofl)([.\-_]|$)',p.name,re.I)]
    notices.append('\n'+'='*72+'\n'+location+' @ '+metadata.get('version','')+'\nLicense: '+str(metadata.get('license','See package notices'))+'\n')
    for path in files:
        notices.append('\n'+path.name+'\n'+path.read_text(encoding='utf-8',errors='replace')+'\n')
PAYLOAD['THIRD_PARTY_NOTICES.txt']=''.join(notices).encode()
apk=ROOT/'android/app/build/outputs/apk/debug/app-debug.apk'
meta=json.loads((apk.parent/'output-metadata.json').read_text(encoding='utf-8'))
assert meta['elements'][0]['versionName']==VERSION, 'APK version mismatch'
assert 'server' not in json.loads((ROOT/'android/app/src/main/assets/capacitor.config.json').read_text()), 'Build the unconfigured preview before packaging'
apk_name=NAME+'-android-debug.apk'
PAYLOAD['artifacts/'+apk_name]=apk.read_bytes()
# Check every payload file against this installation's private values. Nothing
# from this scan is written to the release or printed to command output.
secrets=[]
if (ROOT/'.env').exists():
    for line in (ROOT/'.env').read_text(encoding='utf-8').splitlines():
        if line.startswith('VAPID_PRIVATE_KEY='):
            secrets.append(line.split('=',1)[1].strip().strip('\"\x27').encode())
if (ROOT/'data/tada.sqlite').exists():
    db=sqlite3.connect((ROOT/'data/tada.sqlite').as_uri()+'?mode=ro',uri=True)
    for email,password in db.execute('SELECT email,password FROM users'):
        if not email.endswith('@example.com') and not email.endswith('@identity.invalid'): secrets.append(email.encode())
        if password: secrets.append(password.encode())
    db.close()
def check_private(name, content):
    for secret in secrets:
        if secret and secret in content: raise RuntimeError('Private installation value detected in '+name)
for name,content in PAYLOAD.items():
    check_private(name,content)
    if name.endswith('.apk'):
        with zipfile.ZipFile(io.BytesIO(content)) as nested:
            for item in nested.infolist(): check_private(name+':'+item.filename,nested.read(item))
manifest={'product':'TaDa','version':VERSION,'releaseDate':date.today().isoformat(),'androidVariant':'debug; HTTPS backend selected on device','files':{name:{'bytes':len(content),'sha256':hashlib.sha256(content).hexdigest()} for name,content in sorted(PAYLOAD.items())}}
PAYLOAD['release-manifest.json']=(json.dumps(manifest,indent=2)+'\n').encode()
archive=OUT/(NAME+'.zip')
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
    for name,content in sorted(PAYLOAD.items()):
        info=zipfile.ZipInfo(NAME+'/'+name,date_time=(*date.today().timetuple()[:3],12,0,0));info.compress_type=zipfile.ZIP_DEFLATED
        info.external_attr=(0o100755 if name=='android/gradlew' else 0o100644)<<16
        z.writestr(info,content)
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    for name,entry in manifest['files'].items(): assert hashlib.sha256(z.read(NAME+'/'+name)).hexdigest()==entry['sha256']
(OUT/apk_name).write_bytes(PAYLOAD['artifacts/'+apk_name])
notes=OUT/('RELEASE_NOTES-v'+VERSION+'.md');notes.write_bytes(PAYLOAD['RELEASE_NOTES.md'])
artifacts=[archive,OUT/apk_name,notes]
(OUT/'SHA256SUMS.txt').write_text(''.join(hashlib.sha256(p.read_bytes()).hexdigest()+'  '+p.name+'\n' for p in artifacts),encoding='utf-8')
print(json.dumps({'directory':str(OUT),'payloadFiles':len(PAYLOAD),'archiveBytes':archive.stat().st_size,'privateDataScan':'passed','manifestVerification':'passed'},indent=2))
