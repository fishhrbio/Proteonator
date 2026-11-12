# Proteonator scientific methods and limitations

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

Construction places heavy atoms; the selected side-chain charge is a preparation hypothesis. Coordinate exports do not encode a complete protonation or partial-charge assignment. Supported preparation adds hydrogens and applies the force-field charges recorded in the report.

wwPDB CCD ideal coordinates are grafted onto a local side-chain attachment frame. Original heavy-atom positions are retained. The free-amino-acid terminal OXT template atom is not grafted onto an internal residue. Atom/bond inventories and template hashes accompany the result. Missing attachment atoms, alternate sites, duplicate edits and invalid constructed bond lengths reject construction. Only one supported chemical modification per residue is allowed within a scenario; additional residues can be edited separately.

Construction is a structural hypothesis. It does not establish that a site is modified in vivo, identify a modifying enzyme or demonstrate a change in folding. Undo/redo reconstruct the scenario from its retained source and edit list. A locally relaxed scenario retains the constructed state, and **Return to constructed state** restores it.

## Geometric comparison

- Distances use Euclidean coordinates in ångströms. Angles and signed dihedrals use degrees. Undefined coincident/collinear configurations reject measurement.
- A contact is an inclusive heavy-atom distance of 4 Å or less between an edited residue and a different residue/component. A 4 Å spatial grid accelerates the same pairwise criterion. Gained/lost contacts describe membership changes, not energy or affinity.
- Bond lengths and angles use bundled CCD connectivity for supported modifications. A new atom can produce a new geometry value with no baseline counterpart; these values are reported as new, not as zero-baseline changes.
- Backbone phi/psi/omega and available chi1 torsions use resolved atoms. Backbone torsions require an adjacent peptide C–N distance of at most 1.8 Å. Torsion differences are wrapped into [−180°, 180°).
- The added-atom overlap screen uses Bondi radii C 1.70, N 1.55, O 1.52, S/P 1.80 Å, for added atoms against other residues. Overlap greater than 0.4 Å is reported. This limited screen is neither a complete clash score nor an interaction-energy calculation.
- Common-heavy-atom RMSD and displacement in PTM comparisons use the same frame with no implicit fit. The display lists the largest displacements; the RMSD uses all common heavy atoms.

## Supplied-structure fitting

Reviewed explicit pairs determine a proper least-squares SVD rotation and translation, with determinant +1, no reflection and no scale. At least three non-collinear one-to-one atom pairs are required. The transform applies to a derived mobile structure and never replaces its imported coordinates. Reopened reviewed alignments are recalculated from original embedded coordinates and pairs.

Exact Cα identities or a global Needleman–Wunsch sequence proposal can suggest pairs. Sequence scoring is match +2, mismatch −1 and gap −2, over resolved protein residues only. Gaps, mutations, constructs and isoforms still require human review. A low RMSD does not prove identical function or show that a PTM caused a structural difference.

## Restricted local minimization

OpenMM 8.6.0 prepares a complete parameterized topology, removes input hydrogens and rebuilds them using the selected parameters and preparation pH. Missing heavy atoms are not repaired. Unsupported residues, bonds, termini or components stop the calculation. Author-chain identity is mapped explicitly across mmCIF label chains. No unresolved ligand or surrounding partner is silently deleted.

The method uses a nonperiodic vacuum system with no nonbonded cutoff, retained source waters and flexible bonds/waters without constraints. Compatible CHARMM water/ion parameters accompany each protein force field. There is no solvent box, ionic-strength model, temperature ensemble or dynamical sampling. Heavy atoms outside the chosen neighborhood receive harmonic positional restraints; hydrogens are unrestrained. The neighborhood is the minimum distance to any atom in an edited residue after preparation. Restraints permit motion and do not freeze outer atoms exactly.

All physical/numerical settings are sent explicitly and recorded: force field, pH, radius, restraint coefficient, iteration limit, RMS-force tolerance and seed. Initial UI settings are pH 7, radius 8 Å, restraint 1,000 kJ mol⁻¹ nm⁻², 200 iterations, tolerance 10 kJ mol⁻¹ nm⁻¹ and seed 20261112. Standard-residue hydrogen preparation responds to pH; the monoanionic phosphate templates remain fixed. CPU calculation uses two threads with deterministic force evaluation. Numerical roundoff and platform/version changes can affect the final configuration; seeds do not establish a thermodynamic ensemble.

The restraint potential is ½k|r−r₀|². Energies are in kJ/mol, force tolerance and reported RMS force in kJ/mol/nm. RMS force is the square root of the mean of per-atom squared force-vector magnitudes. **Unconverged** means the displayed RMS-force target was not reached within the selected budget. A calculation can finish and remain unconverged; this state is kept in the report rather than marked converged.

A separately prepared source baseline uses the same method and settings. The prepared control can be selected for geometric comparison. Preparation itself changes hydrogen coordinates and may move heavy atoms during the subsequent baseline minimization. Potential energies of differently composed systems must not be interpreted as binding free energies or ranked as biological stability. This method cannot establish global folding, conformational populations or causal affinity changes.

## Biological context and maps

Context is retrieved only on request from UniProt, PDBe SIFTS and available Ensembl transcript records. The cached records, accession, retrieval time and service errors remain in the project. A selected residue maps through a matching SIFTS chain/SEQRES segment and is checked against the retrieved protein sequence, including every resolved residue in the mapped segment; author-number offsets are not guessed. Ambiguity, substitutions or missing coverage remain visible. Ensembl exon bars show genomic exon lengths with compressed introns, rather than a direct structure-to-genome registration. Only available curated transcript details are shown; absence is not evidence of no alternative splicing.

Processing features and PTM comments reflect curated annotations, rather than an exhaustive biosynthetic explanation. A source lacking trustworthy cross-references can require an explicit accession and may remain unmapped. The presence of a protein sequence alone cannot establish its gene of origin or unique transcript. Choosing an isoform sequence does not create its structure.

Local CCP4/MRC and Cube maps display at 1.5 relative sigma in their supplied coordinate frame. Single-dataset density Cube grids require nonnegative atom counts, positive axis counts and Bohr coordinates, with at most 32 million values. Negative-axis-count Angstrom grids reject explicitly to prevent an incorrect spatial scale. Cube atom records do not add a coordinate structure to the workspace. The application does not automatically register, resample or validate an experimental map against a model. Confirm origin, units and placement before interpretation. Synthetic map fixtures are verification data and are never labeled experimental density.

## References

- [wwPDB Chemical Component Dictionary](https://www.wwpdb.org/data/ccd) and [archive usage policy](https://www.wwpdb.org/about/usage-policies).
- Sehnal et al., Mol* Viewer: modern web app for 3D visualization and analysis of large biomolecular structures. [Nucleic Acids Research, 2021](https://doi.org/10.1093/nar/gkab314).
- [Gemmi documentation](https://gemmi.readthedocs.io/).
- [OpenMM force fields and simulation preparation](https://docs.openmm.org/8.6.0/userguide/application/02_running_sims.html) and [OpenMM documentation](https://docs.openmm.org/).
- [CHARMM36m](https://doi.org/10.1038/nmeth.4067); bundled XML files include their parameter-source references.
- Bondi, van der Waals Volumes and Radii. [J. Phys. Chem., 1964](https://doi.org/10.1021/j100785a001).
- [UniProt sequence annotation](https://www.uniprot.org/help/sequence_annotation), [PDBe SIFTS](https://www.ebi.ac.uk/pdbe/docs/sifts/quick.html), [Ensembl REST](https://rest.ensembl.org/).

Computed local-response coordinates use occupancy 1 and B factor 0 as display placeholders; these values are not experimental occupancies or uncertainty estimates.

Local-response output is checked for inversion at retained amino-acid Cα and threonine/isoleucine Cβ stereocenters. Degenerate input centers or an inverted output reject the calculation, including otherwise finite unconverged results. Severe graft clashes may require a different prepared geometry or supplied structure.
