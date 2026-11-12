"""Independent Gemmi import and NumPy SVD alignment oracle; no Proteonator imports."""
import json
import sys
from pathlib import Path
import gemmi
import numpy as np

request=json.load(sys.stdin)
if request['operation']=='parse':
    p=Path(request['filename'])
    s=gemmi.read_structure(str(p))
    atoms=[]
    for model in s:
        for chain in model:
            for residue in chain:
                for atom in residue:
                    atoms.append({'serial':atom.serial,'model':model.num,'chain':chain.name,'seq':str(residue.seqid.num),'ins':residue.seqid.icode.strip(),'residue':residue.name,'name':atom.name,'alt':atom.altloc.replace('\x00',''),'position':{'x':atom.pos.x,'y':atom.pos.y,'z':atom.pos.z},'occupancy':atom.occ})
    print(json.dumps({'gemmi':gemmi.__version__,'atoms':atoms}))
else:
    reference=np.asarray(request['reference'],dtype=float)
    mobile=np.asarray(request['mobile'],dtype=float)
    rc,mc=reference.mean(axis=0),mobile.mean(axis=0)
    u,_,vt=np.linalg.svd((mobile-mc).T@(reference-rc))
    correction=np.eye(3)
    correction[2,2]=np.linalg.det(vt.T@u.T)
    rotation=vt.T@correction@u.T
    translation=rc-rotation@mc
    distances=np.linalg.norm(mobile@rotation.T+translation-reference,axis=1)
    print(json.dumps({'numpy':np.__version__,'rotation':rotation.flatten().tolist(),'translation':translation.tolist(),'rmsd':float(np.sqrt(np.mean(distances**2))),'distances':distances.tolist(),'determinant':float(np.linalg.det(rotation))}))
