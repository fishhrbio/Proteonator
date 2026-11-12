import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseMmcif, parsePdb, alignStructures } from '../src/engine/index.js';
import { pdbAtom } from './engine-helpers.js';

const meta={name:'synthetic.cif',kind:'synthetic-test' as const};
const cif=`data_test
loop_
_atom_site.group_PDB
_atom_site.id
_atom_site.type_symbol
_atom_site.label_atom_id
_atom_site.label_alt_id
_atom_site.label_comp_id
_atom_site.label_asym_id
_atom_site.label_seq_id
_atom_site.pdbx_PDB_ins_code
_atom_site.Cartn_x
_atom_site.Cartn_y
_atom_site.Cartn_z
_atom_site.occupancy
_atom_site.B_iso_or_equiv
_atom_site.auth_seq_id
_atom_site.auth_comp_id
_atom_site.auth_asym_id
_atom_site.auth_atom_id
_atom_site.pdbx_PDB_model_num
ATOM 1 C CA . ALA LONG 1 A 1.0 2.0 3.0 1.0 20.0 9 ALA A CA 1
ATOM 2 C CA . ALA LONG 1 A 2.0 3.0 4.0 1.0 20.0 9 ALA A CA 2
#
`;

test('mmCIF retains label/auth mapping, insertion and models with stable keys',()=>{
  const a=parseMmcif(cif,meta),b=parseMmcif(cif,{...meta,name:'renamed.cif'});
  assert.equal(a.atoms.length,2);assert.equal(a.models.length,2);
  assert.equal(a.chains[0]!.labelAsymId,'LONG');assert.equal(a.chains[0]!.authAsymId,'A');
  assert.equal(a.residues[0]!.authSeqId,'9');assert.equal(a.residues[0]!.labelSeqId,1);
  assert.equal(a.residues[0]!.insertionCode,'A');assert.equal(a.atoms[0]!.key,b.atoms[0]!.key);
  assert.equal(a.evidenceClass,'synthetic-fixture');
  assert.throws(()=>parseMmcif(cif.replace('1.0 2.0 3.0','nan 2.0 3.0'),meta),/Invalid x/);
});

test('public 1CRN mmCIF and PDB agree on coordinate count and first canonical residue',()=>{
  const cifText=readFileSync(new URL('../fixtures/structures/1CRN.cif',import.meta.url),'utf8');
  const pdbText=readFileSync(new URL('../fixtures/structures/1CRN.pdb',import.meta.url),'utf8');
  const mm=parseMmcif(cifText,{name:'1CRN.cif',kind:'bundled-fixture',accession:'1CRN',evidenceClass:'observed-structure'});
  const pdb=parsePdb(pdbText,{name:'1CRN.pdb',kind:'bundled-fixture',accession:'1CRN',evidenceClass:'observed-structure'});
  assert.equal(mm.atoms.length,pdb.atoms.length);assert.equal(mm.residues.length,pdb.residues.length);
  assert.equal(mm.residues[0]!.name,pdb.residues[0]!.name);
  assert.deepEqual(mm.atoms[0]!.position,pdb.atoms[0]!.position);
  assert.equal(mm.evidenceClass,'observed-structure');
});

const coords:[[number,number,number],[number,number,number],[number,number,number],[number,number,number]]=[[0,0,0],[1,0,0],[0,2,0],[0,0,3]];
function structure(points:typeof coords){return parsePdb(points.map(([x,y,z],i)=>pdbAtom({serial:i+1,name:['C','N','O','S'][i],seq:i+1,x,y,z})).join('\n'),{name:'coordinates.pdb',kind:'synthetic-test'});}
const correspondence=(r:ReturnType<typeof structure>,m:ReturnType<typeof structure>)=>r.atoms.map((a,i)=>({referenceAtomKey:a.key,mobileAtomKey:m.atoms[i]!.key}));

test('explicit rigid alignment recovers a proper transform and rejects reflection as an exact fit',()=>{
  const reference=structure(coords);
  const mobile=structure(coords.map(([x,y,z])=>[-y+10,x+5,z-3]) as typeof coords);
  const request={schemaVersion:'1.0.0' as const,jobId:'align_1',kind:'rigid-alignment' as const,referenceStructureId:reference.id,mobileStructureId:mobile.id,
    atomCorrespondence:correspondence(reference,mobile),method:'kabsch-no-reflection' as const,atomPolicy:'explicit-correspondence-only' as const};
  const fit=alignStructures(reference,mobile,request);
  assert.ok(fit.rmsdAngstrom<1e-6,`RMSD ${fit.rmsdAngstrom}`);
  assert.deepEqual(fit.transformMobileToReference.rotation.map(x=>Math.abs(x)<1e-8?0:Math.round(x)),[0,1,0,-1,0,0,0,0,1]);
  assert.deepEqual(Object.values(fit.transformMobileToReference.translation).map(x=>Math.round(x)),[-5,10,3]);
  const reflected=structure(coords.map(([x,y,z])=>[-x,y,z]) as typeof coords);
  const reflectedFit=alignStructures(reference,reflected,{...request,mobileStructureId:reflected.id,atomCorrespondence:correspondence(reference,reflected)});
  assert.ok(reflectedFit.rmsdAngstrom>0.1);
  assert.throws(()=>alignStructures(reference,mobile,{...request,atomCorrespondence:request.atomCorrespondence.map((p,i)=>i===1?{...p,referenceAtomKey:request.atomCorrespondence[0]!.referenceAtomKey}:p)}),/one-to-one/);
});
