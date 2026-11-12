import type { Atom, NormalizedStructure } from '../contracts/index.js';

/** Browser-safe selector over the authoritative atoms, never a second coordinate model. */
export function getActiveAtoms(structure: NormalizedStructure, modelId = structure.selectedModelId): readonly Atom[] {
  const residues = new Map(structure.residues.filter(r=>r.modelId===modelId).map(r=>[r.key,r]));
  const eligible = structure.atoms.filter(a=>a.modelId===modelId && (a.occupancy===null || a.occupancy>0));
  const blankNames = new Set(eligible.filter(a=>a.altLoc==='').map(a=>`${a.residueKey}\0${a.name}`));
  return eligible.filter(a=>a.altLoc==='' || (a.altLoc===residues.get(a.residueKey)?.preferredAltLoc && !blankNames.has(`${a.residueKey}\0${a.name}`)));
}
