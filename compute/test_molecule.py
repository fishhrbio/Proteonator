import importlib.util,json,math,sys,unittest
from pathlib import Path
import numpy as np
spec=importlib.util.spec_from_file_location('molecule',Path(__file__).with_name('molecule.py'));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
ROOT=Path(__file__).resolve().parents[1]
def source(name='1BRS',assembly='source'):
 return {'text':(ROOT/'fixtures/structures'/f'{name}.pdb').read_text(),'format':'pdb','assembly':assembly,'model':0}
class MoleculeTests(unittest.TestCase):
 def test_assembly_preserves_explicit_disulfide_and_covalent_connections(self):
  for name,expected in [('1CRN',3),('1HZH',31)]:
   state=m.make_state(source(name,assembly='1'));chains={c.name for c in state[0]};self.assertEqual(len(state.connections),expected)
   for conn in state.connections:
    self.assertIn(conn.partner1.chain_name,chains);self.assertIn(conn.partner2.chain_name,chains)
 def test_utf8_bom_keeps_source_hash_and_coordinate_identity(self):
  for fmt,name in [('pdb','1CRN.pdb'),('mmcif','1CRN.cif')]:
   text=(ROOT/'fixtures/structures'/name).read_text();base=m.inspect({'text':text,'format':fmt});with_bom=m.inspect({'text':'\ufeff'+text,'format':fmt});self.assertEqual(base['atoms'],with_bom['atoms']);self.assertEqual(with_bom['sourceSha256'],m.sha('\ufeff'+text))
 def test_retained_stereochemistry_rejects_inversion(self):
  before=m.make_state(source('1CRN'));after=before.clone();self.assertGreater(m.check_stereochemistry(before,after),40)
  r=next(r for c in after[0] for r in c if r.name=='THR');o=m.pos(r['CA'][0]);n=m.pos(r['N'][0])-o;c=m.pos(r['C'][0])-o;normal=np.cross(n,c);normal/=np.linalg.norm(normal);cb=r['CB'][0];p=m.pos(cb);cb.pos=m.gemmi.Position(*(p-2*np.dot(p-o,normal)*normal))
  with self.assertRaisesRegex(m.MolecularError,'inverted'):m.check_stereochemistry(before,after)
 def test_geometry_analytic(self):
  self.assertEqual(m.measure({'positions':[[0,0,0],[3,4,0]]})['value'],5)
  self.assertAlmostEqual(m.measure({'positions':[[1,0,0],[0,0,0],[0,1,0]]})['value'],90)
  self.assertAlmostEqual(abs(m.measure({'positions':[[1,0,0],[0,0,0],[0,1,0],[0,1,1]]})['value']),90)
  with self.assertRaises(m.MolecularError):m.measure({'positions':[[0,0,0],[0,0,0],[1,1,1]]})
 def test_all_chemical_templates_preserve_source_heavy_positions(self):
  req=source(assembly='1');base=m.inspect(req);atoms={a['id']:a for a in base['atoms']}
  for name,(src,*_) in m.MODS.items():
   r=next(r for r in base['residues'] if r['name']==src);out=m.construct({**req,'edits':[{'residue':r['id'],'modification':name}]});variant=m.inspect({'text':out['text'],'format':'mmcif'});new={a['id']:a for a in variant['atoms']}
   self.assertEqual(out['stage'],'constructed');self.assertTrue(out['changes'][0]['addedAtoms']);self.assertNotIn('OXT',out['changes'][0]['addedAtoms'])
   for key,a in atoms.items():
    if a['element']!='H':self.assertLess(np.linalg.norm(np.array(a['position'])-np.array(new[key]['position'])),1e-6)
   self.assertEqual(req['text'],source(assembly='1')['text'])
 def test_wrong_residue_and_duplicate_edits_reject(self):
  req=source();d=m.inspect(req);r=next(r for r in d['residues'] if r['name']=='VAL')
  with self.assertRaises(m.MolecularError):m.construct({**req,'edits':[{'residue':r['id'],'modification':'phosphoserine'}]})
  r=next(r for r in d['residues'] if r['name']=='SER');edit={'residue':r['id'],'modification':'phosphoserine'}
  with self.assertRaises(m.MolecularError):m.construct({**req,'edits':[edit,edit]})
 def test_assembly_and_biological_identity(self):
  a=m.inspect(source(assembly='1'));self.assertEqual(len(a['atoms']),1779);self.assertEqual(a['sourceChainMap'],{'A1':'A','D1':'D'})
  r=next(r for r in a['residues'] if r['id']=='A1/3');self.assertEqual(r['labelSeq'],3)
 def test_mixed_component_views(self):
  for name in ['1UBQ','4HHB','1BNA','1HZH']:
   d=m.inspect(source(name));self.assertTrue(len(d['atoms'])>100);self.assertTrue(d['displayText'].startswith('data_'))
  self.assertTrue(any(r['name']=='HEM' for r in m.inspect(source('4HHB'))['residues']))
  self.assertTrue(any(r['kind']=='nucleic' for r in m.inspect(source('1BNA'))['residues']))
  self.assertTrue(any(r['name']=='NAG' for r in m.inspect(source('1HZH'))['residues']))
 def test_contacts_equal_bruteforce_and_geometry_has_angles(self):
  req=source('1CRN');d=m.inspect(req);r=next(r for r in d['residues'] if r['name']=='SER');v=m.construct({**req,'edits':[{'residue':r['id'],'modification':'phosphoserine'}]});vd=m.inspect({'text':v['text'],'format':'mmcif'});result=m.compare({'baseline':d['displayText'],'variant':v['text'],'residues':[r['id']]})
  aa=[a for a in vd['atoms'] if a['residue']==r['id'] and a['element']!='H'];bb=[a for a in vd['atoms'] if a['residue']!=r['id'] and a['element']!='H'];count=sum(np.linalg.norm(np.array(a['position'])-np.array(b['position']))<=4 for a in aa for b in bb)
  self.assertEqual(result['variantContacts'],count);self.assertGreater(len(result['bondAngles']),0);self.assertLess(result['commonHeavyAtomRmsdAngstrom'],1e-6)
 def test_proper_alignment_no_reflection(self):
  d=m.inspect(source('1CRN'));s=m.parse(d['displayText'],'mmcif')
  angle=.42;rotation=np.array([[math.cos(angle),-math.sin(angle),0],[math.sin(angle),math.cos(angle),0],[0,0,1]])
  for c in s[0]:
   for r in c:
    for a in r:a.pos=m.gemmi.Position(*(m.pos(a)@rotation+np.array([2,4,-3])))
  pairs=[[a['id'],a['id']] for a in d['atoms'] if a['name']=='CA'];fit=m.align({'reference':d['displayText'],'mobile':m.text_of(s),'pairs':pairs});self.assertLess(fit['rmsdAngstrom'],1e-5);self.assertAlmostEqual(np.linalg.det(fit['rotationRowVectors']),1)
 def test_nonfinite_and_bad_inputs(self):
  with self.assertRaises(m.MolecularError):m.measure({'positions':[[0,0,0],[float('nan'),0,0]]})
  with self.assertRaises((m.MolecularError,RuntimeError,ValueError)):m.parse('no atoms','pdb')
if __name__=='__main__':unittest.main(verbosity=2)
