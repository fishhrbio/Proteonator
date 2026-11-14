# Proteonator 1.2 scientific methods and limitations

## Evidence states and immutable input

The imported coordinate text and its SHA-256 digest are retained. Assembly expansion, chemical construction, alignment and local minimization create derived states. The viewport identifies source, constructed or locally relaxed coordinates. An imported comparison is supplied evidence whose interpretation depends on its original method. A user annotation changes no atoms.

One selected coordinate model is analyzed at a time. Biological assemblies use deposited operators through Gemmi, rather than camera rotation. Assembly chain instances have distinct identifiers. Missing atoms and missing sequence segments are not invented. For display and geometric analysis, each residue uses the alternate with the greatest mean occupancy; ties prefer A, then lexical order. Shared blank atoms take precedence and zero-occupancy atoms are excluded. Ambiguous duplicate author atom identities reject inspection.

Source and dictionary connections inform molecular display. Mol* can infer additional connectivity from chemistry and geometry. This is not a guarantee of experimentally determined bond order, protonation or metal coordination. Unusual ligands and covalent links require review. Experimental B factors describe source uncertainty/displacement and are not automatically interpreted as prediction confidence.

## Supported construction chemistry

| Modification | Parent → component | Selected side-chain state | Local response |
| --- | --- | --- | --- |
| Serine phosphorylation | SER → SEP | Monoanionic phosphate, −1 | Internal complete residues; CHARMM36m July 2024 |
| Threonine phosphorylation | THR → TPO | Monoanionic phosphate, −1 | Same |
| Tyrosine phosphorylation | TYR → PTR | Monoanionic phosphate, −1 | Same |
| Lysine acetylation | LYS → ALY | Neutral acetyllysine | Internal complete residues; legacy CHARMM36 |
| Lysine monomethylation | LYS → MLZ | Cationic, +1 | Construction/geometry only |
| Lysine dimethylation | LYS → MLY | Cationic, +1 | Construction/geometry only |
| Lysine trimethylation | LYS → M3L | Cationic, +1 | Construction/geometry only |
| Proline 4-hydroxylation | PRO → HYP | Neutral trans-4-hydroxyproline | Complete compatible residues; legacy CHARMM36 |

Construction places heavy atoms; the selected side-chain charge is a preparation hypothesis. Coordinate exports do not encode a complete protonation or partial-charge assignment. Supported preparation adds hydrogens and applies the force-field charges recorded in the report.

wwPDB CCD ideal coordinates are grafted onto a local side-chain attachment frame. PTM grafts retain original heavy-atom positions. Canonical substitutions and terminal-amide construction have the distinct retention rules described below. The free-amino-acid terminal OXT template atom is not grafted onto an internal residue. Atom/bond inventories and template hashes accompany the result. Missing attachment atoms, alternate sites, duplicate edits and invalid constructed bond lengths reject construction. Only one chemical edit per residue is allowed within a scenario. Reviewed multi-site edits are atomic and limited to 32 entries; a disulfide partner cannot also receive another edit.

Construction is a structural hypothesis. It does not establish that a site is modified in vivo, identify a modifying enzyme or demonstrate a change in folding. Undo/redo reconstruct the scenario from its retained source and edit list. A locally relaxed scenario retains the constructed state, and **Return to constructed state** restores it.

## Canonical substitutions and mature coordinate chemistry

Canonical L-amino-acid substitutions use the target CCD ideal heavy-atom geometry in an N/CA/C backbone frame. N, CA, C, O and an existing terminal OXT are retained; the selected side chain is replaced. Target atom inventory, dictionary hash and bond checks accompany construction. A retained source stereocenter must not invert. Explicit side-chain connections, unresolved alternates and incomplete source backbones stop the operation. This is a constructed side-chain hypothesis in a retained backbone, not a new equilibrium fold. Sequence-to-structure substitutions require retained, reviewed source/model/assembly correspondence.

Primary terminal-amide construction requires the observed terminal canonical residue of a chain with at least two canonical residues and a complete CA/C/O/OXT group. It removes OXT and places NT in the carbonyl plane at an initial C–N distance of 1.33 Å, retaining an explicit C–NT connection. Legacy CHARMM36 CT2 parameters supply the actual atom types, charges and NT–HT1/HT2 bonds during preparation. No parameter is guessed. A single-residue chain is outside this validated patch scope. The observed coordinate-chain end does not prove a biological mature terminus, and this coordinate operation does not automatically remove a glycine donor or excise an unresolved precursor region.

Disulfide construction requires two unpaired canonical cysteines with existing SG separation of 1.8–2.3 Å, removes thiol hydrogens when present and writes an explicit S–S connection. It retains heavy-atom geometry. Distant cysteines are rejected; a bond declaration is not a folding mechanism or evidence of correct oxidative maturation. Existing competing sulfur connections also reject construction.

Hydroxyproline uses the CCD trans-4-hydroxyproline geometry and legacy CHARMM36 parameters. Preparation explicitly aliases CCD OD1 to the force-field OE atom, then restores OD1 in exported coordinates. The alias and parameter provenance are retained. Original and relaxed stereochemistry are checked; unsupported mixed force-field requirements stop preparation.

## Geometric comparison

- Distances use Euclidean coordinates in ångströms. Angles and signed dihedrals use degrees. Undefined coincident/collinear configurations reject measurement.
- A contact is an inclusive heavy-atom distance at or below the declared cutoff between a selected/edited residue and a different residue/component. Scenario comparison retains its 4 Å default. Contact inspection permits 2–8 Å and records the actual threshold. A spatial grid accelerates the same pairwise criterion. Full atom pairs, gained/lost sets and residue summaries remain distinct; output is capped at 200,000 atom pairs. Gained/lost contacts describe membership changes, not energy or affinity.
- Bond lengths and angles use bundled CCD connectivity for supported modifications. A new atom can produce a new geometry value with no baseline counterpart; these values are reported as new, not as zero-baseline changes.
- Backbone phi/psi/omega and available chi1 torsions use resolved atoms. Backbone torsions require an adjacent peptide C–N distance of at most 1.8 Å. Torsion differences are wrapped into [−180°, 180°).
- The added-atom overlap screen uses Bondi radii C 1.70, N 1.55, O 1.52, S/P 1.80 Å, for added atoms against other residues. Overlap greater than 0.4 Å is reported. This limited screen is neither a complete clash score nor an interaction-energy calculation.
- Common-heavy-atom RMSD and displacement in PTM comparisons use the same frame with no implicit fit. The display lists the largest displacements; the RMSD uses all common heavy atoms.

## Supplied-structure fitting

Reviewed fit pairs determine a proper least-squares SVD rotation and translation, with determinant +1, no reflection and no scale. At least three non-collinear one-to-one fit pairs are required. Fit pairs must be a subset of the declared evaluation correspondence. Fit RMSD is calculated only over the fit region; evaluation RMSD/displacement uses the same transform over the evaluation region. Excluded, unpaired or missing rows are retained as gaps in profile exports. No outlier is removed automatically. The transform applies to a derived mobile structure and never replaces its imported coordinates. Reopened reviewed alignments are recalculated from original embedded coordinates and pairs.

Exact Cα identities or a global Needleman–Wunsch sequence proposal can suggest pairs. Sequence scoring is match +2, mismatch −1 and gap −2, over resolved protein residues only. Gaps, mutations, constructs and isoforms still require human review. A low RMSD does not prove identical function or show that a PTM caused a structural difference.

## Restricted local minimization

OpenMM 8.6.0 prepares a complete parameterized topology, removes input hydrogens and rebuilds them using the selected parameters and preparation pH. Missing heavy atoms are not repaired. Unsupported residues, bonds, termini or components stop the calculation. Author-chain identity is mapped explicitly across mmCIF label chains. Explicit covalent/disulfide connections are transferred by resolved author atom identities before hydrogen preparation, including cases where label and author chain IDs differ. Expected disulfide partners and sulfur hydrogen counts are checked in verification. No unresolved ligand or surrounding partner is silently deleted.

The method uses a nonperiodic vacuum system with no nonbonded cutoff, retained source waters and flexible bonds/waters without constraints. Compatible CHARMM water/ion parameters accompany each protein force field. There is no solvent box, ionic-strength model, temperature ensemble or dynamical sampling. Heavy atoms outside the chosen neighborhood receive harmonic positional restraints; hydrogens are unrestrained. The neighborhood is the minimum distance to any atom in an edited residue after preparation. Restraints permit motion and do not freeze outer atoms exactly.

All physical/numerical settings are sent explicitly and recorded: force field, pH, radius, restraint coefficient, iteration limit, RMS-force tolerance and seed. Initial UI settings are pH 7, radius 8 Å, restraint 1,000 kJ mol⁻¹ nm⁻², 200 iterations, tolerance 10 kJ mol⁻¹ nm⁻¹ and seed 20261112. Standard-residue hydrogen preparation responds to pH; the monoanionic phosphate templates remain fixed. CPU calculation uses two threads with deterministic force evaluation. Numerical roundoff and platform/version changes can affect the final configuration; seeds do not establish a thermodynamic ensemble.

The restraint potential is ½k|r−r₀|². Energies are in kJ/mol, force tolerance and reported RMS force in kJ/mol/nm. RMS force is the square root of the mean of per-atom squared force-vector magnitudes. **Unconverged** means the displayed RMS-force target was not reached within the selected budget. A calculation can finish and remain unconverged; this state is kept in the report rather than marked converged.

A separately prepared source baseline uses the same method and settings. The prepared control can be selected for geometric comparison. Preparation itself changes hydrogen coordinates and may move heavy atoms during the subsequent baseline minimization. Potential energies of differently composed systems must not be interpreted as binding free energies or ranked as biological stability. This method cannot establish global folding, conformational populations or causal affinity changes.

## Sequence states, maturation and mass

Sequence-only states contain canonical amino-acid letters, stable residue identities, explicit parents/operations, terminal state, desired disulfide pairs and attached evidence. Imported documents are immutable and hashed. Module assembly creates an encoded construct. Cleavage/trim operations preserve retained residue identities and create separate products; a disulfide crossing a cut prevents treating the resulting pieces as independent fragments. New fragments have free termini except for an explicitly retained terminal amide on the original terminal fragment.

Elemental accounting sums canonical residue formulas, adds water for each linear protein state, subtracts two hydrogens for each declared disulfide and applies O→NH for a terminal primary amide. Glycine-donor amidation removes the terminal glycine residue before changing the product terminus. Neutral monoisotopic and abundance-weighted average masses use the versioned elemental constants in the sequence engine. They are not charge/adduct-specific m/z, glycoform predictions, isotope labeling or universal modified-residue masses. Unsupported chemistry is not silently assigned a canonical formula.

Target sequence equality and desired terminal/disulfide requirements are assessed separately. Incomplete requirements remain incomplete. A design meeting its declared chemistry is not experimentally confirmed. Evidence records retain their type, status and source; evidence for sequence, cleavage, chemical identity, purity and activity is not interchangeable.

Descriptive profiles use Kyte–Doolittle hydropathy and the Bjellqvist sequence pKa model as implemented by the recorded equations, excluding paired cysteines and amidated C-terminal acid. The hydropathy window is centered and truncated at sequence ends; an even window has one extra position on the left. Charge is estimated at the explicit pH and pI is bracketed between pH 0 and 14. These sequence-group estimates do not include conformation, solvent-dependent pKa shifts, arbitrary PTMs, expression or solubility predictions.

## Translation, back-translation and annotations

Molecule type is declared; an A/C/G/T-like alphabet alone does not determine biological role. GenBank parsing uses Biopython 1.86, preserving source bytes, feature intervals/strand and parser notices. CDS translation respects the declared table, codon_start, joined/reverse locations and complete versus partial semantics. Annotation conflicts, internal stops, unsupported recoding and incomplete CDS cases remain visible. Source codon positions are checked against the actual nucleotide record, including complement strand; they are not inferred from sequence similarity alone.

The genetic-code dataset is versioned from Biopython's NCBI table definitions. Context-dependent stop/sense codes are explicitly unavailable. Complete CDS translation requires a valid initiation codon, terminal stop and no internal stops; an alternate initiator can encode methionine under its table's initiation semantics. Internal coding segments use internal assignments and do not acquire a fabricated initiator or stop.

Back-translation chooses synonymous codons deterministically, through a bounded seeded policy, or through an explicitly sourced usage-weight table. Each generated candidate must retranslate exactly. Exact codon alternatives and their product count are retained without exhaustive combinatorial enumeration. Usage matching is not demonstrated expression optimization. The generated object is a designed coding segment, not a recovered source transcript. UTRs, introns, splice boundaries, promoters, caps, poly(A), source organism and historical tRNAs cannot be recovered from an amino-acid sequence.

Source annotations and imported feature/domain tracks keep provenance and original coordinates. Structural linking requires a reviewed, exact source/model/assembly mapping. Supplied sequence/isoform alignments show sequence differences but do not identify a unique transcript or create missing structural coordinates.

## RNA secondary structure and imported family evidence

Local folding uses ViennaRNA 2.7.2 with explicit temperature, monovalent salt, dangles, lonely-pair and probability-cutoff settings. Input is 1–1,500 unambiguous RNA bases. MFE structure/energy, ensemble free energy and sparse base-pair probabilities use the bundled default energy parameters and a pseudoknot-free secondary-structure model. At most 10,000 reported probability pairs are retained and truncation is explicit. The circular SVG is a schematic, not a three-dimensional conformation. RNA-family identity, native-fold confirmation, translation yield and arbitrary modified-base behavior do not follow from this calculation.

RNA-family evidence import supports source-bound JSON, Infernal cmsearch/cmscan tblout formats 1/3 and standard tRNAscan-SE tables. Method/version, database/model version, threshold policy, source sequence hash, interval and strand are required or retained. Inclusion/reporting thresholds, truncated hits and ambiguous/no-hit outcomes are not converted into calibrated probabilities or forced mRNA labels. Native classifiers and family databases are not bundled in the desktop packages. No RNA sequence is submitted to an online classification service.

## Typed interactions, imported evidence and coordinate frames

Mol* 5.13.0 typed interactions use its donor/acceptor/angular rules, charged features, aromatic geometry and metal-binding rules. Ionic classification is explicitly enabled; exact provider settings accompany the display/report. Missing hydrogens, protonation assumptions, inferred bonds and unusual components can change these geometric assignments. They do not demonstrate binding affinity or replace an experimental interaction measurement.

External residue evidence requires exact coordinate/source/model/assembly binding, a named metric, units, method and source. pLDDT must be explicitly identified with its 0–100 scale. B factors are not automatically prediction confidence. Different/stale coordinate states do not receive an imported profile as fresh validation.

Registered trajectory JSON is limited to 2–200 frames, 5,000 ordered atoms and a 32 MiB input. Its topology hash and exact atom order are verified. Å/nm units are explicit and converted exactly; actual trajectories require strictly increasing supplied ps times, while ensembles do not acquire a time axis. Imported frames retain covalent connectivity and display occupancy 1/B factor 0 as placeholders. They do not replace the primary source coordinates.

Frame analysis reports unaligned heavy-atom RMSD to the first frame and RMSF about the arithmetic mean. Both include rigid-body movement and report the frame and atom set. Imported samples do not establish equilibrium, convergence or causal PTM effects. A saved-view storyboard and a camera-orbit WebM are presentation media, not molecular trajectories.

## Reproducible records and method gates

Portable projects embed source text, method settings, hashes, chemical states, correspondence, imported evidence and actual frame data. Gzip containers have bounded expanded size. Failed edits/imports/cancelled jobs preserve the prior valid state. Autosave avoids half-applied operations and retains an earlier valid generation when the latest snapshot is corrupt. Vector diagrams and raster molecular images are identified separately; review bundles include a per-file SHA-256 manifest.

The supported numerical scope is descriptive sequence chemistry, geometric comparison, registered-frame statistics, RNA secondary structure and the bounded local OpenMM method above. A universal fold/affinity/yield score is not implemented. A future conformational or binding method requires explicit system/environment preparation, parameter coverage, sampling/reference states, convergence, uncertainty and external benchmarks before quantitative claims. A short minimization, contact count, supplied result or animation cannot satisfy that scientific gate by itself.

## Biological context and maps

Context is retrieved only on request from UniProt, PDBe SIFTS and available Ensembl transcript records. The cached records, accession, retrieval time and service errors remain in the project. A selected residue maps through a matching SIFTS chain/SEQRES segment and is checked against the retrieved protein sequence, including every resolved residue in the mapped segment; author-number offsets are not guessed. Ambiguity, substitutions or missing coverage remain visible. Ensembl exon bars show genomic exon lengths with compressed introns, rather than a direct structure-to-genome registration. Only available curated transcript details are shown; absence is not evidence of no alternative splicing.

Processing features and PTM comments reflect curated annotations, rather than an exhaustive biosynthetic explanation. A source lacking trustworthy cross-references can require an explicit accession and may remain unmapped. The presence of a protein sequence alone cannot establish its gene of origin or unique transcript. Choosing an isoform sequence does not create its structure.

Local CCP4/MRC and Cube maps display at 1.5 relative sigma in their supplied coordinate frame. Single-dataset density Cube grids require nonnegative atom counts, positive axis counts and Bohr coordinates, with at most 32 million values. Negative-axis-count Angstrom grids reject explicitly to prevent an incorrect spatial scale. Cube atom records do not add a coordinate structure to the workspace. The application does not automatically register, resample or validate an experimental map against a model. Confirm origin, units and placement before interpretation. Synthetic map fixtures are verification data and are never labeled experimental density.

## References

- [NCBI genetic codes](https://www.ncbi.nlm.nih.gov/Taxonomy/Utils/wprintgc.cgi); [Biopython 1.86 documentation](https://biopython.org/docs/1.86/api/index.html).
- [Biopython sequence pI method and references](https://biopython.org/docs/1.86/api/Bio.SeqUtils.IsoelectricPoint.html).
- Kyte and Doolittle, [hydropathy method, 1982](https://doi.org/10.1016/0022-2836(82)90515-0).
- [ViennaRNA methods and contributors](https://www.tbi.univie.ac.at/RNA/ViennaRNA/doc/html/about.html); Lorenz et al., [2011](https://doi.org/10.1186/1748-7188-6-26).
- [Infernal 1.1.5 user guide and table formats](https://eddylab.org/infernal/Userguide.pdf); [tRNAscan-SE 2.0](https://doi.org/10.1093/nar/gkab688).
- Matplotlib: Hunter, [2007](https://doi.org/10.1109/MCSE.2007.55).

- [wwPDB Chemical Component Dictionary](https://www.wwpdb.org/data/ccd) and [archive usage policy](https://www.wwpdb.org/about/usage-policies).
- Sehnal et al., Mol* Viewer: modern web app for 3D visualization and analysis of large biomolecular structures. [Nucleic Acids Research, 2021](https://doi.org/10.1093/nar/gkab314).
- [Gemmi documentation](https://gemmi.readthedocs.io/).
- [OpenMM force fields and simulation preparation](https://docs.openmm.org/8.6.0/userguide/application/02_running_sims.html) and [OpenMM documentation](https://docs.openmm.org/).
- [CHARMM36m](https://doi.org/10.1038/nmeth.4067); bundled XML files include their parameter-source references.
- Bondi, van der Waals Volumes and Radii. [J. Phys. Chem., 1964](https://doi.org/10.1021/j100785a001).
- [UniProt sequence annotation](https://www.uniprot.org/help/sequence_annotation), [PDBe SIFTS](https://www.ebi.ac.uk/pdbe/docs/sifts/quick.html), [Ensembl REST](https://rest.ensembl.org/).

Computed local-response coordinates use occupancy 1 and B factor 0 as display placeholders; these values are not experimental occupancies or uncertainty estimates.

Local-response output is checked for inversion at retained amino-acid Cα, threonine/isoleucine Cβ, and hydroxyproline Cγ stereocenters. Degenerate input centers or an inverted output reject the calculation, including otherwise finite unconverged results. Severe graft clashes may require a different prepared geometry or supplied structure.

## Declared sequence edits and processing recognition

A named sequence edit records its exact parent interval, operation and replacement. It creates new residue identities and does not inherit old structure/codon mappings, chemical bonds, terminal amides or specimen evidence. Old records remain bound to the old state. Reusing component names does not update an earlier encoded construct.

Recognition-rule scanning uses a user-supplied, versioned literal motif with X as a standard-amino-acid wildcard and an explicit cut offset. Every exact match is reported; additional matches and mismatched proposed cuts require review. No enzyme kinetics, accessibility, biological specificity or confirmed cleavage follows. A maximum of 99 virtual boundaries is supported per operation. Target interval text is an exact sequence comparison, with ambiguity exposed for repeated occurrences.

All 27 versioned genetic-code definitions are checked against the independent primary NCBI gc.prt 4.6 reference; context-dependent stop/sense tables remain disabled for translation/back-translation.
