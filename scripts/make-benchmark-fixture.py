"""Create a synthetic separated crambin grid for repeatable load checks."""
from pathlib import Path
import gemmi
root=Path(__file__).resolve().parents[1]
source=gemmi.read_structure(str(root/'fixtures/structures/1CRN.pdb'))
result=gemmi.Structure();result.name='Synthetic_99735_atoms_not_a_biological_assembly';model=gemmi.Model('1')
for i in range(305):
    chain=source[0][0].clone();chain.name=f'T{i}'
    for residue in chain:
        residue.subchain=f'T{i}'
        for atom in residue:
            atom.pos.x+=100*(i%10);atom.pos.y+=100*((i//10)%10);atom.pos.z+=100*(i//100)
    model.add_chain(chain)
result.add_model(model);result.setup_entities()
out=root/'work/benchmark/synthetic-99735.cif';out.parent.mkdir(parents=True,exist_ok=True);out.write_text(result.make_mmcif_document().as_string(),encoding='utf-8')
assert sum(1 for m in result for c in m for r in c for a in r)==99735
print(out)
