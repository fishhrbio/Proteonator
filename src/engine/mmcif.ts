import { createHash } from 'node:crypto';
import { ImportMetadataSchema, NormalizedStructureSchema, type Atom, type Diagnostic, type ImportMetadata, type NormalizedStructure, type Residue } from '../contracts/index.js';
import { EngineError, invalidInput } from './errors.js';
import { CANONICAL_PROTEIN_RESIDUES, MAX_IMPORT_ATOMS, MAX_IMPORT_BYTES } from './pdb.js';

const WATER = new Set(['HOH', 'WAT', 'DOD']);
const MODIFIED = new Set(['MSE', 'SEP', 'TPO', 'PTR', 'HYP', 'CSO', 'CME', 'KCX', 'MLY', 'M3L', 'HIC', 'FME', 'PCA', 'LLP']);
const keyPart = (v: string) => v === '' ? '~' : encodeURIComponent(v).replace(/~/g, '%7E');
const clean = (v: string | undefined) => !v || v === '.' || v === '?' ? '' : v;

/** Tokenize the relevant CIF 1.1 syntax without interpreting data-block values as control words. */
export function cifTokens(text: string): { value: string; line: number; quoted:boolean }[] {
  const out: { value: string; line: number; quoted:boolean }[] = [];
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.startsWith(';')) {
      const start = i + 1;
      let value = line.slice(1);
      while (++i < lines.length && !lines[i]!.startsWith(';')) value += `\n${lines[i]}`;
      if (i >= lines.length) invalidInput(`Unterminated mmCIF text field at line ${start}`);
      if(lines[i]!.slice(1).trim() && !lines[i]!.slice(1).trim().startsWith('#')) invalidInput(`Invalid mmCIF text terminator at line ${i+1}`);
      out.push({ value, line: start, quoted:true });
      continue;
    }
    let p = 0;
    while (p < line.length) {
      while (/\s/.test(line[p] ?? '') && p < line.length) p++;
      if (p >= line.length || line[p] === '#') break;
      const start = p, quote = line[p] === '"' || line[p] === "'" ? line[p++] : null;
      if (quote) {
        while (p < line.length && !(line[p] === quote && (p + 1 === line.length || /\s/.test(line[p + 1]!)))) p++;
        if (p >= line.length) invalidInput(`Unterminated mmCIF quoted value at line ${i + 1}`);
        out.push({ value: line.slice(start + 1, p), line: i + 1, quoted:true }); p++;
      } else {
        while (p < line.length && !/\s/.test(line[p]!)) p++;
        out.push({ value: line.slice(start, p), line: i + 1, quoted:false });
      }
    }
  }
  return out;
}

function atomRows(text: string): { fields: string[]; rows: { values: string[]; line: number }[] } {
  const tokens = cifTokens(text);
  const control=(t:typeof tokens[number])=>!t.quoted && (/^(loop_|stop_|global_)$/i.test(t.value)||/^data_|^save_/i.test(t.value)||t.value.startsWith('_'));
  let found:{fields:string[];rows:{values:string[];line:number}[]}|null=null;
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i]!.quoted || tokens[i]!.value.toLowerCase() !== 'loop_') continue;
    const fields: string[] = [];
    while (tokens[i + 1] && !tokens[i+1]!.quoted && tokens[i + 1]!.value.startsWith('_')) fields.push(tokens[++i]!.value.toLowerCase());
    if(!fields.length) invalidInput('mmCIF loop has no column names');
    if(new Set(fields).size!==fields.length) invalidInput('Duplicate mmCIF loop column');
    const coordinateLoop=fields.some(f=>f.startsWith('_atom_site.'));
    if(coordinateLoop && fields.some(f=>!f.startsWith('_atom_site.'))) invalidInput('Mixed categories in atom_site loop');
    const rows: { values: string[]; line: number }[] = [];
    while (i + 1 < tokens.length) {
      if (control(tokens[i+1]!)) break;
      const cells=tokens.slice(i+1,i+1+fields.length);
      if(cells.length!==fields.length || cells.some(control)) invalidInput('Incomplete mmCIF loop row');
      if(coordinateLoop)rows.push({values:cells.map(t=>t.quoted?t.value:clean(t.value)),line:tokens[i+1]!.line});
      i+=fields.length;
    }
    if(coordinateLoop){if(found)invalidInput('Multiple atom_site loops or coordinate blocks are unsupported; split the file explicitly');found={fields,rows};}
  }
  if(found)return found;
  throw new EngineError({ code: 'MISSING_COORDINATES', message: 'No atom_site coordinate loop found', recovery: 'Import a coordinate-bearing mmCIF file.' });
}

export function parseMmcif(text: string, metadata: ImportMetadata): NormalizedStructure {
  const meta = ImportMetadataSchema.safeParse(metadata);
  if (!meta.success) invalidInput(`Invalid import metadata: ${meta.error.issues[0]?.message}`);
  if (!text.trim()) invalidInput('Structure text is empty');
  const bytes = Buffer.byteLength(text, 'utf8');
  if (bytes > MAX_IMPORT_BYTES) throw new EngineError({ code: 'RESOURCE_LIMIT', message: 'mmCIF exceeds the 10 MiB parser limit', recovery: 'Use a smaller coordinate file.', details: { bytes } });
  const sha256 = createHash('sha256').update(text, 'utf8').digest('hex');
  const id = `str_${sha256.slice(0, 24)}`;
  const { fields, rows } = atomRows(text);
  const column = (name: string) => fields.indexOf(`_atom_site.${name.toLowerCase()}`);
  const required = ['group_PDB', 'id', 'type_symbol', 'label_atom_id', 'label_comp_id', 'label_asym_id', 'Cartn_x', 'Cartn_y', 'Cartn_z'];
  for (const f of required) if (column(f) < 0) invalidInput(`mmCIF atom_site lacks ${f}`);
  const models: { id: string; sourceModelNumber: number }[] = [];
  const chains: NormalizedStructure['chains'][number][] = [], residues: Residue[] = [], atoms: Atom[] = [];
  const diagnostics: Diagnostic[] = [];
  const chainMap = new Map<string, NormalizedStructure['chains'][number]>(), residueMap = new Map<string, Residue>();
  const atomIdentity = new Set<string>(), modelNumbers = new Map<number, string>();
  const byResidue = new Map<string, Atom[]>();
  const get = (values: string[], name: string) => values[column(name)]??'';
  const serials=new Set<string>();
  const number = (raw: string, field: string, line: number, optional = false) => {
    if (!raw && optional) return null;
    if (!raw || !/^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?$/.test(raw) || !Number.isFinite(Number(raw))) invalidInput(`Invalid ${field} on mmCIF line ${line}`);
    return Number(raw);
  };
  for (const row of rows) {
    const v = row.values, group = get(v, 'group_PDB').toUpperCase();
    if (group !== 'ATOM' && group !== 'HETATM') { diagnostics.push({ code: 'NON_ATOM_SITE_ROW', severity: 'info', message: 'Non-coordinate atom_site row skipped.', line: row.line }); continue; }
    if (atoms.length >= MAX_IMPORT_ATOMS) throw new EngineError({ code: 'RESOURCE_LIMIT', message: 'mmCIF exceeds 100,000 atoms', recovery: 'Select a smaller assembly.' });
    const modelNumber = number(get(v, 'pdbx_PDB_model_num') || '1', 'model number', row.line)!;
    if (!Number.isInteger(modelNumber)) invalidInput(`Noninteger model number on mmCIF line ${row.line}`);
    if (!modelNumbers.has(modelNumber)) { const modelId = `model_${modelNumbers.size + 1}`; modelNumbers.set(modelNumber, modelId); models.push({ id: modelId, sourceModelNumber: modelNumber }); }
    const modelId = modelNumbers.get(modelNumber)!;
    const labelAsymId = get(v, 'label_asym_id'), authAsymId = get(v, 'auth_asym_id') || labelAsymId;
    const chainKey = `${id}/${modelId}/chain/${keyPart(labelAsymId)}/auth/${keyPart(authAsymId)}`;
    if (!chainMap.has(chainKey)) { const chain = { key: chainKey, modelId, authAsymId, labelAsymId, segmentIndex: 0 }; chainMap.set(chainKey, chain); chains.push(chain); }
    const name = get(v, 'auth_comp_id') || get(v, 'label_comp_id');
    const authSeqId = get(v, 'auth_seq_id') || get(v, 'label_seq_id') || get(v, 'id');
    const labelSeqRaw = get(v, 'label_seq_id');
    const labelSeqId = labelSeqRaw ? number(labelSeqRaw, 'label_seq_id', row.line) : null;
    if (labelSeqId !== null && !Number.isInteger(labelSeqId)) invalidInput(`Noninteger label_seq_id on mmCIF line ${row.line}`);
    const insertionCode = get(v, 'pdbx_PDB_ins_code');
    const residueKey = `${chainKey}/residue/${keyPart(authSeqId)}/ins/${keyPart(insertionCode)}/name/${keyPart(name)}`;
    if (!residueMap.has(residueKey)) {
      const classification: Residue['classification'] = WATER.has(name) ? 'water' : group === 'ATOM' && CANONICAL_PROTEIN_RESIDUES.has(name) ? 'protein' : MODIFIED.has(name) ? 'modified-residue' : group === 'HETATM' ? 'ligand' : 'unknown';
      const residue = { key: residueKey, chainKey, modelId, authSeqId, labelSeqId, insertionCode, name, classification, preferredAltLoc: '' };
      residueMap.set(residueKey, residue); residues.push(residue);
    }
    const serial = get(v, 'id'), atomName = get(v, 'auth_atom_id') || get(v, 'label_atom_id'), altLoc = get(v, 'label_alt_id');
    if (!serial || !atomName || !name || !authSeqId) invalidInput(`Incomplete atom identity on mmCIF line ${row.line}`);
    if(serials.has(`${modelId}\0${serial}`)) invalidInput(`Duplicate atom_site.id in ${modelId}`);
    serials.add(`${modelId}\0${serial}`);
    if(residueMap.get(residueKey)!.labelSeqId!==labelSeqId) invalidInput('Conflicting label residue identities for one author residue');
    const identity = `${residueKey}\0${atomName}\0${altLoc}`;
    if (atomIdentity.has(identity)) throw new EngineError({ code: 'AMBIGUOUS_MAPPING', message: 'Duplicate atom identity in mmCIF', recovery: 'Resolve duplicate atom name/alternate records.', details: { line: row.line } });
    atomIdentity.add(identity);
    const sourceElement = get(v, 'type_symbol');
    const element = /^[A-Za-z]{1,2}$/.test(sourceElement) ? sourceElement.toUpperCase() : null;
    const occupancy = number(get(v, 'occupancy'), 'occupancy', row.line, true);
    if (occupancy !== null && (occupancy < 0 || occupancy > 1)) invalidInput(`Occupancy outside [0,1] on mmCIF line ${row.line}`);
    const atom: Atom = { key: `${residueKey}/atom/${keyPart(atomName)}/alt/${keyPart(altLoc)}/serial/${keyPart(serial)}`, residueKey, chainKey, modelId,
      serial, name: atomName, element, sourceElement, position: { x: number(get(v, 'Cartn_x'), 'x', row.line)!, y: number(get(v, 'Cartn_y'), 'y', row.line)!, z: number(get(v, 'Cartn_z'), 'z', row.line)! },
      altLoc, occupancy, bFactor: number(get(v, 'B_iso_or_equiv'), 'B-factor', row.line, true), recordType: group, sourceLine: row.line };
    atoms.push(atom);
    const list = byResidue.get(residueKey) ?? []; list.push(atom); byResidue.set(residueKey, list);
  }
  if (!atoms.length) throw new EngineError({ code: 'MISSING_COORDINATES', message: 'No coordinate records found', recovery: 'Use a coordinate-bearing mmCIF.' });
  const selectedResidues = residues.map(r => {
    const scores = new Map<string, { sum: number; count: number }>();
    for (const a of byResidue.get(r.key) ?? []) if (a.altLoc) { const s = scores.get(a.altLoc) ?? { sum: 0, count: 0 }; s.sum += a.occupancy ?? 1; s.count++; scores.set(a.altLoc, s); }
    const ordered = [...scores].sort(([a, x], [b, y]) => y.sum / y.count - x.sum / x.count || (a === 'A' ? -1 : b === 'A' ? 1 : a.localeCompare(b)));
    return { ...r, preferredAltLoc: ordered[0]?.[0] ?? '' };
  });
  if (models.length > 1) diagnostics.push({ code: 'MULTIPLE_MODELS', severity: 'info', message: 'All models retained; first encountered model selected.', count: models.length });
  if(atoms.some(a=>a.altLoc))diagnostics.push({code:'ALTERNATE_CONFORMERS',severity:'info',message:'Residue mean occupancy selects one alternate; shared blank atoms take precedence. Zero occupancy atoms are inactive.'});
  if(atoms.some(a=>a.occupancy===null))diagnostics.push({code:'MISSING_OCCUPANCY',severity:'info',message:'Missing occupancy is retained as unknown and treated as active.'});
  if(residues.some(r=>r.classification==='unknown'||r.classification==='modified-residue'))diagnostics.push({code:'UNSUPPORTED_RESIDUE_CHEMISTRY',severity:'warning',message:'Modified or unclassified residue coordinates are retained and excluded from canonical-protein geometry.'});
  diagnostics.push({ code: 'INCOMPLETE_TOPOLOGY', severity: 'warning', message: 'mmCIF bond topology is not reconstructed; overlap candidates are geometric only.' });
  return NormalizedStructureSchema.parse({ schemaVersion: '1.0.0', id, coordinateUnit: 'angstrom', evidenceClass: meta.data.evidenceClass ?? (meta.data.kind === 'synthetic-test' ? 'synthetic-fixture' : 'supplied-coordinates'),
    source: { ...meta.data, format: 'mmcif', sha256 }, models, selectedModelId: models[0]!.id, chains, residues: selectedResidues, atoms, bonds: [], topology: { completeness: 'unknown', source: 'none' },
    altLocPolicy: 'residue-mean-occupancy;tie-A-then-lexical;shared-blank-wins;zero-occupancy-excluded', diagnostics });
}
