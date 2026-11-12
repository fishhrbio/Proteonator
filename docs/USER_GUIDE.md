# ProView user guide

ProView 1.0 is a local protein structure visualizer. It opens coordinates, links molecular and residue views, adds annotations, calculates interface geometry and compares supplied structures. Installed operation needs a compatible graphics driver, but no separate programming runtime, account or internet connection.

## Open and inspect

Choose **Open coordinates** (`Ctrl+O`) for `.pdb`, `.ent`, `.cif` or `.mmcif`. The bundled 1BRS and 1CRN examples are available offline. **Retrieve from RCSB** makes an explicit public download for the accession you enter; it sends no local coordinate data. Retrieval is limited to 10 seconds and 5 MiB. On failure, your current structure remains available.

Choose a coordinate **Model**, then protein **Partner A** and **Partner B** chains. The viewport shows the active canonical-protein atoms in these chains. The inspector uses the original author numbering and insertion codes; mmCIF label chain names are shown alongside differing author names. Alternate conformers are selected per residue by highest mean occupancy, with A then lexical tie-breaking. Shared blank atoms win over an alternate atom of the same name. Zero-occupancy atoms are inactive; missing occupancy is unknown and treated as active. This policy does not mix unmatched alternate labels to fill missing atoms.

Click the molecule or a residue button to inspect an identity. In the sequence strip, left/right arrows move focus, Home/End jump to the chain boundaries, and Enter or Space selects. **Focus selection** centers the selected residue. The viewport supports dragging, wheel zoom, and keyboard controls while focused: arrows rotate, Shift+arrow keys pan, `+`/`-` zoom, and `F` fits the view. These controls make rotation and zoom available without a pointer. Numeric scientific results and correspondence are also available as text; the 3D shape itself does not have a screen-reader-equivalent spatial description.

Choose backbone trace, sticks or spheres. **Clipping depth** hides parts outside the near/far slab for visual inspection. **Reduced motion** starts enabled; disable it to allow animated focus transitions. Inferred display bonds are visual aids rather than validated chemical connectivity. Source coordinates stay unchanged when you move, clip, align or restyle the view.

## Annotate a residue

Select a residue, choose a PTM type and enter a nonempty label. **Add or update annotation** stores a user note. **Remove annotation** removes it. An annotation never constructs atoms, changes chemistry, predicts a site or demonstrates a PTM effect. Save a project to retain annotations.

## Calculate interface geometry

Choose two distinct protein chains in one coordinate model and select **Calculate interface**. The calculation reports minimum heavy-atom distance, atom-pair contacts at or below 4.0 Å, unique contacting residue pairs and geometric overlap candidates. **Show closest pair** connects the actual measured atoms. **Method, exclusions & provenance** contains the source hash, selection policies, units and calculation method. **Export JSON** writes the full result.

Only active canonical-protein ATOM records with known heavy elements are eligible. Hydrogens, waters, ligands, unsupported modified residues and unknown elements are excluded. Contacts include all eligible atom pairs. Overlap candidates use the Bondi C/N/O/S/P radii and overlap strictly greater than 0.4 Å (10⁻¹² Å boundary tolerance); explicit CONECT 1–2 and 1–3 neighbors are excluded from overlaps. Other elements have no invented overlap radius. Incomplete connectivity means candidates require chemical review and are not a validated clashscore. These static geometric values do not measure affinity, energy or biological function.

## Compare two supplied structures

Expand **Compare supplied structures**, open a mobile PDB/mmCIF file and choose reference and mobile chains/models. **Propose Cα pairs** matches exact author residue numbers, insertion codes and residue names. Review all pairs.

For different numbering, edit the two-column list: reference residue, mobile residue, one pair per line. Include insertion codes (`10A 14`, for example). Choose **Review edited pairs** after every edit. At least three non-collinear pairs are needed, and each residue may appear only once on each side. Missing Cα atoms, inactive conformers and ambiguous residue identities are rejected. Different residue names are identified for explicit review rather than silently treated as equivalent. This is explicit correspondence, without automated sequence or homology alignment.

Confirm the correspondence and choose **Fit mobile to reference**. The fit is rotation plus translation, with no reflection, scale or coordinate optimization. Fitted RMSD and every matched residue's displacement appear as text. The reference stays teal/blue; the mobile display is orange. Amber connectors show up to 500 fitted atom displacements at true scale; tiny coincident displacements are omitted from drawing, and every value remains in the numeric result. Use **Comparison overlay** to show or hide it. **Export alignment JSON** includes the transform, correspondence, both source hashes, fitted displacements and limitations.

A fit depends on your correspondence and supplied coordinates. A small RMSD cannot verify a biological relationship or establish that a change was caused by a PTM. The bundled synthetic comparison fixture deliberately changes coordinates for testing and illustration.

## Save, reopen and export

**Save project** (`Ctrl+S`) creates a portable `.proview` file containing original coordinate text, hashes, annotations, the selected reference/mobile sources, alignment and geometry results, selections, representations, camera and clipping. Copy this one file to another tested ProView installation to reopen offline. Saved source identities and derived results are re-imported and recalculated before acceptance. A corrupted or inconsistent file is rejected without replacing the open workspace.

Legacy schema 1.0.0 `.ptmw` geometry projects are migrated in memory. Save them with the new `.proview` extension. Unknown future versions are rejected without modifying the input file. Project replacement uses a temporary file beside the destination; a failed write preserves the previous destination and reports the error. Select a writable folder and retry.

**Export PNG** saves the actual viewport plus a provenance caption, source hash, analysis/alignment context and scientific limitations. The image contains the current displayed representation and clipping. Geometry and alignment JSON are separate scientific exports; they do not replace a portable project. Original PDB/mmCIF coordinates are retained verbatim within the project, and no transformed coordinate file is emitted.

ProView asks before discarding unsaved changes when replacing a workspace or closing the window. Cancel a running calculation with **Cancel calculation** or Escape. A cancelled or failed job does not prevent the next calculation.

## Limits and troubleshooting

- Inputs: 5 MiB and 25,000 recorded atoms per structure. Projects: 50 MiB. Geometry: 25 million cross-partner pairs and 100,000 output pair records. Workers have a 30-second calculation deadline. Limits produce explicit errors rather than silent truncation.
- mmCIF support covers coordinate atom_site loops, not the entire dictionary, connectivity categories, multiple coordinate data blocks or BinaryCIF. PDB hybrid-36 serials are unsupported. Missing atoms/residues, biological assemblies and secondary-structure assignments are not reconstructed. The trace follows the supplied protein backbone; it is not an independently assigned helix/sheet classification.
- A single-chain structure can be inspected and annotated; interface calculation needs two distinct protein chains. Non-protein polymers, waters, ligands and unsupported modified residues are retained in the input and normalized data but hidden in this protein viewport.
- If the view cannot initialize, update the graphics driver and use a system with WebGL support. ProView does not claim a fallback 3D renderer.
- If retrieval fails, use a local coordinate file or a bundled example. Save, reopen, alignment and exports work offline.
- Windows 11 x64 is the tested target. The installer is unsigned, so Windows may show an unknown-publisher or SmartScreen reputation prompt. There is no claim of Windows 10, ARM64, macOS or Linux verification for this release.

Use the repository's issue tracker to report a problem, describing the operation and error. Share only coordinate or project files you are permitted to disclose; no diagnostic upload happens automatically.

## Credits and license

I’m Robert Waite, an M.S. Biotechnology student at the University of South Florida. ProView is a small independent project I’ve been developing in my free time.

ProView is independent and does not imply institutional endorsement. The original code and icon use the MIT license. Visualization: 3Dmol.js (Rego and Koes, 2015). Runtime: Electron and its included third-party components. Validation: Zod. Example coordinates: the original 1BRS and 1CRN depositors through the wwPDB/RCSB archive, CC0-1.0. Consult `THIRD_PARTY_NOTICES.md` and the installed Electron/Chromium license files for complete notices.
