"""Install and verify native packages on isolated release-test hosts."""
from pathlib import Path
import hashlib,json,os,platform,plistlib,shutil,stat,subprocess,sys
ROOT=Path(__file__).resolve().parents[1];WORK=ROOT/'work/native-package';WORK.mkdir(parents=True,exist_ok=True)
STATE=WORK/'lifecycle.json'
def run(*args,check=True):
    p=subprocess.run(args,text=True,capture_output=True)
    if check and p.returncode:raise RuntimeError(str(args[0])+' failed: '+p.stderr[-4000:]+p.stdout[-2000:])
    return p
def sha(file):
    with Path(file).open('rb') as stream:return hashlib.file_digest(stream,'sha256').hexdigest()
def save(s):STATE.write_text(json.dumps(s,indent=2)+'\n',encoding='utf-8')
def env(s):
    values={'PROTEONATOR_EXE':s['executable'],'PROTEONATOR_COMPUTE_EXE':s['computeExecutable']}
    if os.environ.get('GITHUB_ENV'):
        with open(os.environ['GITHUB_ENV'],'a',encoding='utf-8') as stream:
            for k,v in values.items():stream.write(k+'='+v+'\n')
    print(json.dumps(values),flush=True)
def install():
    system=platform.system();s={'status':'installed','system':system,'architecture':platform.machine(),'events':[]}
    if system=='Darwin':
        packages=list((ROOT/'release').glob('*.dmg'));assert len(packages)==1,packages
        s['package']=str(packages[0]);s['packageSha256']=sha(packages[0])
        mounted=plistlib.loads(subprocess.check_output(['hdiutil','attach','-nobrowse','-readonly','-plist',str(packages[0])]))
        mount=next(Path(e['mount-point']) for e in mounted['system-entities'] if 'mount-point' in e)
        destination=WORK/'Applications é/Proteonator.app';assert not destination.exists();destination.parent.mkdir(parents=True,exist_ok=True)
        try:
            source=mount/'Proteonator.app';assert source.is_dir()
            run('ditto',str(source),str(destination))
        finally:run('hdiutil','detach',str(mount))
        info=plistlib.loads((destination/'Contents/Info.plist').read_bytes());assert info['CFBundleShortVersionString']=='1.2.1'
        assert any('proteonator' in d.get('CFBundleTypeExtensions',[]) for d in info['CFBundleDocumentTypes'])
        executable=destination/'Contents/MacOS'/info['CFBundleExecutable'];resources=destination/'Contents/Resources'
        run('codesign','--verify','--deep','--strict',str(destination))
        signature=run('codesign','--display','--verbose=4',str(destination)).stderr
        s['signature']='ad-hoc' if 'Signature=adhoc' in signature else signature
        assessment=run('spctl','--assess','--type','execute','--verbose=2',str(destination),check=False)
        s['gatekeeper']={'exit':assessment.returncode,'output':assessment.stderr.strip(),'notarizationVerified':False}
        s['installDirectory']=str(destination)
        s['events'].append('Mounted read-only DMG, copied app into a Unicode application path, detached disk image, verified bundle signature and document type')
    elif system=='Linux':
        packages=list((ROOT/'release').glob('*.deb'));assert len(packages)==1,packages
        s['package']=str(packages[0]);s['packageSha256']=sha(packages[0])
        run('sudo','apt-get','install','-y',str(packages[0]));assert run('dpkg-query','-W','-f=${Version}','proteonator').stdout.strip()=='1.2.1'
        executable=Path('/opt/Proteonator/proteonator');assert executable.is_file()
        resources=executable.parent/'resources';s['installDirectory']=str(executable.parent)
        sandbox=executable.parent/'chrome-sandbox';s['sandboxHelper']={'owner':sandbox.stat().st_uid,'mode':oct(stat.S_IMODE(sandbox.stat().st_mode))}
        assert sandbox.stat().st_uid==0
        desktop=Path('/usr/share/applications/proteonator.desktop');assert desktop.is_file() and 'application/x-proteonator-project' in desktop.read_text()
        s['desktopEntry']=str(desktop);s['events'].append('Installed native DEB with dependency resolution, desktop entry, document MIME registration and Chromium sandbox helper')
    else:raise RuntimeError('This lifecycle helper is for native macOS and Linux hosts')
    compute=resources/'compute/ProteonatorCompute';assert compute.is_file() and os.access(compute,os.X_OK)
    s.update(executable=str(executable),computeExecutable=str(compute),resources=str(resources),retention={})
    s['installedFiles']={str(p.relative_to(resources)):sha(p) for p in [resources/'app.asar',compute,resources/'USER_GUIDE.html',resources/'SCIENCE.html',resources/'THIRD_PARTY_NOTICES.md']}
    save(s);env(s)
def finish():
    s=json.loads(STATE.read_text(encoding='utf-8'))
    original=WORK/'native saved é.proteonator';assert original.is_file()
    integration=json.loads((WORK/'integration-result.json').read_text(encoding='utf-8'));profile=Path(integration['nativeInfo']['userDataPath'])
    retained=[original,profile/'Preferences',profile/'Local State'];assert all(p.is_file() for p in retained)
    local_storage=[p for p in (profile/'Local Storage/leveldb').glob('*') if p.is_file()];assert local_storage,'The saved theme has no persisted local-storage files'
    retained+=local_storage;s['localStorageFilesRetained']=len(local_storage)
    s['retention']={str(p):sha(p) for p in retained}
    if s['system']=='Darwin':
        destination=Path(s['installDirectory']).resolve();assert destination.is_relative_to(WORK.resolve()) and destination.name=='Proteonator.app'
        mounted=plistlib.loads(subprocess.check_output(['hdiutil','attach','-nobrowse','-readonly','-plist',s['package']]))
        mount=next(Path(e['mount-point']) for e in mounted['system-entities'] if 'mount-point' in e)
        try:run('ditto',str(mount/'Proteonator.app'),str(destination))
        finally:run('hdiutil','detach',str(mount))
        for file,digest in s['retention'].items():assert sha(file)==digest
        for file,digest in s['installedFiles'].items():assert sha(Path(s['resources'])/file)==digest
        run('codesign','--verify','--deep','--strict',str(destination));s['events'].append('Reinstalled the same native app and retained the actual project and Electron preferences')
        shutil.rmtree(destination);assert not destination.exists()
        s['events'].append('Removed only the installed test app bundle')
    else:
        run('sudo','apt-get','install','--reinstall','-y',s['package'])
        for file,digest in s['installedFiles'].items():assert sha(Path(s['resources'])/file)==digest
        for file,digest in s['retention'].items():assert sha(file)==digest
        s['events'].append('Reinstalled the native DEB and retained the actual project and Electron preferences')
        run('sudo','apt-get','remove','-y','proteonator');assert not Path(s['executable']).exists() and not Path(s['desktopEntry']).exists()
        s['events'].append('Uninstalled the native DEB and verified removal of executable and desktop entry')
    for file,digest in s['retention'].items():assert sha(file)==digest
    s['status']='passed';s['events'].append('Retained project and settings files match their pre-uninstall hashes');save(s);print(json.dumps(s),flush=True)
if __name__=='__main__':{'install':install,'finish':finish}[sys.argv[1]]()
