"""Freeze the pinned scientific runtime natively on each target OS/architecture."""
from pathlib import Path
import json,os,platform,sys
import PyInstaller.__main__
import openmm
root=Path(__file__).resolve().parents[1]
lib=Path(openmm.version.openmm_library_path)
plugin_name={'win32':'OpenMMCPU.dll','darwin':'libOpenMMCPU.dylib','linux':'libOpenMMCPU.so'}[sys.platform]
plugin=lib/'plugins'/plugin_name
if not plugin.is_file():raise RuntimeError('The native CPU plugin is unavailable: '+str(plugin))
args=['--noconfirm','--clean','--name','ProteonatorCompute','--workpath',str(root/'work/pyinstaller'),'--distpath',str(root/'compute-dist'),'--specpath',str(root/'work'),'--runtime-hook',str(root/'scripts/compute-runtime.py'),'--collect-data','openmm','--collect-submodules','openmm','--collect-all','gemmi','--collect-all','Bio','--collect-all','RNA','--collect-all','matplotlib']
for name in ['biopython','ViennaRNA','matplotlib','numpy','openmm']:args+=['--copy-metadata',name]
for name in ['numpy.tests','numpy._core.tests','numpy.linalg.tests','numpy.random.tests','setuptools','pytest','psutil','tkinter','win32api','pywintypes','pythoncom','win32com']:args+=['--exclude-module',name]
args+=['--add-data',str(root/'data')+os.pathsep+'data']
patterns={'win32':['*.dll'],'darwin':['*.dylib'],'linux':['*.so','*.so.*']}[sys.platform]
libraries=sorted({file for pattern in patterns for file in lib.glob(pattern) if file.is_file()})
if not libraries:raise RuntimeError('No native OpenMM libraries found in '+str(lib))
for file in libraries:args+=['--add-binary',str(file)+os.pathsep+'OpenMM.libs/lib']
args+=['--add-binary',str(plugin)+os.pathsep+'OpenMM.libs/lib/plugins',str(root/'compute/molecule.py')]
PyInstaller.__main__.run(args)
target=root/'compute-dist/ProteonatorCompute'
if sys.platform=='win32':
    from runtime_redist import install_runtime
    install_runtime(root)
else:
    (target/'runtime-libraries.json').write_text(json.dumps({'platform':sys.platform,'architecture':platform.machine(),'python':platform.python_version(),'cpuPlugin':plugin_name,'systemRuntime':'Native operating-system libraries; no Windows DLLs are included.'},indent=2)+'\n',encoding='utf-8')
from collect_runtime_notices import collect_notices
collect_notices(target)
