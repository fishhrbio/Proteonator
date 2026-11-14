import importlib.util
from pathlib import Path
import sys
import unittest
import numpy as np
root=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(root/'compute'))
import molecule as m

class ExpandedChemistry(unittest.TestCase):
 def test_terminal_proline_amide_has_real_parameters_and_expected_charge(self):
  import openmm as mm
  from openmm import unit
  text=(root/'fixtures/structures/1CRN.pdb').read_text(encoding='utf-8');pro=m.construct({'text':text,'format':'pdb','model':0,'assembly':'source','edits':[{'residue':'A/46','modification':'mutation:PRO'}]});amide=m.construct({'text':pro['text'],'format':'mmcif','model':0,'assembly':'source','edits':[{'residue':'A/46','modification':'terminal-amide'}]});_,acid_mod,acid_system=self.prepared(pro['text']);_,mod,system=self.prepared(amide['text']);last=next(r for r in mod.topology.residues() if r.id=='46');self.assertEqual(last.name,'PRO');self.assertTrue({'NT','HT1','HT2'}<=set(a.name for a in last.atoms()))
  def charge(system):
   nb=next(f for f in system.getForces() if isinstance(f,mm.NonbondedForce));return sum(nb.getParticleParameters(i)[0].value_in_unit(unit.elementary_charge) for i in range(system.getNumParticles()))
  self.assertAlmostEqual(charge(system)-charge(acid_system),1,places=8)
 def test_hydroxyproline_added_stereocenter_rejects_inversion(self):
  text=(root/'fixtures/structures/1CRN.pdb').read_text(encoding='utf-8');result=m.construct({'text':text,'format':'pdb','model':0,'assembly':'source','edits':[{'residue':'A/5','modification':'hydroxyproline'}]});before=m.parse(result['text'],'mmcif');after=before.clone();r=next(r for c in after[0] for r in c if r.name=='HYP');o=m.pos(r['CG'][0]);a=m.pos(r['CB'][0])-o;b=m.pos(r['CD'][0])-o;normal=np.cross(a,b);normal/=np.linalg.norm(normal);atom=r['OD1'][0];p=m.pos(atom);atom.pos=m.gemmi.Position(*(p-2*np.dot(p-o,normal)*normal))
  with self.assertRaisesRegex(m.MolecularError,'inverted.*CG'):m.check_stereochemistry(before,after)
 def test_hydroxyproline_preparation_preserves_dictionary_atom_identity_and_stereochemistry(self):
  import openmm as mm
  from openmm import unit
  text=(root/'fixtures/structures/1CRN.pdb').read_text(encoding='utf-8');result=m.construct({'text':text,'format':'pdb','model':0,'assembly':'source','edits':[{'residue':'A/5','modification':'hydroxyproline'}]});config={'text':result['text'],'pH':7,'seed':17,'radiusAngstrom':8,'restraintK':1000,'maxIterations':40,'tolerance':10,'forcefield':'charmm36.xml','residues':['A/5']}
  _,mod,system=self.prepared(result['text']);hyp=next(r for r in mod.topology.residues() if r.name=='HYP');self.assertIn('OE',[a.name for a in hyp.atoms()]);self.assertEqual(mod._proteonator_atom_aliases['A/5'],{'OD1':'OE'})
  def independent(system,topology,positions,cpu_state):
   integrator=mm.VerletIntegrator(.001*unit.picoseconds);context=mm.Context(system,integrator,mm.Platform.getPlatformByName('Reference'));context.setPositions(positions);reference=context.getState(getEnergy=True,getForces=True);er=reference.getPotentialEnergy().value_in_unit(unit.kilojoule_per_mole);ec=cpu_state.getPotentialEnergy().value_in_unit(unit.kilojoule_per_mole);self.assertLess(abs(er-ec),.05);forces=reference.getForces(asNumpy=True).value_in_unit(unit.kilojoule_per_mole/unit.nanometer);cpu=cpu_state.getForces(asNumpy=True).value_in_unit(unit.kilojoule_per_mole/unit.nanometer);self.assertLess(float(np.max(np.abs(forces-cpu))),.1);del context,integrator
  relaxed=m.relax(config,independent);atoms=m.inspect({'text':relaxed['text'],'format':'mmcif'})['atoms'];self.assertTrue(any(a['id']=='A/5/OD1' for a in atoms));self.assertFalse(any(a['id']=='A/5/OE' for a in atoms));self.assertGreater(relaxed['provenance']['retainedStereocentersChecked'],40)
 def prepared(self,text):return m.prepare_system({'text':text,'pH':7,'seed':17,'radiusAngstrom':8,'restraintK':1000,'maxIterations':10,'tolerance':10,'forcefield':'charmm36.xml'})
 def test_explicit_disulfides_survive_author_label_transfer_and_remove_thiol_hydrogens(self):
  text=(root/'fixtures/structures/1CRN.pdb').read_text(encoding='utf-8');data=m.inspect({'text':text,'format':'pdb'});_,mod,system=self.prepared(data['displayText']);pairs={frozenset([a.residue.id,b.residue.id]) for a,b in mod.topology.bonds() if a.name==b.name=='SG'};self.assertEqual(pairs,{frozenset(['3','40']),frozenset(['4','32']),frozenset(['16','26'])});self.assertEqual(sum(a.name=='HG' and a.residue.name=='CYS' for a in mod.topology.atoms()),0)
 def test_primary_amide_uses_real_CT2_parameters_two_hydrogens_and_expected_charge_change(self):
  import openmm as mm
  from openmm import unit
  text=(root/'fixtures/structures/1CRN.pdb').read_text(encoding='utf-8');req={'text':text,'format':'pdb','model':0,'assembly':'source'};base=m.inspect(req)['displayText'];result=m.construct({**req,'edits':[{'residue':'A/46','modification':'terminal-amide'}]});self.assertNotEqual(result['text'],base);_,mod,system=self.prepared(result['text']);_,base_mod,base_system=self.prepared(base)
  last=[r for r in mod.topology.residues() if r.id=='46'][0];atoms={a.name:a for a in last.atoms()};self.assertIn('NT',atoms);self.assertNotIn('OXT',atoms);self.assertIn('HT1',atoms);self.assertIn('HT2',atoms)
  bonds={frozenset([a.name,b.name]) for a,b in mod.topology.bonds() if a.residue==last and b.residue==last};self.assertTrue({frozenset(['C','NT']),frozenset(['NT','HT1']),frozenset(['NT','HT2'])}<=bonds)
  def charge(system):
   nb=next(f for f in system.getForces() if isinstance(f,mm.NonbondedForce));return sum(nb.getParticleParameters(i)[0].value_in_unit(unit.elementary_charge) for i in range(system.getNumParticles()))
  self.assertAlmostEqual(charge(system)-charge(base_system),1,places=8)
  with self.assertRaises(m.MolecularError):m.construct({**req,'edits':[{'residue':'A/2','modification':'terminal-amide'}]})
 def test_bounded_disulfide_construction_preserves_compatible_geometry_and_rejects_distant_pairs(self):
  text=(root/'fixtures/structures/1CRN.pdb').read_text(encoding='utf-8');state=m.parse(text,'pdb');del state.connections[0];source=m.text_of(state);req={'text':source,'format':'mmcif','model':0,'assembly':'source'};result=m.construct({**req,'edits':[{'residue':'A/3','modification':'disulfide','partner':'A/40'}]});_,mod,_=self.prepared(result['text']);self.assertEqual(sum(a.name==b.name=='SG' for a,b in mod.topology.bonds()),3)
  with self.assertRaises(m.MolecularError):m.construct({**req,'edits':[{'residue':'A/3','modification':'disulfide','partner':'A/4'}]})
 def source(self):return {'text':(root/'fixtures/structures/1BRS.pdb').read_text(encoding='utf-8'),'format':'pdb','model':0,'assembly':'source'}
 def test_every_canonical_mutation_has_exact_backbone_and_template_chirality(self):
  req=self.source();base=m.inspect(req);source=next(r for r in base['residues'] if r['name']=='SER');key=source['id'];original={a['id']:a for a in base['atoms'] if a['element'] not in ('H','D')}
  for target in sorted(m.CANONICAL-{'SER'}):
   with self.subTest(target=target):
    result=m.construct({**req,'edits':[{'residue':key,'modification':'mutation:'+target}]});data=m.inspect({'text':result['text'],'format':'mmcif'});atoms={a['id']:a for a in data['atoms']};template,_=m.component(target)
    for atom_id,atom in original.items():
     if atom['residue']!=key or atom['name'] in ['N','CA','C','O','OXT']:self.assertLess(np.linalg.norm(np.array(atom['position'])-np.array(atoms[atom_id]['position'])),1e-6)
    expected={n for n,a in template.items() if a['element']!='H' and n!='OXT'};actual={a['name'] for a in data['atoms'] if a['residue']==key and a['element']!='H' and a['name']!='OXT'};self.assertEqual(actual,expected)
    if target!='GLY':
     def volume(points):
      ca,n,c,cb=[np.array(points[x]) for x in ['CA','N','C','CB']];return np.dot(n-ca,np.cross(c-ca,cb-ca))
     actual_positions={a['name']:a['position'] for a in data['atoms'] if a['residue']==key};ideal={n:a['position'] for n,a in template.items()};self.assertGreater(volume(actual_positions)*volume(ideal),0)
  self.assertEqual(req,self.source())
 def test_mutation_rejects_unsupported_targets_and_explicit_disulfide_partners(self):
  req=self.source()
  with self.assertRaises(m.MolecularError):m.construct({**req,'edits':[{'residue':'A/14','modification':'mutation:DALA'}]})
  text=(root/'fixtures/structures/1CRN.pdb').read_text(encoding='utf-8')
  with self.assertRaisesRegex(m.MolecularError,'side-chain connection'):m.construct({'text':text,'format':'pdb','model':0,'assembly':'source','edits':[{'residue':'A/3','modification':'mutation:SER'}]})
 def test_contact_cutoff_changes_distance_rows_without_changing_steric_definition(self):
  req=self.source();base=m.inspect(req)['displayText'];data4=m.compare({'baseline':base,'variant':base,'residues':['A/14'],'contactCutoffAngstrom':4});data5=m.compare({'baseline':base,'variant':base,'residues':['A/14'],'contactCutoffAngstrom':5});self.assertGreaterEqual(data5['variantContacts'],data4['variantContacts']);self.assertTrue(all(r['distance']<=5 for r in data5['variantPairs']));self.assertEqual(data5['gained'],[])
  with self.assertRaises(m.MolecularError):m.compare({'baseline':base,'variant':base,'residues':['A/14'],'contactCutoffAngstrom':float('nan')})

if __name__=='__main__':unittest.main(verbosity=2)
