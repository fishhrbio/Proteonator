"""Check retained stereocenters in the independently evaluated local-response fixtures."""
from pathlib import Path
import json,numpy as np
import molecule as m
root=Path(__file__).resolve().parents[1];report=[]
for name in ['phosphoserine','phosphothreonine','phosphotyrosine','acetyllysine']:
    result=json.loads((root/'work/physics'/f'{name}.json').read_text())
    fixture='1UBQ' if name=='acetyllysine' else '1CRN'
    source=m.inspect({'text':(root/'fixtures/structures'/f'{fixture}.pdb').read_text(),'format':'pdb'})
    variant=m.inspect({'text':result['text'],'format':'mmcif'})
    before={a['id']:np.array(a['position']) for a in source['atoms']};after={a['id']:np.array(a['position']) for a in variant['atoms']}
    checked=0
    for r in source['residues']:
        centers=[('CA',['N','C','CB'])]
        if r['name']=='THR':centers.append(('CB',['CA','OG1','CG2']))
        if r['name']=='ILE':centers.append(('CB',['CA','CG1','CG2']))
        for center,neighbors in centers:
            keys=[r['id']+'/'+atom for atom in [center,*neighbors]]
            if not all(k in before and k in after for k in keys):continue
            def volume(coords):
                o,a,b,c=[coords[k] for k in keys];return float(np.dot(a-o,np.cross(b-o,c-o)))
            a,b=volume(before),volume(after)
            if abs(a)<1e-3:continue
            assert a*b>0,{'modification':name,'center':keys[0],'before':a,'after':b}
            checked+=1
    assert checked>0
    report.append({'modification':name,'checkedRetainedStereocenters':checked,'inversions':0})
(root/'work/physics/stereochemistry.json').write_text(json.dumps({'status':'passed','cases':report},indent=2),encoding='utf8')
print(json.dumps(report))
