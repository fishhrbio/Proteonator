"""Retain license files from the exact native scientific distributions."""
from importlib import metadata
from pathlib import Path
import hashlib,json,platform,shutil
PACKAGES=['numpy','OpenMM','gemmi','biopython','ViennaRNA','matplotlib','contourpy','cycler','fonttools','kiwisolver','packaging','pillow','pyparsing','python-dateutil','tzdata','charset-normalizer','pyinstaller']
def collect_notices(target):
    folder=Path(target)/'third-party';folder.mkdir(parents=True,exist_ok=True);records=[]
    for name in PACKAGES:
        dist=metadata.distribution(name);files=[]
        for relative in dist.files or []:
            parts=Path(str(relative)).parts
            if not any(p.endswith('.dist-info') for p in parts):continue
            if not any(key in str(relative).lower() for key in ['license','copying','notice','authors']):continue
            original=Path(dist.locate_file(relative))
            if not original.is_file():continue
            safe=Path(*parts[parts.index(next(p for p in parts if p.endswith('.dist-info'))):])
            destination=folder/safe;destination.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(original,destination)
            files.append({'path':destination.relative_to(folder).as_posix(),'sha256':hashlib.sha256(destination.read_bytes()).hexdigest()})
        records.append({'distribution':name,'version':dist.version,'licenseFiles':files})
    root=Path(__file__).resolve().parents[1]
    shutil.copyfile(root/'licenses/python-additions/ViennaRNA-naview-notice.txt',folder/'ViennaRNA-naview-notice.txt')
    (folder/'inventory.json').write_text(json.dumps({'platform':platform.platform(),'python':platform.python_version(),'packages':records},indent=2)+'\n',encoding='utf-8')
