"""Independently read exported ZIPs with the standard-library ZIP decoder."""
import hashlib
import json
from pathlib import Path
import sys
import zipfile

root=Path(__file__).resolve().parents[1]
files=[Path(p) for p in sys.argv[1:]] or list((root/'work/media-verification').glob('*.zip'))
results=[]
for file in files:
    with zipfile.ZipFile(file) as archive:
        assert archive.testzip() is None, 'CRC failure'
        manifest=json.loads(archive.read('manifest.json'))
        assert set(archive.namelist())=={'manifest.json',*(f['name'] for f in manifest['files'])}
        for f in manifest['files']:
            data=archive.read(f['name'])
            assert len(data)==f['bytes']
            assert hashlib.sha256(data).hexdigest()==f['sha256']
        results.append({'file':file.name,'files':len(manifest['files']),'crcAndHashes':'passed'})
assert results, 'No exported ZIPs were checked'
(root/'work/export-archive-verification.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
print(json.dumps(results))
