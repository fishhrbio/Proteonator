# Proteonator 1.1 user guide

## Open and navigate

Install the Windows 11 x64 package and start Proteonator. Bundled examples open offline. **Open** accepts PDB and mmCIF; **Retrieve** downloads a public PDB accession. Local coordinates are processed on your computer. Explicit retrieval sends the accession to the corresponding public service, without uploading the open coordinate file.

Choose a coordinate model and assembly in the left panel before creating PTM scenarios. Changing either starts a new scenario set after confirmation. Assembly copies have distinct chain identities. Component controls show/hide groups and change representation or opacity. Water is hidden initially. Use **Style**, **Color**, clipping and Settings lighting to inspect the view. B-factor coloring refers to source B factors, not automatically to prediction confidence.

Drag to rotate, wheel to zoom and right-drag to pan. The viewport supports arrows to rotate, Shift+arrows to pan, `+`/`−` to zoom and `F` to fit. Select residues in the linked sequence or click in the molecule. Use **Pick** for atoms, residues or chains. Shift-click adds a residue/atom to the selection. **Selection ⋯** exposes contextual actions without requiring a right-click. Use **Toggle residue label** in Inspect to keep up to 12 labels visible. Labels, named selections and residue notes remain in portable projects; notes are annotations, not chemical changes.

## Inspect and measure

The Inspector lists exact author chain/residue/atom identities. Choose 2, 3 or 4 atoms to measure distance, angle or torsion, then select **Measure**. Measurements apply to the current displayed state and are recalculated when that state changes. **Neighborhood** selects residues/components within 5 Å of the selected residue. A geometric neighborhood is not a predicted binding site.

## Construct a PTM

Choose a supported Ser, Thr, Tyr or Lys site and open **PTM**. Review the chemistry description, then **Construct modification**. A separate named scenario retains the source and records the edit. Edited residues appear as sticks; added atoms have a teal overlay. The comparison drawer reports new/lost contacts, added atoms, bond geometry, torsions, steric overlaps and displacement. Source heavy-atom coordinates are retained during construction, so common-heavy-atom RMSD initially remains zero.

You can add compatible edits at other residues, replace the edit at a selected residue, remove an edit, undo/redo or duplicate a scenario. Double-click its name to rename it. Source coordinates are always available in the scenario list. Unsupported residue chemistry, missing attachment atoms or unresolved alternate conformers reject construction with an explanation.

## Calculate a local response

The initial supported set is SEP/TPO/PTR with CHARMM36m July 2024, and ALY with legacy CHARMM36. Select **CHARMM36 · legacy ALY support** for acetyllysine. Methyllysine construction remains available, but its local-relaxation parameters are not bundled. Modified termini and incomplete or unparameterized structures may also be unsupported.

Review force field, preparation pH, radius, restraint strength, maximum iterations, force tolerance and seed. Select **Calculate local relaxation**. This is a cancelable CPU calculation and can take seconds to minutes. A 300-second calculation deadline prevents an unbounded job. Original sources and the previous valid state remain available if preparation fails or the calculation is canceled.

Read the convergence result. An unconverged result has not met the selected RMS-force tolerance. The prepared source control is calculated separately with the same settings; **Prepared baseline** switches geometric comparison to this control. **Return to constructed state** restores the unrelaxed chemistry. Re-running relaxation starts from the retained constructed state. These configurations are local hypotheses under vacuum restraints, not equilibrium folding or binding-affinity predictions. [Methods and limitations](SCIENCE.md) explain the assumptions and units.

## Compare supplied structures

Open a comparison file and use linked views to inspect it. In **Supplied-structure alignment**, propose exact Cα identities or choose reference and comparison chains for a sequence proposal. Review the two atom identifiers on every correspondence line, confirm review, then **Fit comparison**. At least three non-collinear one-to-one pairs are required. RMSD and the transform refer only to the reviewed correspondence. Portable projects retain the original comparison and recalculate the fit when reopened.

## Gene, isoform and processing context

Open **Context**, review or enter a UniProt accession and retrieve context explicitly. The panel shows available gene, organism, transcript/isoform and processing information. Ensembl exon bars are genomic summaries with compressed introns. Select a structural residue to see whether a SIFTS sequence mapping agrees with its identity. A mismatch or missing mapping requires review; the application does not assume a constant author-number offset or invent a unique transcript. Cached context reopens offline even if the reference service later fails.

## Local density maps

Use **Open density map** for a local CCP4/MRC or Gaussian Cube file. Single-dataset density Cube input requires positive grid counts and Bohr coordinates, with at most 32 million grid values; convert Angstrom-grid Cube files first. Up to two maps display at 1.5 sigma and their original bytes are included in the portable project. Confirm the map's coordinate frame, origin, units and relationship to the structure. No automatic registration occurs. Start a new workspace to change the map set.

## Save, reopen and export

**Save** writes a portable `.proteonator` project containing source coordinates, scenario results and method provenance, comparison coordinates and reviewed pairs, maps, notes, named selections, measurements, cached biological context and display preferences. Sources and map/result snapshots have integrity hashes. Save your project before closing; the application prompts before discarding unsaved changes.

**Open project** also imports earlier `.proview`/`.ptmw` files. Original files remain unchanged. Source inputs, selected coordinate model, comparison pairs and residue annotations are migrated. Earlier geometry reports remain attached as historical records; calculate new comparisons under the current methods rather than treating historical results as fresh calculations. Older camera formats cannot always be translated exactly and the view is fitted again.

Export current coordinates as mmCIF, a scientific comparison report as JSON, or a captioned PNG. The PNG includes source identity and the evidence state. Keep the JSON/project alongside an image when sharing a scientific result. The coordinate file alone does not contain every project annotation or all interpretation limits.

## Themes and accessibility

Settings contains Midnight, Liquid Glass and Painted Pixels. Switching skin preserves molecular state and undo history. Reduced motion is initially enabled. Standard readable typography, high contrast, reduced transparency, graphics quality, panel widths and collapsed side panels are available. Customize toolbar buttons and keyboard shortcuts in the same dialog. A hidden toolbar action remains available in Commands and menus.

`Ctrl+O` opens coordinates, `Ctrl+S` saves, `Ctrl+Z`/`Ctrl+Shift+Z` undo/redo chemistry, and `Ctrl+K` opens command search. Shortcuts can be changed. Text fields retain ordinary editing behavior. Escape closes dialogs or cancels a running calculation. The linked sequence supports arrow, Home and End keys; the atom list provides keyboard-accessible measurement selection.

## Troubleshooting and limits

- **Preparation cannot match a template:** inspect the named residue/component and the selected force field. Supply a complete compatible structure. Do not delete an unresolved partner solely to obtain a plausible-looking energy.
- **Unconverged:** review the reported force and preparation; a larger iteration budget can be tried, but a completed job is not evidence of convergence or physical validity.
- **Mapping unavailable:** verify the accession, chain, species, construct and sequence coverage. Continue with the coordinates and cached annotations as appropriate.
- **Map misplaced:** confirm the map origin, scale and coordinate frame with its source. Proteonator does not register it automatically.
- **Large/slow scene:** use lower graphics quality, cartoons or bonds, hide water, and collapse panels. Source/assembly guard: 100,000 atoms; local-response guard: 5,000 atoms before adding hydrogens. File/project size limits appear in the README.
- **Offline:** core work and embedded projects remain available. Online retrieval requires a network connection; no placeholder data are substituted on failure.

Only Windows 11 x64 is a verified installer platform for 1.1. The package is unsigned. Uninstall through Windows Settings → Apps; saved projects and user preferences are retained. Proteonator is an independent scientific exploration tool, not a clinical decision system.

Computed local-response coordinates use occupancy 1 and B factor 0 as display placeholders; these values are not experimental occupancies or uncertainty estimates.

A local response that inverts a retained stereocenter is discarded. Review severe construction clashes or supply a prepared compatible structure rather than interpreting that result.
