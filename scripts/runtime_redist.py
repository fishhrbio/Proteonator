"""Select the licensed app-local x64 Visual C++ Redistributable used by RNAlib."""
from pathlib import Path
import hashlib
import json
import os
import shutil
import pefile


def version(file):
    image=pefile.PE(str(file),fast_load=False)
    if image.FILE_HEADER.Machine!=0x8664:
        raise ValueError('The C++ runtime must be AMD64.')
    info=image.VS_FIXEDFILEINFO[0]
    return (info.FileVersionMS>>16,info.FileVersionMS&65535,info.FileVersionLS>>16,info.FileVersionLS&65535)


def install_runtime(root):
    supplied=os.environ.get('PROTEONATOR_MSVC_REDIST')
    candidates=[Path(supplied)] if supplied else []
    if not supplied:
        for variable,default in [('ProgramFiles(x86)',r'C:\Program Files (x86)'),('ProgramFiles',r'C:\Program Files')]:
            base=Path(os.environ.get(variable,default))/'Microsoft Visual Studio'
            for edition in ['BuildTools','Community','Professional','Enterprise']:
                candidates.extend(base.glob(f'*/{edition}/VC/Redist/MSVC/*/x64/Microsoft.VC*.CRT'))
    candidates=[p for p in candidates if (p/'msvcp140.dll').is_file() and version(p/'msvcp140.dll')>=(14,40,0,0)]
    if not candidates:
        raise RuntimeError('Supply a licensed x64 MSVC Redistributable >=14.40 directory through PROTEONATOR_MSVC_REDIST. Older automatically collected DLLs cannot support RNAlib.')
    source=max(candidates,key=lambda p:version(p/'msvcp140.dll'))
    target=root/'compute-dist/ProteonatorCompute/_internal'
    if not target.is_dir():
        raise RuntimeError('Freeze the scientific runtime before installing its C++ Redistributable.')
    files=[]
    for name in ['msvcp140.dll','vcruntime140.dll','vcruntime140_1.dll']:
        original=source/name
        if not original.is_file():raise RuntimeError('Incomplete C++ Redistributable: '+name)
        shutil.copyfile(original,target/name)
        files.append({'name':name,'version':'.'.join(map(str,version(original))),'sha256':hashlib.sha256(original.read_bytes()).hexdigest()})
    manifest={'component':'Microsoft Visual C++ app-local x64 Redistributable','source':'Installed Visual Studio licensed Redistributable directory','files':files,'terms':'Microsoft Software License Terms; see bundled notices and https://learn.microsoft.com/cpp/windows/redistributing-visual-cpp-files'}
    (target.parent/'runtime-libraries.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
    license_root=next((parent/'Licenses/1033' for parent in source.parents if (parent/'Licenses/1033/Redist.txt').is_file()),None)
    if license_root:
        for filename in ['Redist.txt','ThirdPartyNotices.txt']:
            shutil.copyfile(license_root/filename,root/'licenses'/('Microsoft-Visual-Cpp-'+filename))
    (root/'licenses/Microsoft-Visual-Cpp-Runtime.txt').write_text('Microsoft Visual C++ app-local runtime\n\nCopyright Microsoft Corporation. Microsoft Software License Terms apply. These files are selected from the installed Visual Studio Redistributable directory. Distribution remains subject to the Visual Studio license terms and the included Redist list.\n\nhttps://learn.microsoft.com/cpp/windows/redistributing-visual-cpp-files\nhttps://visualstudio.microsoft.com/license-terms/\n\n'+json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
    print('Selected app-local C++ runtime '+files[0]['version'])


if __name__=='__main__':install_runtime(Path(__file__).resolve().parents[1])
