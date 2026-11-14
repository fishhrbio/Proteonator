"""Imported, bounded coordinate frames with exact topology/order registration."""
import hashlib
import math
import numpy as np


def checked(req):
    import molecule as m
    text=req['topologyText'];data=req['data']
    if hashlib.sha256(text.encode('utf-8')).hexdigest()!=data['topologySha256']:
        raise ValueError('Trajectory topology hash does not match.')
    structure=m.parse(text,'mmcif')
    atoms=[(m.rid(c,r)+'/'+a.name,a) for c in structure[0] for r in c for a in m.active_atoms(r)]
    if not 1<=len(atoms)<=5000 or [key for key,a in atoms]!=data['atomIds']:
        raise ValueError('Trajectory atom order/identity does not match its registered topology.')
    frames=data['frames']
    if not 2<=len(frames)<=200 or any(len(f['positions'])!=len(atoms) for f in frames):
        raise ValueError('Trajectory frames do not match the bounded topology.')
    if data['units'] not in ('angstrom','nanometer') or data['motion'] not in ('trajectory','ensemble'):
        raise ValueError('Declare coordinate units and trajectory/ensemble semantics.')
    for i,frame in enumerate(frames):
        if any(len(p)!=3 or any(not isinstance(v,(int,float)) or isinstance(v,bool) or not math.isfinite(v) for v in p) for p in frame['positions']):
            raise ValueError('Trajectory has nonfinite or malformed coordinates.')
        if data['motion']=='trajectory' and ('timePs' not in frame or not math.isfinite(frame['timePs']) or frame['timePs']<0 or i>0 and frame['timePs']<=frames[i-1]['timePs']):
            raise ValueError('Supply strictly increasing trajectory times in ps.')
        if data['motion']=='ensemble' and 'timePs' in frame:
            raise ValueError('An ensemble has no inferred time axis.')
    return m,structure,atoms,data,10 if data['units']=='nanometer' else 1


def frame(req):
    m,structure,atoms,data,scale=checked(req)
    index=req['index']
    if not isinstance(index,int) or isinstance(index,bool) or not 0<=index<len(data['frames']):
        raise ValueError('Trajectory frame is unavailable.')
    for (_,atom),position in zip(atoms,data['frames'][index]['positions']):
        atom.pos=m.gemmi.Position(*(float(v)*scale for v in position));atom.occ=1;atom.b_iso=0
    text=m.text_of(structure,req['topologyText'])
    return {'text':text,'sha256':m.sha(text),'index':index,'timePs':data['frames'][index].get('timePs'),'units':'angstrom','interpretation':'Actual imported frame coordinates. Occupancy 1/B factor 0 are placeholders; no interpolated folding or equilibrium claim.'}


def analysis(req):
    _,_,atoms,data,scale=checked(req)
    selected=[i for i,(_,a) in enumerate(atoms) if a.element.name not in ('H','D')]
    if not selected:raise ValueError('No heavy atoms are available for frame analysis.')
    xyz=np.asarray([f['positions'] for f in data['frames']],dtype=float)[:,selected,:]*scale
    mean=xyz.mean(axis=0);rmsf=np.sqrt(np.mean(np.sum((xyz-mean)**2,axis=2),axis=0));rmsd=np.sqrt(np.mean(np.sum((xyz-xyz[0])**2,axis=2),axis=1))
    return {'rmsdAngstrom':rmsd.tolist(),'rmsfByAtom':[{'atom':atoms[i][0],'rmsfAngstrom':float(value)} for i,value in zip(selected,rmsf)],'settings':{'fit':'none; original registered coordinate frame','referenceFrame':0,'atomSet':'all registered heavy atoms','frames':len(xyz)},'method':'RMSD to first frame and RMSF about the arithmetic mean, unaligned; includes rigid-body movement. Imported samples do not by themselves establish equilibrium or convergence.'}
