"""Package the pinned CPU molecular runtime on Windows x64."""
from pathlib import Path
import sys
import PyInstaller.__main__
import openmm
root=Path(__file__).resolve().parents[1]
lib=Path(openmm.version.openmm_library_path)
args=['--noconfirm','--clean','--name','ProteonatorCompute','--workpath',str(root/'work/pyinstaller'),'--distpath',str(root/'compute-dist'),'--specpath',str(root/'work'),'--runtime-hook',str(root/'scripts/compute-runtime.py'),'--collect-data','openmm','--collect-submodules','openmm','--collect-all','gemmi','--collect-all','Bio','--collect-all','RNA','--collect-all','matplotlib','--copy-metadata','biopython','--copy-metadata','ViennaRNA','--copy-metadata','matplotlib','--copy-metadata','numpy','--copy-metadata','openmm','--exclude-module','numpy.tests','--exclude-module','numpy._core.tests','--exclude-module','numpy.linalg.tests','--exclude-module','numpy.random.tests','--exclude-module','setuptools','--exclude-module','pytest','--exclude-module','psutil','--exclude-module','tkinter','--exclude-module','win32api','--exclude-module','pywintypes','--exclude-module','pythoncom','--exclude-module','win32com','--add-data',str(root/'data')+';data']
for file in lib.glob('*.dll'):args+=['--add-binary',str(file)+';OpenMM.libs/lib']
args+=['--add-binary',str(lib/'plugins/OpenMMCPU.dll')+';OpenMM.libs/lib/plugins',str(root/'compute/molecule.py')]
PyInstaller.__main__.run(args)

from runtime_redist import install_runtime
install_runtime(root)
