"""Proteonator molecular service. Coordinate units Å; no source is overwritten."""
from pathlib import Path
import hashlib, io, json, math, os, random, sys, time
import gemmi
import numpy as np
from functools import lru_cache
os.environ['OPENMM_CPU_THREADS']='2'

ROOT=Path(getattr(sys,'_MEIPASS',Path(__file__).resolve().parents[1]))
CCD=ROOT/'data'/'components'
CCD_CODES=frozenset(p.stem for p in CCD.glob('*.cif'))
MODS={'phosphoserine':('SER','SEP','OG', ['CB','CA'],-1),
      'phosphothreonine':('THR','TPO','OG1',['CB','CA'],-1),
      'phosphotyrosine':('TYR','PTR','OH',['CZ','CE1'],-1),
      'acetyllysine':('LYS','ALY','NZ',['CE','CD'],0),
      'monomethyllysine':('LYS','MLZ','NZ',['CE','CD'],1),
      'dimethyllysine':('LYS','MLY','NZ',['CE','CD'],1),
      'trimethyllysine':('LYS','M3L','NZ',['CE','CD'],1)}
class MolecularError(Exception): pass

@lru_cache(maxsize=2)
def forcefield(name):
    from openmm import app
    return app.ForceField(name,name.removesuffix('.xml')+'/water.xml')
def sha(text): return hashlib.sha256(text.encode('utf-8')).hexdigest()

def cif_block(text):return gemmi.cif.read_string(text.removeprefix('\ufeff')).sole_block()
def pos(a): return np.array([a.pos.x,a.pos.y,a.pos.z],dtype=float)
def rid(chain,r): return f'{chain.name}/{r.seqid.num}{r.seqid.icode.strip()}'

def check_stereochemistry(before,after):
    def atoms(structure):return {rid(c,r)+'/'+a.name:pos(a) for c in structure[0] for r in c for a in active_atoms(r)}
    aa,bb=atoms(before),atoms(after);checked=0
    for c in before[0]:
        for r in c:
            if not gemmi.find_tabulated_residue(r.name).is_amino_acid() and r.name not in {'SEP','TPO','PTR','ALY','MLZ','MLY','M3L'}:continue
            groups=[['CA','N','C','CB']]
            if r.name in {'THR','TPO'}:groups.append(['CB','CA','OG1','CG2'])
            if r.name=='ILE':groups.append(['CB','CA','CG1','CG2'])
            for names in groups:
                keys=[rid(c,r)+'/'+name for name in names]
                if not all(k in aa and k in bb for k in keys):continue
                def volume(coords):
                    o,a,b,d=[coords[k] for k in keys];return float(np.dot(a-o,np.cross(b-o,d-o)))
                a,b=volume(aa),volume(bb)
                if abs(a)<1e-3:raise MolecularError('The input has a degenerate stereocenter at '+keys[0]+'. Resolve its geometry before local response.')
                if a*b<=0:raise MolecularError('Local response inverted a retained stereocenter at '+keys[0]+'. The result was discarded; review the constructed geometry and steric environment.')
                checked+=1
    return checked
def selected(s,model):
    index=int(model)
    if index<0 or index>=len(s): raise MolecularError('Coordinate model is unavailable.')
    for i in reversed(range(len(s))):
        if i!=index: del s[i]
    return s
def parse(text,fmt):
    if len(text.encode())>32*1024*1024: raise MolecularError('Coordinate input exceeds 32 MiB.')
    s=gemmi.make_structure_from_block(cif_block(text)) if fmt=='mmcif' else gemmi.read_pdb_string(text.removeprefix('\ufeff'))
    if not len(s) or s[0].count_atom_sites()==0: raise MolecularError('No coordinates found.')
    if any(m.count_atom_sites()>100000 for m in s): raise MolecularError('The source exceeds 100,000 recorded atoms per model.')
    return s
def text_of(s,source=None):
    s.setup_entities();s.assign_label_seq_id()
    doc=s.make_mmcif_document();block=doc.sole_block();rows=[]
    if source and source.removeprefix('\ufeff').lstrip().startswith('data_'):
        for row in cif_block(source).find(['_chem_comp_bond.comp_id','_chem_comp_bond.atom_id_1','_chem_comp_bond.atom_id_2','_chem_comp_bond.value_order','_chem_comp_bond.pdbx_aromatic_flag']):rows.append(list(row))
    for name in sorted({r.name for model in s for c in model for r in c}):
        if name not in CCD_CODES:continue
        p=CCD/(name+'.cif')
        if not p.exists():continue
        c=gemmi.cif.read_file(str(p)).sole_block()
        for r in c.find(['_chem_comp_bond.atom_id_1','_chem_comp_bond.atom_id_2','_chem_comp_bond.value_order','_chem_comp_bond.pdbx_aromatic_flag']):rows.append([name,*[str(v) for v in r]])
    if rows:
        loop=block.init_loop('_chem_comp_bond.',['comp_id','atom_id_1','atom_id_2','value_order','pdbx_aromatic_flag'])
        for row in dict.fromkeys(tuple(row) for row in rows):loop.add_row(list(row))
    return doc.as_string()
def make_state(req):
    s=parse(req['text'],req['format']);s.setup_entities();s.assign_label_seq_id();s=selected(s,req.get('model',0))
    assembly=req.get('assembly','source')
    if assembly!='source':
        a=next((x for x in s.assemblies if x.name==assembly),None)
        if a is None: raise MolecularError('Assembly is unavailable in the supplied source.')
        estimate=0
        for generator in a.generators:
            chains=set(generator.chains);subchains=set(generator.subchains)
            count=sum(len(r) for c in s[0] for r in c if (c.name in chains or '*' in chains) if chains) if chains else sum(len(r) for c in s[0] for r in c if not subchains or r.subchain in subchains or '*' in subchains)
            estimate+=count*len(generator.operators)
        if estimate>100000:raise MolecularError('This assembly exceeds 100,000 atoms.')
        s.transform_to_assembly(assembly,gemmi.HowToNameCopiedChain.AddNumber,keep_spacegroup=False,merge_dist=0)
        if s[0].count_atom_sites()>100000:raise MolecularError('This assembly exceeds 100,000 atoms.')
        if s[0].count_atom_sites()==0:raise MolecularError('The selected assembly contains no coordinates.')
        s.assemblies.clear()
    return s
def active_atoms(r):
    scores={}
    for a in r:
        if a.altloc not in ['\x00',' ',''] and a.occ>0:scores.setdefault(a.altloc,[]).append(a.occ)
    alt=sorted(scores,key=lambda k:(-sum(scores[k])/len(scores[k]),k!='A',k))[0] if scores else '\x00'
    shared={a.name for a in r if a.altloc in ['\x00',' ','']}
    return [a for a in r if a.occ>0 and (a.altloc in ['\x00',' ',''] or (a.altloc==alt and a.name not in shared))]
def inspect(req):
    original=parse(req['text'],req['format']);s=make_state(req);s.setup_entities();s.assign_label_seq_id();res=[];components={};atoms=[]
    sourceChains=sorted({c.name for c in original[int(req.get('model',0))]});chainMap={}
    for c in s[0]:
        candidates=[n for n in sourceChains if c.name.startswith(n) and c.name[len(n):].isdigit()] if req.get('assembly','source')!='source' else [c.name]
        if len(candidates)==1:chainMap[c.name]=candidates[0]
    for c in s[0]:
        for r in c:
            key=rid(c,r);kind='water' if r.is_water() else 'protein' if gemmi.find_tabulated_residue(r.name).is_amino_acid() else 'nucleic' if gemmi.find_tabulated_residue(r.name).is_nucleic_acid() else 'ion' if len(r)==1 else 'ligand'
            components.setdefault((c.name,kind),0);components[c.name,kind]+=len(r)
            res.append({'id':key,'chain':c.name,'number':r.seqid.num,'labelSeq':r.label_seq,'insertion':r.seqid.icode.strip(),'name':r.name,'kind':kind,'atoms':len(r),'oneLetter':gemmi.find_tabulated_residue(r.name).one_letter_code})
            for a in active_atoms(r): atoms.append({'id':key+'/'+a.name,'residue':key,'name':a.name,'element':a.element.name,'position':pos(a).tolist(),'bFactor':a.b_iso,'occupancy':a.occ})
    refs=[]
    if req['format']=='pdb':
        for line in req['text'].splitlines():
            if line.startswith('DBREF '):refs.append({'entity':line[12:13].strip(),'database':line[26:32].strip(),'accession':line[33:41].strip()})
    else:
        block=cif_block(req['text'])
        for row in block.find(['_struct_ref.entity_id','_struct_ref.db_name','_struct_ref.pdbx_db_accession']):refs.append({'entity':row[0],'database':row[1],'accession':row[2]})
    if len({a['id'] for a in atoms})!=len(atoms):raise MolecularError('Ambiguous author atom identities. Resolve duplicate residue/atom identifiers in the source before inspection.')
    display=s.clone()
    for c in display[0]:
        for r in c:
            keep={(a.name,a.altloc) for a in active_atoms(r)}
            for i in reversed(range(len(r))):
                if (r[i].name,r[i].altloc) not in keep or r[i].occ<=0:del r[i]
    return {'name':original.name,'models':[{'index':i,'name':str(m.num)} for i,m in enumerate(original)],
            'assemblies':[{'id':a.name,'author':a.author_determined,'description':a.oligomeric_details} for a in original.assemblies],
            'residues':res,'atoms':atoms,'sourceChainMap':chainMap,'components':[{'chain':k[0],'kind':k[1],'atoms':v} for k,v in components.items()],
            'crossReferences':refs,'info':dict(original.info),'displayText':text_of(display,req['text']),'sourceSha256':sha(req['text']),'alternatePolicy':'residue mean occupancy; tie A then lexical; blank atoms shared; zero occupancy excluded'}
def component(code):
    if code not in CCD_CODES:raise MolecularError('No bundled chemistry template for '+code)
    path=CCD/(code+'.cif')
    if not path.exists(): raise MolecularError('No bundled chemistry template for '+code)
    b=gemmi.cif.read_file(str(path)).sole_block();names=list(b.find_values('_chem_comp_atom.atom_id'));els=list(b.find_values('_chem_comp_atom.type_symbol'))
    coords=[]
    for axis in ['x','y','z']: coords.append([float(x) for x in b.find_values('_chem_comp_atom.pdbx_model_Cartn_'+axis+'_ideal')])
    aa={n.strip('"'): {'element':e,'position':np.array(p)} for n,e,p in zip(names,els,zip(*coords))}
    bonds=[(row[0].strip('"'),row[1].strip('"'),row[2]) for row in b.find(['_chem_comp_bond.atom_id_1','_chem_comp_bond.atom_id_2','_chem_comp_bond.value_order'])]
    return aa,bonds
def frame(points,origin,anchors):
    o=points[origin];x=points[anchors[0]]-o;x/=np.linalg.norm(x);y=points[anchors[1]]-o;y-=np.dot(y,x)*x
    if np.linalg.norm(y)<1e-6:raise MolecularError('Attachment frame is degenerate.')
    y/=np.linalg.norm(y);return o,np.column_stack([x,y,np.cross(x,y)])
def construct(req):
    s=make_state(req);changes=[];seen=set()
    for edit in req['edits']:
        key=edit['residue'];name=edit['modification']
        if key in seen:raise MolecularError('Only one chemical edit per residue is supported in a scenario.')
        seen.add(key)
        if name not in MODS:raise MolecularError('Unsupported chemical modification.')
        source,target,origin,anchors,charge=MODS[name]
        cr=next(((c,r) for c in s[0] for r in c if rid(c,r)==key),None)
        if cr is None:raise MolecularError('Selected residue is missing.')
        c,r=cr
        if r.name!=source:raise MolecularError(f'{name} requires {source}; selected {r.name}.')
        if any(a.altloc not in ['\x00',' ',''] for a in r):raise MolecularError('Resolve alternate locations before constructing this residue.')
        template,bonds=component(target);src={a.name:pos(a) for a in r if not a.element.is_hydrogen}
        if not all(a in src for a in [origin,*anchors]):raise MolecularError('Missing attachment atoms; the PTM cannot be constructed.')
        ideal={n:v['position'] for n,v in template.items()};o,basis=frame(src,origin,anchors);ti,tbasis=frame(ideal,origin,anchors)
        nr=gemmi.Residue();nr.name=target;nr.seqid=r.seqid;nr.het_flag='H';nr.subchain=r.subchain;nr.entity_id=r.entity_id
        for a in r:
            if not a.element.is_hydrogen:nr.add_atom(a)
        added=[]
        for n,v in template.items():
            if n in src or n=='OXT' or gemmi.Element(v['element']).is_hydrogen:continue
            p=o+basis@(tbasis.T@(v['position']-ti));a=gemmi.Atom();a.name=n;a.element=gemmi.Element(v['element']);a.pos=gemmi.Position(*p);a.occ=1;a.b_iso=0;nr.add_atom(a);added.append(n)
        for a,b,order in bonds:
            if a not in [x.name for x in nr] or b not in [x.name for x in nr]:continue
            distance=nr[a][0].pos.dist(nr[b][0].pos)
            if distance<0.7 or distance>2.3:raise MolecularError(f'Constructed bond {a}–{b} ({distance:.3f} Å) is invalid; preparation is required.')
        index=next(i for i,rr in enumerate(c) if rr.seqid==r.seqid and rr.name==r.name);del c[index];c.add_residue(nr,index)
        changes.append({'residue':key,'from':source,'to':target,'modification':name,'addedAtoms':added,'formalSideChainCharge':charge,'bonds':bonds,'templateSha256':hashlib.sha256((CCD/(target+'.cif')).read_bytes()).hexdigest()})
    return {'text':text_of(s,req['text']),'format':'mmcif','stage':'constructed','changes':changes,'method':'CCD ideal attachment-frame graft; original heavy atoms retained','sourceSha256':sha(req['text'])}
def measure(req):
    p=np.array(req['positions'],dtype=float)
    if not np.isfinite(p).all():raise MolecularError('Coordinates must be finite.')
    if p.shape==(2,3):return {'value':float(np.linalg.norm(p[1]-p[0])),'unit':'Å','kind':'distance'}
    if p.shape==(3,3):
        a,b=p[0]-p[1],p[2]-p[1];den=np.linalg.norm(a)*np.linalg.norm(b)
        if den<1e-12:raise MolecularError('Angle requires distinct points.')
        return {'value':math.degrees(math.acos(float(np.clip(np.dot(a,b)/den,-1,1)))),'unit':'°','kind':'angle'}
    if p.shape==(4,3):
        b0=-(p[1]-p[0]);b1=p[2]-p[1];b2=p[3]-p[2];length=np.linalg.norm(b1)
        if length<1e-12:raise MolecularError('Torsion requires distinct points.')
        b1/=length;v=b0-np.dot(b0,b1)*b1;w=b2-np.dot(b2,b1)*b1
        if min(np.linalg.norm(v),np.linalg.norm(w))<1e-12:raise MolecularError('Torsion is undefined for collinear points.')
        return {'value':math.degrees(math.atan2(np.dot(np.cross(b1,v),w),np.dot(v,w))),'unit':'°','kind':'torsion'}
    raise MolecularError('Select two, three or four atoms.')
def compare(req):
    base=inspect({'text':req['baseline'],'format':'mmcif'});variant=inspect({'text':req['variant'],'format':'mmcif'});bm={a['id']:a for a in base['atoms']};vm={a['id']:a for a in variant['atoms']}
    centers=[np.array(a['position']) for a in variant['atoms'] if a['residue'] in req['residues'] and a['element'] not in ['H','D']]
    if not centers:raise MolecularError('No edited atoms found.')
    def contacts(atoms):
        changed=[a for a in atoms if a['residue'] in req['residues'] and a['element'] not in ['H','D']];other=[a for a in atoms if a['residue'] not in req['residues'] and a['element'] not in ['H','D']];out={}
        grid={}
        for a in other:
            key=tuple(np.floor(np.array(a['position'])/4).astype(int));grid.setdefault(key,[]).append(a)
        for a in changed:
            point=np.array(a['position']);cell=np.floor(point/4).astype(int)
            for dx in [-1,0,1]:
             for dy in [-1,0,1]:
              for dz in [-1,0,1]:
               for b in grid.get(tuple(cell+[dx,dy,dz]),[]):
                d=float(np.linalg.norm(point-np.array(b['position'])))
                if d<=4:out[a['id']+'|'+b['id']]={'atomA':a['id'],'atomB':b['id'],'distance':d}
        return out
    bc,vc=contacts(base['atoms']),contacts(variant['atoms']);common=sorted(bm.keys()&vm.keys());disp=[{'atom':k,'distance':float(np.linalg.norm(np.array(bm[k]['position'])-np.array(vm[k]['position'])))} for k in common]
    angles=[];lengths=[]
    br={r['id']:r for r in base['residues']};vr={r['id']:r for r in variant['residues']}
    for key in req['residues']:
        if key not in vr:continue
        try:_,bonds=component(vr[key]['name'])
        except MolecularError:continue
        graph={}
        for a,b,_ in bonds:
            ai,bi=key+'/'+a,key+'/'+b
            if ai not in vm or bi not in vm or 'H' in [vm[ai]['element'],vm[bi]['element']]:continue
            graph.setdefault(a,[]).append(b);graph.setdefault(b,[]).append(a)
            value=float(np.linalg.norm(np.array(vm[ai]['position'])-np.array(vm[bi]['position'])))
            previous=float(np.linalg.norm(np.array(bm[ai]['position'])-np.array(bm[bi]['position']))) if ai in bm and bi in bm else None
            lengths.append({'residue':key,'atoms':[a,b],'variantAngstrom':value,'baselineAngstrom':previous,'deltaAngstrom':value-previous if previous is not None else None})
        for center,neighbors in graph.items():
            for i,a in enumerate(neighbors):
                for b in neighbors[i+1:]:
                    keys=[key+'/'+n for n in [a,center,b]];value=measure({'positions':[vm[k]['position'] for k in keys]})['value'];previous=measure({'positions':[bm[k]['position'] for k in keys]})['value'] if all(k in bm for k in keys) else None
                    angles.append({'residue':key,'atoms':[a,center,b],'variantDegrees':value,'baselineDegrees':previous,'deltaDegrees':value-previous if previous is not None else None})
    torsions=[]
    for key in req['residues']:
        r=vr.get(key)
        if r is None:continue
        chain=[r for r in variant['residues'] if r['chain']==vr[key]['chain'] and r['kind']=='protein'];index=next((i for i,r in enumerate(chain) if r['id']==key),None)
        if index is None:continue
        groups=[]
        if index>0:
            previous=chain[index-1]['id'];groups+=[('phi',[previous+'/C',key+'/N',key+'/CA',key+'/C']),('omega',[previous+'/CA',previous+'/C',key+'/N',key+'/CA'])]
        if index+1<len(chain):groups.append(('psi',[key+'/N',key+'/CA',key+'/C',chain[index+1]['id']+'/N']))
        side={'SEP':'OG','TPO':'OG1','PTR':'CG','ALY':'CG','MLZ':'CG','MLY':'CG','M3L':'CG'}.get(r['name'])
        if side:groups.append(('chi1',[key+'/N',key+'/CA',key+'/CB',key+'/'+side]))
        for name,keys in groups:
            if not all(k in vm for k in keys):continue
            peptide=[(a,b) for a,b in zip(keys,keys[1:]) if a.rsplit('/',1)[0]!=b.rsplit('/',1)[0]]
            if any(np.linalg.norm(np.array(vm[a]['position'])-np.array(vm[b]['position']))>1.8 for a,b in peptide):continue
            try:
                value=measure({'positions':[vm[k]['position'] for k in keys]})['value'];previous=measure({'positions':[bm[k]['position'] for k in keys]})['value'] if all(k in bm for k in keys) else None
            except MolecularError:continue
            torsions.append({'residue':key,'name':name,'atoms':keys,'variantDegrees':value,'baselineDegrees':previous,'deltaDegrees':(value-previous+180)%360-180 if previous is not None else None})
    radii={'C':1.70,'N':1.55,'O':1.52,'S':1.80,'P':1.80};added=set(vm)-set(bm);clashes=[]
    for c in vc.values():
        a,b=vm[c['atomA']],vm[c['atomB']]
        if not ({a['id'],b['id']}&added) or a['element'] not in radii or b['element'] not in radii:continue
        overlap=radii[a['element']]+radii[b['element']]-c['distance']
        if overlap>0.4:clashes.append({**c,'overlapAngstrom':overlap})
    return {'bondLengths':lengths,'bondAngles':angles,'torsions':torsions,'addedAtomStericOverlaps':clashes,'overlapMethod':'Added atoms against other residues; Bondi C/N/O/S/P radii; overlap > 0.4 Å; a geometric screen, not an energy or complete clash score','contactCutoffAngstrom':4,'baselineContacts':len(bc),'variantContacts':len(vc),'gained':[vc[k] for k in sorted(vc.keys()-bc.keys())],
            'lost':[bc[k] for k in sorted(bc.keys()-vc.keys())],'addedAtoms':sorted(vm.keys()-bm.keys()),'removedAtoms':sorted(bm.keys()-vm.keys()),
            'displacements':sorted(disp,key=lambda a:-a['distance'])[:200],'commonHeavyAtomRmsdAngstrom':math.sqrt(sum(a['distance']**2 for a in disp if vm[a['atom']]['element'] not in ['H','D'])/max(1,sum(vm[a['atom']]['element'] not in ['H','D'] for a in disp))),
            'interpretation':'Geometric environment changes; not binding affinity or a global folding prediction.'}
def prepare_system(req):
    # A fully parameterized molecular system is required. No unknown component is silently removed.
    import openmm as mm
    from openmm import app,unit
    import xml.etree.ElementTree as ET
    cpu=mm.Platform.getPlatformByName('CPU');cpu.setPropertyDefaultValue('Threads','2');cpu.setPropertyDefaultValue('DeterministicForces','true')
    seed=int(req['seed']);random.seed(seed);np.random.seed(seed)
    pH=float(req['pH']);radius=float(req['radiusAngstrom']);strength=float(req['restraintK']);iterations=int(req['maxIterations']);tolerance=float(req['tolerance'])
    if not all(math.isfinite(v) for v in [pH,radius,strength,iterations,tolerance]) or not (0<=pH<=14 and 4<=radius<=20 and 1<=strength<=10000 and 1<=iterations<=1000 and tolerance>0):raise MolecularError('Relaxation settings are outside supported ranges.')
    ffname=req['forcefield']
    if ffname not in ['charmm36_2024.xml','charmm36.xml']:raise MolecularError('Unsupported force field.')
    watername=ffname.removesuffix('.xml')+'/water.xml'
    ff=forcefield(ffname)
    prepared=parse(req['text'],'mmcif')
    names={r.name for c in prepared[0] for r in c}
    if any(a.element.name=='D' for c in prepared[0] for r in c for a in r):raise MolecularError('Deuterated structures are supported for viewing and geometry, but not for local response in this release.')
    if names&{'MLZ','MLY','M3L'}:raise MolecularError('Methyllysine local-relaxation parameters are not bundled. Construction and geometry remain available.')
    if 'ALY' in names and ffname!='charmm36.xml':raise MolecularError('ALY requires the legacy CHARMM36 parameter set.')
    if names&{'SEP','TPO','PTR'} and ffname!='charmm36_2024.xml':raise MolecularError('SEP/TPO/PTR local response requires CHARMM36m July 2024. Mixed ALY/phosphate relaxation is unsupported.')
    bondDefinitions=ET.Element('Residues')
    for name in ['SEP','TPO','PTR','ALY']:
        t=ff._templates.get(name)
        if t is None:continue
        entry=ET.SubElement(bondDefinitions,'Residue',name=name)
        for i,j in t.bonds:ET.SubElement(entry,'Bond',{'from':t.atoms[i].name,'to':t.atoms[j].name})
        ET.SubElement(entry,'Bond',{'from':'-C','to':'N'})
    app.Topology.loadBondDefinitions(io.StringIO(ET.tostring(bondDefinitions,encoding='unicode')))
    if any(a.altloc not in ['\x00',' ',''] or a.occ<=0 for c in prepared[0] for r in c for a in r):raise MolecularError('Resolve alternate or zero-occupancy atoms before local relaxation. Display remains available.')
    prepared_text=text_of(prepared)
    pdb=app.PDBxFile(io.StringIO(prepared_text))
    # OpenMM chooses label chains when these outnumber author chains (e.g. protein + water).
    # Restore the source author IDs through an explicit mmCIF mapping, never by a name prefix.
    rows=gemmi.cif.read_string(prepared_text).sole_block().find(['_atom_site.label_asym_id','_atom_site.auth_asym_id'])
    label_to_auth={}
    for label,author in rows:
        if label in label_to_auth and label_to_auth[label]!=author:raise MolecularError('Ambiguous author-chain mapping in prepared topology.')
        label_to_auth[label]=author
    if len(label_to_auth)>len(set(label_to_auth.values())):
        for chain in pdb.topology.chains():chain.id=label_to_auth[chain.id]
    if pdb.topology.getNumAtoms()>5000:raise MolecularError('Local relaxation is limited to 5,000 atoms before hydrogen preparation. Display remains available.')
    mod=app.Modeller(pdb.topology,pdb.positions)
    # Remove source hydrogens explicitly; rebuild them consistently with this parameter set and pH.
    mod.delete([a for a in mod.topology.atoms() if a.element==app.element.hydrogen])
    definitions=ET.Element('Residues')
    for name in ['SEP','TPO','PTR','ALY','MLZ','MLY','M3L']:
        t=ff._templates.get(name)
        if t is None:continue
        e=ET.SubElement(definitions,'Residue',name=name)
        for ai,a in enumerate(t.atoms):
            if a.element!=app.element.hydrogen:continue
            parents=[t.atoms[j if i==ai else i].name for i,j in t.bonds if i==ai or j==ai]
            if len(parents)!=1:raise MolecularError('Invalid modified hydrogen template.')
            ET.SubElement(e,'H',name=a.name,parent=parents[0])
    app.Modeller.loadHydrogenDefinitions(io.StringIO(ET.tostring(definitions,encoding='unicode')))
    mod.addHydrogens(ff,pH=pH,platform=mm.Platform.getPlatformByName('CPU'))
    system=ff.createSystem(mod.topology,nonbondedMethod=app.NoCutoff,constraints=None,rigidWater=False)
    return ff,mod,system
def relax(req,validation_callback=None):
    import openmm as mm
    from openmm import app,unit
    ff,mod,system=prepare_system(req)
    ffname=req['forcefield'];pH=float(req['pH']);radius=float(req['radiusAngstrom']);strength=float(req['restraintK']);iterations=int(req['maxIterations']);tolerance=float(req['tolerance']);seed=int(req['seed'])
    positions=mod.positions.value_in_unit(unit.nanometer);targets=set(req['residues']);centers=[]
    for a in mod.topology.atoms():
        key=f'{a.residue.chain.id}/{a.residue.id}{a.residue.insertionCode.strip()}'
        if key in targets:centers.append(np.array(positions[a.index]))
    if not centers:raise MolecularError('Edited neighborhood could not be mapped to the prepared topology.')
    restraints=mm.CustomExternalForce('0.5*k*((x-x0)^2+(y-y0)^2+(z-z0)^2)');restraints.addGlobalParameter('k',strength)
    for name in ['x0','y0','z0']:restraints.addPerParticleParameter(name)
    fixed=[]
    for a in mod.topology.atoms():
        if a.element==app.element.hydrogen:continue
        p=np.array(positions[a.index]);d=min(np.linalg.norm(p-c) for c in centers)*10
        if d>radius:restraints.addParticle(a.index,list(p));fixed.append(a.index)
    system.addForce(restraints);integrator=mm.VerletIntegrator(0.001*unit.picoseconds)
    context=mm.Context(system,integrator,mm.Platform.getPlatformByName('CPU'),{'Threads':'2','DeterministicForces':'true'});context.setPositions(mod.positions)
    initial=context.getState(getEnergy=True).getPotentialEnergy().value_in_unit(unit.kilojoule_per_mole)
    mm.LocalEnergyMinimizer.minimize(context,tolerance,iterations)
    state=context.getState(getPositions=True,getEnergy=True,getForces=True);final=state.getPotentialEnergy().value_in_unit(unit.kilojoule_per_mole)
    if not math.isfinite(final):raise MolecularError('Relaxation produced a nonfinite energy.')
    forces=state.getForces(asNumpy=True).value_in_unit(unit.kilojoule_per_mole/unit.nanometer);rms=float(np.sqrt(np.mean(np.sum(forces**2,axis=1))))
    charge=sum(force.getParticleParameters(i)[0].value_in_unit(unit.elementary_charge) for force in system.getForces() if isinstance(force,mm.NonbondedForce) for i in range(force.getNumParticles()))
    if system.getNumConstraints()!=0:raise MolecularError('Unexpected constraints in the flexible local-minimization system.')
    if validation_callback is not None:validation_callback(system,mod.topology,state.getPositions(),state)
    out=io.StringIO();app.PDBxFile.writeFile(mod.topology,state.getPositions(),out,keepIds=True)
    computed=parse(out.getvalue(),'mmcif')
    for c in computed[0]:
        for r in c:
            for a in r:a.occ=1.0;a.b_iso=0.0
    stereocenters=check_stereochemistry(parse(req['text'],'mmcif'),computed)
    return {'text':text_of(computed,req['text']),'format':'mmcif','stage':'locally-relaxed','provenance':{'inputSha256':sha(req['text']),'forcefieldSha256':hashlib.sha256((Path(app.__file__).parent/'data'/ffname).read_bytes()).hexdigest(),'waterParametersSha256':hashlib.sha256((Path(app.__file__).parent/'data'/ffname.removesuffix('.xml')/'water.xml').read_bytes()).hexdigest(),'engine':'OpenMM '+mm.version.version,'forcefield':ffname,'waterParameters':ffname.removesuffix('.xml')+'/water.xml','platform':'CPU; two threads; deterministic forces','hydrogenPreparation':'Source hydrogens removed and rebuilt; monoanionic phosphate templates fixed independently of pH','coordinateConvention':'Computed atoms use occupancy 1 and B factor 0 as display placeholders, not experimental uncertainty estimates','retainedStereocentersChecked':stereocenters,'netChargeElementary':charge,'constraints':system.getNumConstraints(),'pH':pH,'environment':'vacuum; retained source waters; flexible bonds/waters; no periodic box; no cutoff','radiusAngstrom':radius,'restraintK_kJ_mol_nm2':strength,'restrainedHeavyAtoms':len(fixed),'seed':seed,'maxIterations':iterations,'tolerance_kJ_mol_nm':tolerance,'initialPotentialEnergy_kJ_mol':initial,'finalPotentialEnergy_kJ_mol':final,'rmsForce_kJ_mol_nm':rms,'converged':rms<=tolerance,'scope':'Restricted local minimization with harmonic restraints. Energy is not affinity; this is not equilibrium folding.'}}
def align(req):
    a=parse(req['reference'],'mmcif');b=parse(req['mobile'],'mmcif')
    def lookup(s):return {rid(c,r)+'/'+x.name:pos(x) for c in s[0] for r in c for x in active_atoms(r)}
    aa,bb=lookup(a),lookup(b);pairs=req['pairs']
    if len(pairs)<3 or len(pairs)>25000:raise MolecularError('Review at least three and at most 25,000 atom pairs.')
    if len({p[0] for p in pairs})!=len(pairs) or len({p[1] for p in pairs})!=len(pairs):raise MolecularError('Alignment correspondence must be one-to-one.')
    try: x=np.array([aa[p[0]] for p in pairs]);y=np.array([bb[p[1]] for p in pairs])
    except KeyError:raise MolecularError('A mapped atom is missing or inactive.')
    xc,yc=x.mean(axis=0),y.mean(axis=0);X,Y=x-xc,y-yc
    if min(np.linalg.matrix_rank(X),np.linalg.matrix_rank(Y))<2:raise MolecularError('Mapped atoms must not be collinear.')
    u,_,vt=np.linalg.svd(Y.T@X);fix=np.eye(3);fix[2,2]=np.linalg.det(u@vt);rotation=u@fix@vt;translation=xc-yc@rotation
    for model in b:
        for c in model:
            for r in c:
                for atom in r:atom.pos=gemmi.Position(*(pos(atom)@rotation+translation))
    distances=np.linalg.norm(y@rotation+translation-x,axis=1)
    return {'text':text_of(b,req['mobile']),'rmsdAngstrom':float(np.sqrt(np.mean(distances**2))),'matchedAtoms':len(pairs),'rotationRowVectors':rotation.tolist(),'translationAngstrom':translation.tolist(),'displacements':[{'reference':p[0],'mobile':p[1],'distanceAngstrom':float(d)} for p,d in zip(pairs,distances)],'method':'Proper rigid least-squares SVD; reviewed explicit correspondence; no reflection or source replacement'}

def sequence_pairs(req):
    a=inspect({'text':req['reference'],'format':'mmcif'});b=inspect({'text':req['mobile'],'format':'mmcif'})
    def residues(data,chain):
        ca={x['residue']:x['id'] for x in data['atoms'] if x['name']=='CA'}
        return [(r,ca[r['id']]) for r in data['residues'] if r['chain']==chain and r['kind']=='protein' and r['id'] in ca]
    x=residues(a,req['referenceChain']);y=residues(b,req['mobileChain']);n,m=len(x),len(y)
    if min(n,m)<3 or max(n,m)>2000:raise MolecularError('Sequence proposal needs protein chains with 3–2,000 resolved Cα residues.')
    score=np.empty((n+1,m+1),dtype=np.int32);score[:,0]=np.arange(n+1)*-2;score[0,:]=np.arange(m+1)*-2
    for i in range(1,n+1):
        for j in range(1,m+1):score[i,j]=max(score[i-1,j-1]+(2 if x[i-1][0]['oneLetter']==y[j-1][0]['oneLetter'] else -1),score[i-1,j]-2,score[i,j-1]-2)
    i,j=n,m;pairs=[];identities=0
    while i or j:
        same=i>0 and j>0 and x[i-1][0]['oneLetter']==y[j-1][0]['oneLetter']
        if i and j and score[i,j]==score[i-1,j-1]+(2 if same else -1):
            pairs.append([x[i-1][1],y[j-1][1]]);identities+=int(same);i-=1;j-=1
        elif i and score[i,j]==score[i-1,j]-2:i-=1
        else:j-=1
    return {'pairs':pairs[::-1],'identityFraction':identities/len(pairs),'referenceResolvedResidues':n,'mobileResolvedResidues':m,'method':'Global Needleman–Wunsch; match +2, mismatch −1, gap −2; resolved residues only. Review gaps, substitutions and construct differences before fitting.'}
def run(req):
    op=req['operation']
    if op=='inspect':return inspect(req)
    if op=='construct':return construct(req)
    if op=='measure':return measure(req)
    if op=='compare':return compare(req)
    if op=='relax':
        result=relax(req)
        if req.get('baselineText'):
            result['baselineControl']=relax({**req,'text':req['baselineText'],'baselineText':None})
        return result
    if op=='align':return align(req)
    if op=='sequence-pairs':return sequence_pairs(req)
    raise MolecularError('Unknown molecular operation.')
if __name__=='__main__':
    try:
        raw=sys.stdin.buffer.read(200*1024*1024+1)
        if len(raw)>200*1024*1024:raise MolecularError('Molecular request exceeds the supported size.')
        result=run(json.loads(raw.decode('utf-8')))
        print(json.dumps({'ok':True,'value':result},allow_nan=False))
    except (MolecularError,ValueError,KeyError,RuntimeError,TypeError) as e:
        print(json.dumps({'ok':False,'error':str(e)}));sys.exit(1)
