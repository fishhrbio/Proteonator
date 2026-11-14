# Proteonator 1.2 user guide

## Install, upgrade and start

Choose the Windows 11 x64 installer, the macOS 15 disk image for Apple Silicon or Intel, or the Ubuntu 22.04/24.04 x64 Debian package from the [release page](https://github.com/fishhrbio/Proteonator/releases/latest). Other operating-system/processor combinations are not verified. Each package includes its scientific runtime, examples, fonts, artwork, licenses and this offline guide. No separate Python environment is needed. Compare its SHA-256 checksum with the release manifest when checking the download.

**Windows:** installation is for the current user; choose the destination and finish the wizard. The installer is unsigned. Start from the Start menu or desktop shortcut. Uninstall through Windows Apps or the installed uninstaller.

**macOS:** choose the disk image for your processor, open it, then drag Proteonator into Applications. In Finder, **About This Mac** identifies an Apple chip or Intel processor. The application has an ad-hoc signature and is **not signed with an Apple Developer ID or notarized**. macOS may block first opening. If you trust the source and have checked the checksum, follow [Apple’s instructions for opening an app from an unidentified developer](https://support.apple.com/en-us/102445). A signature-integrity check does not establish Gatekeeper approval. To update, quit the app and replace the copy in Applications. To uninstall, move that copy to Trash; projects and personal settings remain.

**Ubuntu:** download the `.deb`, open a terminal in its folder and run:

```sh
sudo apt install ./Proteonator-1.2.1-linux-x64.deb
```

Open Proteonator from the applications menu, or run `proteonator`. The installer registers `.proteonator` projects and resolves desktop-library dependencies. Use the same command with the new package to update. Remove the application with `sudo apt remove proteonator`; projects and personal settings remain. Administrator permission is needed to install or remove the system package, not to run the application. Keep the normal application sandbox enabled.

Save your work and close Proteonator before installing an update. Keep copies of important projects and save changed work as a new `.proteonator` file. Application files are separate from projects and personal settings. Removal retains those personal files. An older, separately named application is not silently removed. Native platform checks cover the listed operating systems; they do not establish every graphics driver, manual screen-reader compatibility or Gatekeeper approval.

A local barnase–barstar example opens initially. Core viewing, sequence work, calculations, help, save/reopen and exports work offline. Retrieve coordinates, retrieve curated context and check the published version only when you choose those actions. No coordinate or sequence file is uploaded by these reference lookups.

## Choose a workspace

**Molecule** works with supplied coordinates. **Construct & RNA** works with sequences, chemical requirements and processing states; it can also retain a reviewed correspondence to an open molecular chain. **New construct project** starts without fabricated coordinates. Switching workspace does not convert a sequence into a fold.

Use Save project, Open project, Recent projects and Recover autosave along the top. The project heading marks unsaved work. Commands (`Cmd+K` on Mac, `Ctrl+K` elsewhere) supports synonyms, favorites and recent actions, with reasons when an action is unavailable. Settings contains layout presets, panel controls, toolbar shortcuts and all three skins.

## Build a construct from actual sequences

Import declared protein/DNA/RNA text or FASTA, or open a GenBank record. Molecule type is explicit. Protein states accept the 20 canonical amino acids; unsupported ambiguous/noncanonical cases produce an error. Source documents and their hashes are embedded. GenBank features keep source coordinates and strand. CDS translation respects the supplied genetic code, codon_start, reverse strand and joined locations. Recoding, partial CDS and annotation conflicts require review rather than guessed repairs.

Add exact components with names, roles and source/version references. Reorder them before creating the encoded construct. Component templates can be saved locally. A name such as “fusion partner” does not establish biological identity: use the actual sourced sequence.

The Features tab shows source-provided annotations separately from engineered components. Feature/domain JSON imports require a matching record identity and sequence hash. A source feature interval is zero-based, start-inclusive/end-exclusive in the interchange file; displayed positions are one-based. An imported protein is not assigned to a unique gene or splice transcript just because its letters match an alignment.

## Declare processing and mature chemistry

Select the encoded or intermediate state, then open Processing. Cuts are declared after one-based residue positions. Virtual cleavage creates separate fragments with retained residue identities; trimming and amidation are separate operations. A cross-fragment disulfide prevents a simple independent-fragment cleavage interpretation.

The glycine-donor amidation action requires a terminal glycine, removes that donor residue and explicitly changes the resulting C terminus to an amide. Desired disulfides pair two unpaired cysteines. These operations represent proposed product chemistry, not demonstrated processing efficiency or reaction mechanisms.

Declare the target sequence and terminal/disulfide requirements. Compare exact sequence identity separately from chemical design compliance. “Requirements met (design)” is not experimental confirmation. The inspector reports elemental formula, neutral monoisotopic mass, average mass and the accounting convention. FASTA does not retain terminal chemistry or bond pairing: keep its JSON sidecar.

Attach evidence to its actual state, with a source and planned, observed or interpreted status. A sequence-confirmation record does not automatically confirm cleavage, amidation, disulfide pairing, purity or activity.

## Work with coding RNA/DNA

Choose the exact protein state before back-translation. Generated sequences are designed coding segments in 5′→3′ orientation. Choose the genetic code and deterministic, seeded or explicitly sourced codon-usage policy. Candidates preserve their seed, policy, exact synonymous alternatives and the possible-encoding count. They retranslate to the source protein. They do not silently add a start, stop, UTR, promoter or mature-processing extension.

A complete supplied CDS is different from an internal coding segment. Complete-CDS translation requires the declared initiation and terminal-stop rules. Source CDS codons remain linked to their actual nucleotide positions and strand. Residue/codon buttons are paged and keyboard navigable.

For local RNA folding, provide unambiguous A/C/G/U input and explicit temperature, salt, dangles, lonely-pair and probability-cutoff settings. Review the dot-bracket structure, energies, probabilities and circular schematic. The drawing is two-dimensional and schematic. Export SVG and keep the method metadata.

Imported RNA roles come from source annotations or sequence-bound evidence. Import supported RNA-analysis JSON, Infernal cmsearch/cmscan tblout format 1/3, or standard tRNAscan-SE tables with exact sequence hash, method/settings and database/threshold provenance. These external engines/databases are not bundled. A no-hit or conflicting result remains unresolved; an ORF does not prove mRNA identity, and protein back-translation does not recover translating tRNA molecules.

## Inspect structures and select residues

Open PDB or mmCIF, choose the coordinate model and assembly, and inspect components. Assembly copies retain distinct identities. Scenario branches are preserved when switching model/assembly. Source coordinates remain embedded and unchanged.

Drag to orbit, wheel to zoom, right-drag to pan. Arrow keys rotate; Shift+arrows pan; +/− zoom and F fits. Pick residues/atoms/chains in the viewport or use the linked sequence. Shift selects a range; Ctrl/Command adds selection. Arrow/Home/End navigation crosses paged sequences without rotating the molecule.

Workspace tools supports chain/author-position/component queries and set operations. An exact insertion code differs from a numeric range. Choose a neighborhood radius and component filter; isolate a selection or show complete components. Save named selections and camera/display views. Imported annotations, structural author numbering and construct positions remain distinct until mapped.

## Construct and compare chemical scenarios

Select source residues, review construction readiness and choose a supported PTM. Reviewed multi-site edits commit together; a failure preserves the previous valid state. Undo/redo belongs to its scenario. Organize names, folders, tags and pins, or import an edit table bound to the exact source/model/assembly after reviewing every site.

Canonical substitutions rebuild selected side chains in a retained backbone frame. A reviewed sequence-to-structure mapping can propose those substitutions; missing/unmapped segments are not modeled. Explicit side-chain links and incompatible geometry stop construction.

Terminal primary-amide construction requires a complete observed terminal carboxyl group and at least two canonical residues in the chain. It uses validated CHARMM CT2 preparation. Explicit disulfide construction requires two canonical cysteines whose sulfurs are already 1.8–2.3 Å apart; it does not fold distant residues together. Biological mature termini and actual product identity still require supporting evidence.

Contact inspection provides adjustable inclusive distance cutoffs, sortable/filterable atom pairs, residue summaries and full CSV. Typed interactions use Mol* geometric classification and expose their parameters. Neither feature measures affinity. Measurements can be named, hidden, deleted and repositioned; missing atoms make a measurement unavailable. Export the full measurement table as CSV.

Local response requires complete, compatible chemistry. Choose the force field, pH, radius, restraints, stopping criteria and seed. Supported preparation transfers explicit covalent/disulfide links and rebuilds hydrogens. Methyllysine parameters are not bundled. Legacy CHARMM36 is required for acetyllysine, hydroxyproline and supported primary amides; phosphate residues use the explicitly listed monoanionic CHARMM36m templates. Mixed incompatible parameter requirements stop calculation.

Review convergence and the separately prepared baseline. Unconverged results remain labeled. Return to the constructed state when appropriate. A short restrained minimization is not equilibrium folding, expression prediction or a binding free-energy calculation.

## Alignment, confidence and maps

Open supplied comparison coordinates and propose exact or sequence-assisted correspondence. Review the mapping table, missing/inactive rows and one-to-one identities. Fit rows determine the proper rigid transform; evaluation rows measure displacement in that reference frame. Excluded/missing rows remain gaps in exported profiles. No outlier is silently removed. Use linked or independent cameras.

Confidence/validation imports require an exact coordinate/source/model/assembly binding, explicit metric, units, source and method. B factors are not automatically pLDDT. Profiles from other coordinate states remain visibly different/stale and are not attached to edited structures as fresh validation.

Open local CCP4/MRC or supported Cube maps. Adjust each map’s relative/absolute contour, color, opacity and visibility, or replace/remove it. Original bytes and hashes remain in the project. Verify coordinate frame, origin and units; no registration, resampling or model-to-map validation is implied. Camera clipping changes the view rather than the source grid.

## Imported coordinate frames

Trajectories accepts a bounded registered JSON format: export the current topology registration, retain the exact ordered atom identities/hash, and supply actual frames in declared Å or nm. Supports 2–200 frames, at most 5,000 atoms and a 32 MiB input file. Trajectories require strictly increasing supplied times in ps; ensembles have no inferred time axis.

Imported frames appear in the comparison view while the primary coordinates remain unchanged. Inspect/export actual frames or calculate heavy-atom RMSD to the first frame and RMSF about the arithmetic mean. These calculations are unaligned and include rigid-body movement. Imported samples do not establish equilibrium, convergence or causal PTM effects.

## Save, recover and share

Portable projects embed sources, processing states, chemistry, coding candidates, mappings, evidence, scenarios, maps, frames, measurements, views and scientific settings. Hashes and format limits are checked on reopen. Compression is optional; it does not change scientific values. Earlier project formats are imported into new copies, and historical calculations retain their original meaning.

Autosave waits until operations finish and keeps two bounded generations. Recover opens a copy; if the latest snapshot is unreadable, the earlier retained copy is tried and identified clearly. Use Save As to preserve recovery. It does not overwrite the original saved project. Recent-project previews are local convenience data; corrupt preferences cannot damage a project file.

Reports include sequence/chemistry JSON and readable HTML, original GenBank, FASTA with sidecars, full CSV, processing/RNA/profile SVG and molecular PNG. Figure presets control dimensions, background and caption placement. Molecular PNG is raster, while exported diagrams/profiles are vector. Keep companion metadata when sharing.

Review ZIP contains its previewed project/report/figure materials and SHA-256 manifest. It includes imported sources and notes, so inspect it before sharing. Saved-view storyboards export numbered stills with captions. WebM exports a bounded camera presentation of fixed coordinates, not molecular simulation or a folding movie.

## Accessibility and troubleshooting

Midnight, Liquid Glass and Painted Pixels share the same windows and calculations. Settings provides reduced motion/transparency, standard typography, high contrast and panel/layout controls. Dialogs and sequence controls support keyboard operation. Ctrl+O opens, Ctrl+S saves, Ctrl+Z/Ctrl+Shift+Z undo/redo, Ctrl+K searches commands. Text inputs retain ordinary editing shortcuts. Escape closes a dialog or cancels an active calculation.

A failed import/calculation leaves the prior valid state available. Read Jobs for status and error details. If preparation fails, review missing atoms, alternate conformers, chain breaks, explicit connections, force-field scope and atom limits; do not remove partners merely to obtain a numerical result. If WebGL cannot initialize, check the graphics driver. Lower graphics quality or simplify representations for large structures.

For interpretation, units, defaults, input restrictions and references, see [Scientific methods](SCIENCE.md). Original code and third-party licenses are included with the installation.

## Named sequence variants and recognition rules

Construct contains a named variant editor for replacements, insertions before a source position, and inclusive deletions. Review the impact preview before creating the new state. The old sequence, chemistry, codons, mappings and evidence remain attached to the original state. The new variant starts with fresh residue identities and free terminal chemistry for review. The difference track shows the declared source interval and replacement. Component edits similarly change the editable component set; reassemble to create a new encoded state.

Processing can scan a supplied reagent recognition rule. Provide the exact motif (X means any standard amino acid), the cut offset within that motif, a version, source and evidence/context. Review all matches and extra sites; at most 99 internal cut boundaries may be created at once. Literal matching does not establish reagent specificity, accessibility, processing efficiency or confirmed cleavage. Rule provenance stays with each planned fragment and the report. Target-boundary text shows extra N/C residues or ambiguous target occurrences.

Features can select a source-linked protein region; nucleotide features use actual CDS codon positions. An edited or ambiguous protein needs a fresh reviewed correspondence. The selected-residue view distinguishes state, encoded/source, component, target and structural numbering where supported. Coding candidate comparison shows exact codon changes, GC and supplied usage weights for candidates encoding the same protein. It has no expression-quality score.

Previous/next focus revisits focused molecular regions within the same source/model/assembly. Workspace tools can dim surroundings while retaining their original component styles; Show full structure restores them. During a calculation, the retained molecular view can still be navigated and inspected. Conflicting edits are disabled. Jobs shows method settings and exact request identities, useful errors and cancellation.

Molecular notes retain the scenario and coordinate-state identity where they were written. Earlier unbound notes are marked historical. Scenario summaries expose cached geometric comparisons with their coordinate and baseline hashes; energy from different chemical systems is not a common affinity score. Imported local-response results without the 1.2 preparation trace are marked historical and need recalculation from their constructed state. New chemical construction selects its compatible force-field default; review all parameters before calculating. Saved settings are retained on reopen.
