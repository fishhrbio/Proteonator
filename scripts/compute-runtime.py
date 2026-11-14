"""Local plugin lookup for the standalone molecular runtime."""
import ctypes,os,sys
from pathlib import Path
if getattr(sys,'frozen',False) and sys.platform=='win32':
    # OpenMM's narrow-character directory loader cannot reliably traverse Unicode
    # installation paths. Load the one bundled CPU plugin through LoadLibraryW.
    os.environ['OPENMM_PLUGIN_DIR']=''
    import openmm
    lib=Path(sys._MEIPASS)/'OpenMM.libs'/'lib'
    with os.add_dll_directory(str(lib)):
        plugin=ctypes.CDLL(str(lib/'plugins'/'OpenMMCPU.dll'))
    plugin.registerPlatforms.argtypes=[]
    plugin.registerPlatforms.restype=None
    plugin.registerPlatforms()
    sys._proteonator_cpu_plugin=plugin
    openmm.Platform.getPlatformByName('CPU')
elif getattr(sys,'frozen',False):
    os.environ['OPENMM_PLUGIN_DIR']=''
    import openmm
    plugin_name='libOpenMMCPU.dylib' if sys.platform=='darwin' else 'libOpenMMCPU.so'
    openmm.Platform.loadPluginLibrary(str(Path(sys._MEIPASS)/'OpenMM.libs/lib/plugins'/plugin_name))
    openmm.Platform.getPlatformByName('CPU')
os.environ['OPENMM_CPU_THREADS']='2'
