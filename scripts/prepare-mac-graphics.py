"""Supply the Vulkan loader required by Chromium's bundled SwiftShader on macOS."""
from pathlib import Path
import hashlib,json,platform,shutil,subprocess,sys
ROOT=Path(__file__).resolve().parents[1];WORK=ROOT/'work/mac-graphics'
REVISION='fa218055ff4948b159f31d43f800c808a13d51df'  # Vulkan SDK 1.4.363.0
def run(*args,**kwargs):subprocess.run(args,check=True,**kwargs)
if platform.system()!='Darwin':raise SystemExit('This helper requires macOS.')
WORK.mkdir(parents=True,exist_ok=True);source=WORK/'Vulkan-Loader';build=WORK/'build'
if not source.exists():
    source.mkdir();run('git','init',str(source));run('git','-C',str(source),'remote','add','origin','https://github.com/KhronosGroup/Vulkan-Loader.git')
    run('git','-C',str(source),'fetch','--depth=1','origin',REVISION);run('git','-C',str(source),'checkout','--detach','FETCH_HEAD')
assert subprocess.check_output(['git','-C',str(source),'rev-parse','HEAD'],text=True).strip()==REVISION
run('cmake','-S',str(source),'-B',str(build),'-DUPDATE_DEPS=ON','-DBUILD_TESTS=OFF','-DCMAKE_BUILD_TYPE=Release','-DCMAKE_OSX_DEPLOYMENT_TARGET=15.0','-DCMAKE_OSX_ARCHITECTURES='+platform.machine())
run('cmake','--build',str(build),'--config','Release','--parallel','4')
library=next(p for p in (build/'loader').glob('libvulkan*.dylib') if not p.is_symlink())
target=WORK/'libvulkan.dylib';shutil.copyfile(library,target)
run('codesign','--force','--sign','-',str(target))
report={'component':'Khronos Vulkan Loader','version':'1.4.363','revision':REVISION,'architecture':platform.machine(),'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'source':'https://github.com/KhronosGroup/Vulkan-Loader/tree/'+REVISION}
(WORK/'inventory.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
if '--stock-electron' in sys.argv:
    executable=Path(subprocess.check_output(['node','-p',"require('electron')"],text=True).strip());bundle=executable.parents[2]
    libraries=bundle/'Contents/Frameworks/Electron Framework.framework/Versions/A/Libraries'
    assert libraries.is_dir();shutil.copyfile(target,libraries/'libvulkan.dylib')
    run('codesign','--force','--deep','--sign','-',str(bundle))
print(json.dumps(report),flush=True)
