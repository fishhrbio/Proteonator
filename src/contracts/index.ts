import { z } from 'zod';

/** Stable serialized contract version. Changes require a migration decision. */
export const CONTRACT_VERSION = '1.0.0' as const;
export const PROJECT_VERSION = '2.0.0' as const;
export const VersionSchema = z.literal(CONTRACT_VERSION);
export const CoordinateUnitSchema = z.literal('angstrom');
export const IdSchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/);
export const KeySchema = z.string().min(1).max(1024).regex(/^[A-Za-z0-9_:/%.+~-]+$/);
export const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
export const TimestampSchema = z.iso.datetime();
export const PositionSchema = z.strictObject({ x: z.number(), y: z.number(), z: z.number() }).readonly();
export const ErrorCodeSchema = z.enum([
  'INVALID_INPUT', 'UNSUPPORTED_FORMAT', 'UNSUPPORTED_CHEMISTRY', 'MISSING_COORDINATES',
  'AMBIGUOUS_MAPPING', 'COMPUTATION_FAILED', 'CANCELLED', 'RESOURCE_LIMIT',
  'OPTIONAL_SERVICE_MISSING', 'OFFLINE', 'UPLOAD_NOT_AUTHORIZED', 'UNSUPPORTED_PROJECT_VERSION',
]);
export const AppErrorSchema = z.strictObject({
  code: ErrorCodeSchema,
  message: z.string().min(1),
  recovery: z.string().min(1),
  details: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
}).readonly();
export type AppError = z.infer<typeof AppErrorSchema>;
export const DiagnosticSchema = z.strictObject({
  code: z.string().min(1), severity: z.enum(['info', 'warning']), message: z.string().min(1),
  line: z.int().positive().optional(), count: z.int().nonnegative().optional(),
}).readonly();
export type Diagnostic = z.infer<typeof DiagnosticSchema>;

export const ImportMetadataSchema = z.strictObject({
  name: z.string().min(1).max(512),
  kind: z.enum(['local-file', 'bundled-fixture', 'remote-accession', 'synthetic-test']),
  sourceUrl: z.url().optional(), accession: z.string().min(1).max(128).optional(),
  retrievedAt: TimestampSchema.optional(),
  evidenceClass: z.enum(['observed-structure', 'supplied-coordinates', 'model-based-prediction', 'synthetic-fixture']).optional(),
}).readonly();
export type ImportMetadata = z.infer<typeof ImportMetadataSchema>;
export const ImportRequestSchema = z.strictObject({
  schemaVersion: VersionSchema, jobId: IdSchema, format: z.enum(['pdb', 'mmcif', 'fasta']),
  text: z.string().min(1).max(10 * 1024 * 1024), metadata: ImportMetadataSchema,
}).readonly();
export type ImportRequest = z.infer<typeof ImportRequestSchema>;
export const StructureSourceSchema = ImportMetadataSchema.unwrap().extend({
  format: z.enum(['pdb', 'mmcif']), sha256: Sha256Schema,
}).readonly();
export const ModelSchema = z.strictObject({ id: IdSchema, sourceModelNumber: z.int() }).readonly();
export const ChainSchema = z.strictObject({
  key: KeySchema, modelId: IdSchema, authAsymId: z.string().max(128),
  labelAsymId: z.string().max(128).nullable(), segmentIndex: z.int().nonnegative(),
}).readonly();
export const ResidueSchema = z.strictObject({
  key: KeySchema, chainKey: KeySchema, modelId: IdSchema,
  authSeqId: z.string().min(1).max(128), labelSeqId: z.int().nullable(),
  insertionCode: z.string().max(8), name: z.string().min(1).max(32),
  classification: z.enum(['protein', 'water', 'ligand', 'modified-residue', 'unknown']),
  preferredAltLoc: z.string().max(16),
}).readonly();
export type Residue = z.infer<typeof ResidueSchema>;
export const AtomSchema = z.strictObject({
  key: KeySchema, residueKey: KeySchema, chainKey: KeySchema, modelId: IdSchema,
  serial: z.string().min(1).max(128), name: z.string().min(1).max(32),
  element: z.string().regex(/^[A-Z][A-Z]?$/).nullable(), sourceElement: z.string().max(8),
  position: PositionSchema, altLoc: z.string().max(16),
  occupancy: z.number().min(0).max(1).nullable(), bFactor: z.number().nullable(),
  recordType: z.enum(['ATOM', 'HETATM']), sourceLine: z.int().positive(),
}).readonly();
export type Atom = z.infer<typeof AtomSchema>;
export const BondSchema = z.strictObject({
  atomAKey: KeySchema, atomBKey: KeySchema, source: z.literal('pdb-conect'),
  order: z.literal('unknown'),
}).readonly();
export const AltLocPolicySchema = z.literal('residue-mean-occupancy;tie-A-then-lexical;shared-blank-wins;zero-occupancy-excluded');
export const NormalizedStructureSchema = z.strictObject({
  schemaVersion: VersionSchema, id: IdSchema, coordinateUnit: CoordinateUnitSchema,
  evidenceClass: z.enum(['observed-structure', 'supplied-coordinates', 'model-based-prediction', 'synthetic-fixture']), source: StructureSourceSchema,
  models: z.array(ModelSchema).min(1).readonly(), selectedModelId: IdSchema,
  chains: z.array(ChainSchema).min(1).readonly(), residues: z.array(ResidueSchema).min(1).readonly(),
  atoms: z.array(AtomSchema).min(1).max(100_000).readonly(), bonds: z.array(BondSchema).readonly(),
  topology: z.strictObject({
    completeness: z.enum(['unknown', 'partial']), source: z.enum(['none', 'pdb-conect']),
  }).readonly(),
  altLocPolicy: AltLocPolicySchema, diagnostics: z.array(DiagnosticSchema).readonly(),
}).superRefine((s, ctx) => {
  const issue = (message: string, path: (string | number)[] = []) => ctx.addIssue({ code: 'custom', message, path });
  const unique = (items: readonly string[], name: string) => {
    if (new Set(items).size !== items.length) issue(`Duplicate ${name} identifiers`, [name]);
  };
  unique(s.models.map(x => x.id), 'models'); unique(s.chains.map(x => x.key), 'chains');
  unique(s.residues.map(x => x.key), 'residues'); unique(s.atoms.map(x => x.key), 'atoms');
  const models = new Set(s.models.map(x => x.id));
  const chains = new Map(s.chains.map(x => [x.key, x]));
  const residues = new Map(s.residues.map(x => [x.key, x]));
  const atoms = new Map(s.atoms.map(x => [x.key, x]));
  if (!models.has(s.selectedModelId)) issue('selectedModelId does not exist', ['selectedModelId']);
  for (const c of s.chains) if (!models.has(c.modelId)) issue(`Unknown model for chain ${c.key}`, ['chains']);
  for (const r of s.residues) if (chains.get(r.chainKey)?.modelId !== r.modelId) issue(`Invalid chain/model reference for residue ${r.key}`, ['residues']);
  for (const a of s.atoms) {
    const r = residues.get(a.residueKey);
    if (!r || r.chainKey !== a.chainKey || r.modelId !== a.modelId) issue(`Invalid residue/chain/model reference for atom ${a.key}`, ['atoms']);
  }
  for (const b of s.bonds) {
    const a = atoms.get(b.atomAKey), c = atoms.get(b.atomBKey);
    if (!a || !c || a.modelId !== c.modelId || a.key === c.key) issue('Bond references must identify distinct atoms in one model', ['bonds']);
  }
  if ((s.topology.source === 'none') !== (s.bonds.length === 0)) issue('Topology source and bond list disagree', ['topology']);
  if ((s.topology.completeness === 'unknown') !== (s.bonds.length === 0)) issue('Topology completeness and bond list disagree', ['topology']);
}).readonly();
export type NormalizedStructure = z.infer<typeof NormalizedStructureSchema>;

export const PtmAnnotationSchema = z.strictObject({
  schemaVersion: VersionSchema, id: IdSchema, kind: z.literal('annotation'),
  structureId: IdSchema, residueKey: KeySchema,
  ptm: z.enum(['phosphorylation', 'methylation', 'glycosylation', 'other']),
  label: z.string().min(1).max(256), createdAt: TimestampSchema,
  evidence: z.strictObject({
    kind: z.enum(['user-annotation', 'source-record', 'literature']), citation: z.string().min(1).optional(),
  }).readonly(), coordinatesChanged: z.literal(false),
}).readonly();
export type PtmAnnotation = z.infer<typeof PtmAnnotationSchema>;
export const CoordinateModificationRequestSchema = z.strictObject({
  schemaVersion: VersionSchema, jobId: IdSchema, kind: z.literal('construct-ptm'),
  structureId: IdSchema, residueKey: KeySchema,
  chemistry: z.enum(['phosphorylation', 'methylation', 'glycosylation']),
}).readonly();
export type CoordinateModificationRequest = z.infer<typeof CoordinateModificationRequestSchema>;
/** Reserved result interface; no constructor is implemented or advertised. */
export const CoordinateModificationResultSchema = z.strictObject({
  schemaVersion: VersionSchema, kind: z.literal('constructed-chemistry'), jobId: IdSchema,
  inputStructureId: IdSchema, outputStructureId: IdSchema, residueKey: KeySchema,
  chemistry: z.string().min(1), method: z.string().min(1), parameterSet: z.string().min(1),
  engineVersion: z.string().min(1), validationReport: z.string().min(1),
}).readonly();

export const GeometryRequestSchema = z.strictObject({
  schemaVersion: VersionSchema, jobId: IdSchema, kind: z.literal('interface-geometry'),
  structureId: IdSchema, modelId: IdSchema,
  partnerAChainKeys: z.array(KeySchema).min(1).readonly(),
  partnerBChainKeys: z.array(KeySchema).min(1).readonly(),
  contactCutoffAngstrom: z.literal(4), clashOverlapThresholdAngstrom: z.literal(0.4),
}).superRefine((r, ctx) => {
  for (const name of ['partnerAChainKeys', 'partnerBChainKeys'] as const) {
    if (new Set(r[name]).size !== r[name].length) ctx.addIssue({ code: 'custom', path: [name], message: 'Duplicate chain selection' });
  }
  if (r.partnerAChainKeys.some(k => r.partnerBChainKeys.includes(k))) ctx.addIssue({ code: 'custom', message: 'Partner chain sets must be disjoint' });
}).readonly();
export type GeometryRequest = z.infer<typeof GeometryRequestSchema>;
export const AtomPairDistanceSchema = z.strictObject({
  atomAKey: KeySchema, atomBKey: KeySchema, residueAKey: KeySchema, residueBKey: KeySchema,
  distanceAngstrom: z.number().nonnegative(),
}).readonly();
export type AtomPairDistance = z.infer<typeof AtomPairDistanceSchema>;
export const ClashCandidateSchema = AtomPairDistanceSchema.unwrap().extend({
  radiusAAngstrom: z.number().positive(), radiusBAngstrom: z.number().positive(),
  overlapAngstrom: z.number().gt(0.4), interpretation: z.literal('geometric-candidate'),
}).readonly();
export type ClashCandidate = z.infer<typeof ClashCandidateSchema>;
export const AnalysisProvenanceSchema = z.strictObject({
  engineVersion: z.literal('proview-geometry-1'), method: z.literal('cross-partner-euclidean-heavy-atom-pairs'),
  computedAt: TimestampSchema, sourceSha256: Sha256Schema, structureId: IdSchema, modelId: IdSchema,
  coordinateUnit: CoordinateUnitSchema, evidenceClass: z.literal('derived-geometry'),
  altLocPolicy: AltLocPolicySchema,
  selectionPolicy: z.literal('canonical-protein-ATOM;known-heavy-elements;positive-or-missing-occupancy'),
  contactCutoffAngstrom: z.literal(4), clashOverlapThresholdAngstrom: z.literal(0.4),
  radiiSet: z.literal('Bondi-1964-subset-C-N-O-S-P'),
  bondExclusionPolicy: z.literal('exclude-explicit-CONECT-1-2-and-1-3-from-overlaps;contacts-include-all'),
  topologyCompleteness: z.enum(['unknown', 'partial']),
  clashInterpretation: z.literal('geometric-candidates-only'), limitations: z.array(z.string().min(1)).min(1).readonly(),
}).readonly();
export const GeometryResultSchema = z.strictObject({
  schemaVersion: VersionSchema, kind: z.literal('interface-geometry'), jobId: IdSchema,
  structureId: IdSchema, modelId: IdSchema,
  partnerAChainKeys: z.array(KeySchema).min(1).readonly(), partnerBChainKeys: z.array(KeySchema).min(1).readonly(),
  minimumDistance: AtomPairDistanceSchema,
  contacts: z.array(AtomPairDistanceSchema).readonly(), clashCandidates: z.array(ClashCandidateSchema).readonly(),
  summary: z.strictObject({
    selectedAtomCountA: z.int().positive(), selectedAtomCountB: z.int().positive(),
    evaluatedPairCount: z.int().positive(), contactCount: z.int().nonnegative(),
    contactResiduePairCount: z.int().nonnegative(), clashCandidateCount: z.int().nonnegative(),
    knownBondExcludedPairCount: z.int().nonnegative(), unknownRadiusPairCount: z.int().nonnegative(),
  }).readonly(),
  provenance: AnalysisProvenanceSchema, diagnostics: z.array(DiagnosticSchema).readonly(),
}).superRefine((r, ctx) => {
  const fail = (message: string) => ctx.addIssue({ code: 'custom', message });
  if (r.summary.contactCount !== r.contacts.length || r.summary.clashCandidateCount !== r.clashCandidates.length) fail('Summary counts disagree with pair arrays');
  if (r.summary.evaluatedPairCount !== r.summary.selectedAtomCountA * r.summary.selectedAtomCountB) fail('Evaluated pair count disagrees with selection sizes');
  if (r.provenance.structureId !== r.structureId || r.provenance.modelId !== r.modelId) fail('Provenance identity mismatch');
  if (r.contacts.some(x => x.distanceAngstrom > 4)) fail('Contact outside inclusive 4 angstrom cutoff');
}).readonly();
export type GeometryResult = z.infer<typeof GeometryResultSchema>;
export const AlignmentRequestSchema = z.strictObject({
  schemaVersion: VersionSchema, jobId: IdSchema, kind: z.literal('rigid-alignment'),
  referenceStructureId: IdSchema, mobileStructureId: IdSchema,
  atomCorrespondence: z.array(z.strictObject({ referenceAtomKey: KeySchema, mobileAtomKey: KeySchema }).readonly()).min(3).max(25_000).readonly(),
  method: z.literal('kabsch-no-reflection'), atomPolicy: z.literal('explicit-correspondence-only'),
}).readonly();
export type AlignmentRequest = z.infer<typeof AlignmentRequestSchema>;
export const AnalysisRequestSchema = z.union([GeometryRequestSchema, AlignmentRequestSchema]);

const jobBase = { jobId: IdSchema, occurredAt: TimestampSchema, progress: z.number().min(0).max(1), message: z.string().optional() };
export const JobEventSchema = z.discriminatedUnion('status', [
  z.strictObject({ ...jobBase, status: z.literal('queued'), progress: z.literal(0) }).readonly(),
  z.strictObject({ ...jobBase, status: z.literal('running') }).readonly(),
  z.strictObject({ ...jobBase, status: z.literal('completed'), progress: z.literal(1) }).readonly(),
  z.strictObject({ ...jobBase, status: z.literal('cancelled') }).readonly(),
  z.strictObject({ ...jobBase, status: z.literal('failed'), error: AppErrorSchema }).readonly(),
]);
export type JobEvent = z.infer<typeof JobEventSchema>;
export const CancelRequestSchema = z.strictObject({ jobId: IdSchema }).readonly();
export type Cancellation = Readonly<{ isCancelled(): boolean }>;

export const RendererSelectionSchema = z.strictObject({
  structureId: IdSchema, modelId: IdSchema, residueKeys: z.array(KeySchema).readonly(), atomKeys: z.array(KeySchema).readonly(),
}).readonly();
export type RendererSelection = z.infer<typeof RendererSelectionSchema>;
/** Row-major affine transform; p_display = R * p_source + t; source atoms never mutated. */
export const RigidTransformSchema = z.strictObject({
  convention: z.literal('row-major;column-vector;p-display=R*p-source+t'),
  coordinateUnit: CoordinateUnitSchema,
  rotation: z.array(z.number()).length(9).readonly(), translation: PositionSchema,
}).superRefine((t, ctx) => {
  const r = t.rotation;
  const dot = (a: number, b: number) => r[a]! * r[b]! + r[a+1]! * r[b+1]! + r[a+2]! * r[b+2]!;
  const det = r[0]!*(r[4]!*r[8]!-r[5]!*r[7]!)-r[1]!*(r[3]!*r[8]!-r[5]!*r[6]!)+r[2]!*(r[3]!*r[7]!-r[4]!*r[6]!);
  if ([0,3,6].some(i => Math.abs(dot(i,i)-1)>1e-6) || Math.abs(dot(0,3))>1e-6 || Math.abs(dot(0,6))>1e-6 || Math.abs(dot(3,6))>1e-6 || Math.abs(det-1)>1e-6) ctx.addIssue({code:'custom', message:'Rotation must be orthonormal with determinant +1 (no scale/reflection)'});
}).readonly();
export type RigidTransform = z.infer<typeof RigidTransformSchema>;
/** Frozen comparison response. Proper rigid alignment with explicit correspondence. */
export const AlignmentResultSchema = z.strictObject({
  schemaVersion: VersionSchema, jobId: IdSchema, kind: z.literal('rigid-alignment'),
  referenceStructureId: IdSchema, mobileStructureId: IdSchema,
  referenceSourceSha256: Sha256Schema, mobileSourceSha256: Sha256Schema,
  coordinateUnit: CoordinateUnitSchema, evidenceClass: z.literal('derived-geometry'),
  method: z.literal('kabsch-no-reflection'), engineVersion: z.string().min(1), computedAt: TimestampSchema,
  transformMobileToReference: RigidTransformSchema,
  matchedAtomCount: z.int().min(3), rmsdAngstrom: z.number().nonnegative(),
  atomCorrespondence: z.array(z.strictObject({ referenceAtomKey: KeySchema, mobileAtomKey: KeySchema }).readonly()).min(3).readonly(),
  residueDisplacements: z.array(z.strictObject({
    referenceResidueKey: KeySchema, mobileResidueKey: KeySchema, matchedAtomCount: z.int().positive(),
    rmsDisplacementAngstrom: z.number().nonnegative(),
  }).readonly()).readonly(),
  exclusions: z.array(z.strictObject({
    structureId: IdSchema, atomKey: KeySchema.nullable(), residueKey: KeySchema.nullable(),
    reason: z.enum(['missing-coordinate', 'unmatched-identity', 'alternate-conformer', 'ambiguous-mapping', 'outside-selection']),
  }).readonly()).readonly(),
  limitations: z.array(z.string().min(1)).min(1).readonly(),
}).superRefine((r,ctx) => {
  if(r.matchedAtomCount !== r.atomCorrespondence.length) ctx.addIssue({code:'custom',message:'Matched atom count and correspondence length disagree'});
  if(new Set(r.atomCorrespondence.map(x=>x.referenceAtomKey)).size!==r.matchedAtomCount || new Set(r.atomCorrespondence.map(x=>x.mobileAtomKey)).size!==r.matchedAtomCount) ctx.addIssue({code:'custom',message:'Alignment correspondence must be one-to-one'});
}).readonly();
export type AlignmentResult = z.infer<typeof AlignmentResultSchema>;
export const RendererStateSchema = z.strictObject({
  selection: RendererSelectionSchema.nullable(), transforms: z.record(KeySchema, RigidTransformSchema),
  representation: z.enum(['cartoon', 'sticks', 'sphere']), background: z.string().regex(/^#[a-fA-F0-9]{6}$/),
  reducedMotion: z.boolean(), camera: z.array(z.number()).length(8).readonly().nullable(),
  partnerAChainKey: KeySchema.nullable().default(null), partnerBChainKey: KeySchema.nullable().default(null),
  slab: z.strictObject({ near: z.number().min(-500).max(0), far: z.number().min(0).max(500) }).default({near:-50,far:50}),
  comparisonVisible: z.boolean().default(true),
}).readonly();
export const EmbeddedInputSchema = z.strictObject({
  sourceSha256: Sha256Schema, format: z.enum(['pdb', 'mmcif']), name: z.string().min(1),
  text: z.string().min(1).max(10 * 1024 * 1024),
}).readonly();
export const CorrespondenceSchema = z.array(z.strictObject({referenceAtomKey:KeySchema,mobileAtomKey:KeySchema})).max(25_000).readonly();
export const ComparisonSchema = z.strictObject({
  structure: NormalizedStructureSchema, referenceChainKey: KeySchema, mobileChainKey: KeySchema,
  mapping: CorrespondenceSchema, result: AlignmentResultSchema.nullable(),
}).readonly();
export type Comparison = z.infer<typeof ComparisonSchema>;
export const ProjectSchema = z.strictObject({
  schemaVersion: z.literal(PROJECT_VERSION), format: z.literal('proview-project'), id: IdSchema,
  title: z.string().min(1).max(256), createdAt: TimestampSchema, updatedAt: TimestampSchema,
  portability: z.literal('embedded-inputs-only'), inputs: z.array(EmbeddedInputSchema).min(1).max(2).readonly(),
  structures: z.array(NormalizedStructureSchema).length(1).readonly(), annotations: z.array(PtmAnnotationSchema).max(10000).readonly(),
  modifications: z.array(CoordinateModificationResultSchema).length(0).readonly(),
  analyses: z.array(GeometryResultSchema).max(20).readonly(), view: RendererStateSchema,
  comparison: ComparisonSchema.nullable(),
}).superRefine((p, ctx) => {
  const ids = new Map(p.structures.map(s => [s.id,s]));
  const fail = (message: string) => ctx.addIssue({code:'custom', message});
  if (ids.size !== p.structures.length) fail('Duplicate structure IDs');
  for (const s of p.structures) if (!p.inputs.some(i => i.sourceSha256 === s.source.sha256 && i.format === s.source.format)) fail(`Missing embedded source for ${s.id}`);
  for (const a of p.annotations) if (!ids.get(a.structureId)?.residues.some(r => r.key === a.residueKey)) fail(`Unknown annotated residue ${a.residueKey}`);
  for (const a of p.analyses) if (ids.get(a.structureId)?.source.sha256 !== a.provenance.sourceSha256) fail('Analysis source identity mismatch');
  if (p.structures.length !== 1) fail('A project must contain exactly one reference structure');
  if (new Set(p.annotations.map(a=>a.id)).size !== p.annotations.length) fail('Duplicate annotation IDs');
  const reference=p.structures[0]!;
  for (const key of [p.view.partnerAChainKey,p.view.partnerBChainKey]) if(key && !reference.chains.some(c=>c.key===key && c.modelId===reference.selectedModelId)) fail('Invalid partner view reference');
  if (Object.keys(p.view.transforms).length) fail('Display transforms are derived from alignment results');
  if(p.comparison){
    const c=p.comparison, moving=c.structure;
    if(!p.inputs.some(i=>i.sourceSha256===moving.source.sha256 && i.format===moving.source.format)) fail('Missing mobile source');
    if(!reference.chains.some(x=>x.key===c.referenceChainKey && x.modelId===reference.selectedModelId) || !moving.chains.some(x=>x.key===c.mobileChainKey && x.modelId===moving.selectedModelId)) fail('Invalid comparison chain/model');
    const ra=new Map(reference.atoms.map(a=>[a.key,a])), ma=new Map(moving.atoms.map(a=>[a.key,a]));
    if(new Set(c.mapping.map(x=>x.referenceAtomKey)).size!==c.mapping.length || new Set(c.mapping.map(x=>x.mobileAtomKey)).size!==c.mapping.length) fail('Comparison mapping must be one-to-one');
    for(const pair of c.mapping) if(ra.get(pair.referenceAtomKey)?.chainKey!==c.referenceChainKey || ma.get(pair.mobileAtomKey)?.chainKey!==c.mobileChainKey) fail('Mapping references an atom outside selected chains');
    if(c.result && (c.result.referenceSourceSha256!==reference.source.sha256 || c.result.mobileSourceSha256!==moving.source.sha256 || c.result.referenceStructureId!==reference.id || c.result.mobileStructureId!==moving.id || JSON.stringify(c.result.atomCorrespondence)!==JSON.stringify(c.mapping))) fail('Comparison result identity or mapping mismatch');
  }
  if (p.view.selection) {
    const s=ids.get(p.view.selection.structureId);
    if (!s || !s.models.some(m=>m.id===p.view.selection!.modelId) || p.view.selection.residueKeys.some(k=>!s.residues.some(r=>r.key===k && r.modelId===p.view.selection!.modelId)) || p.view.selection.atomKeys.some(k=>!s.atoms.some(a=>a.key===k && a.modelId===p.view.selection!.modelId))) fail('Invalid renderer selection references');
  }
}).readonly();
export type Project = z.infer<typeof ProjectSchema>;
export const ProjectMigrationPolicySchema = z.strictObject({
  currentVersion: z.literal(PROJECT_VERSION), acceptedVersions: z.tuple([z.literal('1.0.0'),z.literal(PROJECT_VERSION)]),
  unknownVersionBehavior: z.literal('reject-without-modifying-file'), migrationsImplemented: z.literal(true),
}).readonly();
export const AnalysisExportSchema = z.strictObject({
  schemaVersion: VersionSchema, format: z.literal('proview-geometry-export'), exportedAt: TimestampSchema,
  coordinateUnit: CoordinateUnitSchema, result: GeometryResultSchema,
  source: StructureSourceSchema,
}).readonly();
export const ImageExportRequestSchema = z.strictObject({
  schemaVersion: VersionSchema, kind: z.literal('image-export'), format: z.enum(['png']),
  width: z.int().min(256).max(8192), height: z.int().min(256).max(8192),
  includeProvenanceCaption: z.literal(true), view: RendererStateSchema,
}).readonly();
export const ExternalAdapterConfigurationSchema = z.strictObject({
  schemaVersion: VersionSchema, id: IdSchema, enabled: z.boolean(),
  kind: z.enum(['structure-prediction', 'docking', 'minimization']),
  endpoint: z.url().regex(/^https:\/\//), credentialReference: z.string().min(1).nullable(),
  availability: z.enum(['not-configured', 'offline', 'available']),
  requiresPerRunUploadConsent: z.literal(true),
}).readonly();
export const ExternalComputeRequestSchema = z.strictObject({
  schemaVersion: VersionSchema, jobId: IdSchema, adapterId: IdSchema, structureId: IdSchema,
  sourceSha256: Sha256Schema, uploadConsent: z.strictObject({ granted: z.literal(true), recordedAt: TimestampSchema }).readonly(),
}).readonly();

/** Narrow preload API. Main process owns source data; renderer cannot supply executable code, paths, or analysis coordinates. */
export type DesktopReply<T> = Readonly<{ok:true;value:T}> | Readonly<{ok:false;error:AppError}>;
export interface DesktopBridge {
  loadExample(id: '1CRN' | '1BRS'): Promise<DesktopReply<NormalizedStructure>>;
  importLocal(): Promise<DesktopReply<NormalizedStructure | null>>;
  retrieveAccession(accession: string): Promise<DesktopReply<NormalizedStructure>>;
  importComparison(): Promise<DesktopReply<NormalizedStructure | null>>;
  analyze(request: GeometryRequest): Promise<DesktopReply<GeometryResult>>;
  align(request: AlignmentRequest): Promise<DesktopReply<AlignmentResult>>;
  openHelp(): Promise<DesktopReply<boolean>>;
  openProject(): Promise<DesktopReply<Project | null>>;
  saveProject(state: { title: string; selectedModelId: string; annotations: PtmAnnotation[]; analyses: GeometryResult[]; comparison: Omit<Comparison,'structure'> & {selectedModelId:string} | null; view: z.infer<typeof RendererStateSchema> }): Promise<DesktopReply<{ path: string } | null>>;
  exportAlignment(result: AlignmentResult): Promise<DesktopReply<{ path: string } | null>>;
  exportGeometry(result: GeometryResult): Promise<DesktopReply<{ path: string } | null>>;
  exportPng(dataUrl: string): Promise<DesktopReply<{ path: string } | null>>;
  cancel(jobId: string): Promise<DesktopReply<boolean>>;
  onJob(listener: (event: JobEvent) => void): () => void;
}

export const contractSchemas = {
  ImportMetadata: ImportMetadataSchema, ImportRequest: ImportRequestSchema,
  NormalizedStructure: NormalizedStructureSchema, PtmAnnotation: PtmAnnotationSchema,
  CoordinateModificationRequest: CoordinateModificationRequestSchema,
  CoordinateModificationResult: CoordinateModificationResultSchema,
  GeometryRequest: GeometryRequestSchema, GeometryResult: GeometryResultSchema,
  AlignmentRequest: AlignmentRequestSchema, AlignmentResult: AlignmentResultSchema, AnalysisRequest: AnalysisRequestSchema,
  AppError: AppErrorSchema, JobEvent: JobEventSchema, CancelRequest: CancelRequestSchema,
  RendererSelection: RendererSelectionSchema, RigidTransform: RigidTransformSchema, RendererState: RendererStateSchema,
  Project: ProjectSchema, ProjectMigrationPolicy: ProjectMigrationPolicySchema,
  AnalysisExport: AnalysisExportSchema, ImageExportRequest: ImageExportRequestSchema,
  ExternalAdapterConfiguration: ExternalAdapterConfigurationSchema, ExternalComputeRequest: ExternalComputeRequestSchema,
} as const;
