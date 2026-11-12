from pathlib import Path
import importlib.util,json,math
import numpy as np
import openmm as mm
from openmm import unit
spec=importlib.util.spec_from_file_location('molecule',Path(__file__).with_name('molecule.py'));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
root=Path(__file__).resolve().parents[1];out=root/'work'/'physics';out.mkdir(parents=True,exist_ok=True)
settings={'seed':20261112,'pH':7,'radiusAngstrom':8,'restraintK':1000,'maxIterations':200,'tolerance':10,'forcefield':'charmm36_2024.xml'}
cases=[]
def independent(system,topology,positions,cpuState):
 integrator=mm.VerletIntegrator(.001*unit.picoseconds);context=mm.Context(system,integrator,mm.Platform.getPlatformByName('Reference'));context.setPositions(positions);state=context.getState(getEnergy=True,getForces=True)
 er=state.getPotentialEnergy().value_in_unit(unit.kilojoule_per_mole);ec=cpuState.getPotentialEnergy().value_in_unit(unit.kilojoule_per_mole);fr=state.getForces(asNumpy=True).value_in_unit(unit.kilojoule_per_mole/unit.nanometer);fc=cpuState.getForces(asNumpy=True).value_in_unit(unit.kilojoule_per_mole/unit.nanometer)
 assert abs(er-ec)<.05,abs(er-ec);assert np.max(np.abs(fr-fc))<.1,np.max(np.abs(fr-fc))
 p=np.array(positions.value_in_unit(unit.nanometer));index=next(a.index for a in topology.atoms() if a.residue.name=='SEP' and a.name=='P');step=1e-6;energies=[]
 for delta in [-step,step]:
  q=p.copy();q[index,0]+=delta;context.setPositions(q*unit.nanometer);energies.append(context.getState(getEnergy=True).getPotentialEnergy().value_in_unit(unit.kilojoule_per_mole))
 numerical=-(energies[1]-energies[0])/(2*step);assert abs(numerical-fr[index,0])<.02
 numericalResults.update({'cpuReferenceEnergyDifference_kJ_mol':abs(er-ec),'maxForceDifference_kJ_mol_nm':float(np.max(np.abs(fr-fc))),'finiteDifferenceError_kJ_mol_nm':abs(numerical-fr[index,0]),'scope':'Final relaxed configuration; identical prepared topology and restraints'})
 del context,integrator
for modification in ['phosphoserine','phosphothreonine','phosphotyrosine','acetyllysine']:
 name='1UBQ' if modification=='acetyllysine' else '1CRN';req={'text':(root/'fixtures/structures'/f'{name}.pdb').read_text(),'format':'pdb','model':0,'assembly':'source'};data=m.inspect(req);residue=next(r for r in data['residues'][1:-1] if r['name']==m.MODS[modification][0] and (modification!='phosphothreonine' or r['id']=='A/21'));variant=m.construct({**req,'edits':[{'residue':residue['id'],'modification':modification}]})
 config={**settings,'forcefield':'charmm36.xml' if modification=='acetyllysine' else 'charmm36_2024.xml','text':variant['text'],'residues':[residue['id']]}
 numericalResults={};result=m.relax(config,independent if modification=='phosphoserine' else None);result['baselineControl']=m.relax({**config,'text':data['displayText']})
 assert result['provenance']['constraints']==0
 assert abs(result['provenance']['netChargeElementary']-result['baselineControl']['provenance']['netChargeElementary']+1)<1e-6
 assert len(m.inspect({'text':result['text'],'format':'mmcif'})['atoms'])>len(data['atoms'])
 assert result['provenance']['finalPotentialEnergy_kJ_mol']<=result['provenance']['initialPotentialEnergy_kJ_mol']+1e-6
 assert result['baselineControl']['provenance']['finalPotentialEnergy_kJ_mol']<=result['baselineControl']['provenance']['initialPotentialEnergy_kJ_mol']+1e-6
 assert all(math.isfinite(result['provenance'][k]) for k in ['initialPotentialEnergy_kJ_mol','finalPotentialEnergy_kJ_mol','rmsForce_kJ_mol_nm'])
 (out/(modification+'.json')).write_text(json.dumps(result,indent=2),encoding='utf-8')
 record={'modification':modification,'residue':residue['id'],'fixture':name,'result':result['provenance'],'baselineControl':result['baselineControl']['provenance'],'independentChecks':numericalResults};cases.append(record);print(json.dumps({'case':modification,'converged':result['provenance']['converged'],'energy':result['provenance']['finalPotentialEnergy_kJ_mol'],'numericalChecks':numericalResults}),flush=True)
(out/'verification.json').write_text(json.dumps({'status':'passed','cases':cases},indent=2),encoding='utf-8');print('PASS local-response controls, Reference/CPU and finite-difference validation',flush=True)
