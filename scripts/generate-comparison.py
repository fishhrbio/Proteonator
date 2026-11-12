"""A synthetic, renumbered/perturbed comparison derived from CC0 1BRS chain A."""
from pathlib import Path
import math,json,hashlib
root=Path(__file__).resolve().parents[1]
rows=['REMARK SYNTHETIC COMPARISON: rigid rotation/translation, renumbering +100, local perturbation.','REMARK Derived from public 1BRS chain A. Not an experimentally observed conformation.']
for line in (root/'fixtures/structures/1BRS.pdb').read_text().splitlines():
    if line[:6].strip()!='ATOM' or line[21]!='A':continue
    x,y,z=[float(line[i:i+8]) for i in (30,38,46)]
    seq=int(line[22:26]);offset=0.8*math.sin(seq*.3) if 20<=seq<=45 else 0.0
    xx,yy,zz=.6*x-.8*y+15,.8*x+.6*y-12,z+6+offset
    rows.append(line[:22]+f'{seq+100:4d}'+line[26:30]+f'{xx:8.3f}{yy:8.3f}{zz:8.3f}'+line[54:])
rows.append('END')
destination=root/'fixtures/synthetic/barnase-comparison.pdb'
destination.write_text('\n'.join(rows)+'\n',encoding='utf-8')
data=destination.read_bytes()
p=root/'fixtures/PROVENANCE.json';manifest=json.loads(p.read_text());manifest['files']=[f for f in manifest['files'] if f['path']!='synthetic/barnase-comparison.pdb']
manifest['files'].append({'path':'synthetic/barnase-comparison.pdb','bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'evidenceClass':'synthetic-fixture','sourceUrl':'https://www.rcsb.org/structure/1BRS','license':'CC0-1.0','licenseUrl':'https://www.wwpdb.org/about/usage-policies','usedFor':'Synthetic alignment verification and screenshot demonstration; not an observed conformation','generation':'scripts/generate-comparison.py: chain A, numbering +100, rigid transform and local z perturbation'})
p.write_text(json.dumps(manifest,indent=2)+'\n')
print(destination)
