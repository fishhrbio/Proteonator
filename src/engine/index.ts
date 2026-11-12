import { CoordinateModificationRequestSchema, ImportRequestSchema, PtmAnnotationSchema, type CoordinateModificationRequest, type ImportRequest, type NormalizedStructure, type PtmAnnotation } from '../contracts/index.js';
import { EngineError, invalidInput } from './errors.js';
import { parsePdb } from './pdb.js';
import { parseMmcif } from './mmcif.js';
export { parsePdb, MAX_IMPORT_BYTES, MAX_IMPORT_ATOMS } from './pdb.js';
export { parseMmcif } from './mmcif.js';
export { getActiveAtoms } from './selection.js';
export { runGeometry, VDW_RADII_ANGSTROM, MAX_GEOMETRY_PAIRS, MAX_OUTPUT_PAIRS } from './geometry.js';
export { alignStructures } from './alignment.js';
export { parseProject, MAX_PROJECT_BYTES } from './project.js';
export { EngineError, toAppError } from './errors.js';

export function importStructure(request:ImportRequest):NormalizedStructure{
  const parsed=ImportRequestSchema.safeParse(request);
  if(!parsed.success) invalidInput(`Invalid import request: ${parsed.error.issues[0]?.message}`);
  if(parsed.data.format==='fasta') throw new EngineError({code:'MISSING_COORDINATES',message:'A FASTA sequence does not supply molecular coordinates',recovery:'Supply a structure with explicit provenance.'});
  return parsed.data.format==='pdb' ? parsePdb(parsed.data.text,parsed.data.metadata) : parseMmcif(parsed.data.text,parsed.data.metadata);
}
export function annotatePtm(structure:NormalizedStructure,request:PtmAnnotation):PtmAnnotation{
  const parsed=PtmAnnotationSchema.safeParse(request);
  if(!parsed.success) invalidInput(`Invalid annotation: ${parsed.error.issues[0]?.message}`);
  if(parsed.data.structureId!==structure.id||!structure.residues.some(r=>r.key===parsed.data.residueKey)) invalidInput('Annotation must reference a residue in its source structure');
  return parsed.data;
}
export function constructPtm(request:CoordinateModificationRequest):never{
  const parsed=CoordinateModificationRequestSchema.safeParse(request);
  if(!parsed.success) invalidInput(`Invalid coordinate modification request: ${parsed.error.issues[0]?.message}`);
  throw new EngineError({code:'UNSUPPORTED_CHEMISTRY',message:`${parsed.data.chemistry} coordinate construction is not implemented`,recovery:'Create a PTM annotation or import independently prepared coordinates with explicit provenance. No atoms were added or moved.',details:{chemistry:parsed.data.chemistry}});
}
