<p align="center"><img src="assets/logo.svg" width="112" alt="Proteonator fedora and bill outline"></p>

# Proteonator

**A local molecular workspace for exploring protein structures and post-translational modifications.**

Proteonator brings molecular inspection, supported PTM construction and structural comparison into one desktop application. Open a structure, choose its biological assembly, inspect a residue or ligand, and construct a modification in a separate scenario. See the added atoms, inspect changes in local contacts and geometry, and compare the result with the original coordinates. Save the complete workspace for another session or share a portable project.

Version 1.1 includes a redesigned toolbar, a Mol* molecular viewport, three interchangeable skins, gene and isoform context, and a bundled CPU runtime for supported local minimization. Core viewing, editing, calculations, projects and exports run locally. A separate Python installation, browser account or subscription is not required.

[Download the Windows installer](https://github.com/fishhrbio/Proteonator/releases/download/v1.1.0/Proteonator-Setup-1.1.0-x64.exe) · [User guide](docs/USER_GUIDE.md) · [Scientific methods](docs/SCIENCE.md) · [Changelog](CHANGELOG.md) · [Roadmap](ROADMAP.md)

## See the workspace

![Proteonator Midnight workspace](docs/images/midnight.png)
*Midnight: the default molecular workspace. A supported PTM is constructed as a separate scenario; the comparison reports geometric changes while preserving the source.*

![Proteonator Liquid Glass workspace](docs/images/liquid-glass.png)
*Liquid Glass: frosted translucent panels, luminous edges and softly raised controls around the same scientific tools and data.*

![Proteonator Painted Pixels workspace](docs/images/painted-pixels.png)
*Painted Pixels: original atmospheric artwork and pixel typography. Standard readable text, reduced transparency and high contrast are available in Settings.*

These are captures of the running application. Constructed modifications illustrate hypotheses, rather than experimental observations of a PTM-induced change.

## What you can do

- **Inspect complete structures.** Choose coordinate models and biological assemblies; view proteins, DNA/RNA, ligands, heme, ions, waters and glycans. Switch between cartoons, backbone, bonds, sticks, spheres and surfaces. Adjust component visibility, opacity, clipping and lighting.
- **Work directly with residues and atoms.** Pick in the viewport or linked sequence, inspect an exact chain/residue/atom identity, focus a neighborhood, save named selections and attach residue notes. Measure distances, angles and torsions.
- **Construct supported PTMs.** Phosphorylate serine, threonine or tyrosine; acetylate lysine; or construct mono-, di- and trimethyllysine. Added atoms appear in the viewport. Undo, redo, duplicate, name and switch scenarios.
- **Compare structural environments.** Inspect gained/lost heavy-atom contacts, bond geometry, torsions, added-atom steric overlaps and common-atom displacement. Use linked views or overlays; fit supplied comparison structures with reviewed exact or sequence-assisted correspondence.
- **Calculate a bounded local response.** Run supported OpenMM minimization with explicit preparation, force-field, pH, neighborhood, restraints and stopping criteria. Compare with a separately prepared baseline control. Convergence and calculation provenance remain visible.
- **Connect structure to biology.** Explicitly retrieve UniProt, PDBe SIFTS and available Ensembl records. Inspect gene, organism, transcript/isoform and processing annotations, with verified residue mappings and cached offline context.
- **Keep a portable record.** Save embedded sources, scenarios, maps, notes, measurements, reviewed alignment, cached context and scene settings. Export mmCIF coordinates, structured JSON reports and captioned PNG images.
- **Choose your workspace.** Midnight, Liquid Glass and Painted Pixels share the same functions. Customize shortcuts, toolbar actions, panel widths and accessibility preferences.

## Supported inputs and outputs

| Item | Support |
| --- | --- |
| Coordinates | Local PDB, `.cif` and `.mmcif`; optional retrieval by four-character PDB accession |
| Assemblies | Assembly operators supplied in the coordinate file; explicit asymmetric-unit view |
| Coordinate models | One selected model at a time |
| Local maps | CCP4/MRC and single-dataset density Cube with positive grid counts in Bohr; no automatic map-to-coordinate registration |
| Projects | `.proteonator`; imports of earlier `.proview` and `.ptmw` projects |
| Exports | Current mmCIF, JSON comparison/provenance, captioned PNG |
| Sequence-only input | Does not create a three-dimensional structure; FASTA-to-fold conversion is unavailable |

The coordinate guard is 32 MiB and 100,000 recorded atoms per model or expanded assembly. Local relaxation has a separate 5,000-atom limit before hydrogen preparation. Map files are limited to 128 MiB each, two per project; portable projects are limited to 200 MiB. Performance depends on the structure, representation, graphics driver and calculation. These limits do not guarantee that every unusual chemical component can be parameterized.

## Install and start

**Supported release platform: Windows 11 x64.** macOS, Linux and Windows ARM installers are not supplied or verified for this release.

1. Download `Proteonator-Setup-1.1.0-x64.exe` from the [1.1 release](https://github.com/fishhrbio/Proteonator/releases/tag/v1.1.0).
2. Run the installer, choose the installation location, and finish the setup wizard.
3. Open **Proteonator** from the Start menu or desktop shortcut. A local barnase–barstar example opens automatically.

The installer contains the molecular runtime, examples, fonts, artwork, licenses and offline guide. The Windows package is unsigned; there is no publisher certificate in this release. Verify the download against the release's `SHA256SUMS.txt` if Windows displays an unfamiliar-app prompt. An earlier ProView installation is a separate application; open its saved projects in Proteonator and save new `.proteonator` copies before removing the old application.

## First PTM comparison

1. Choose **Crambin · 1CRN** in **Example**, or open your own PDB/mmCIF file. Select the desired assembly and coordinate model before creating scenarios.
2. Choose a serine in the linked sequence. Open **PTM**, review the modification and chemical state, then select **Construct modification**.
3. Inspect the added atoms and the **Environment & comparison** results. Enable **Overlay** or **Linked comparison** to compare states.
4. If the complete structure and modified residue have compatible parameters, choose the local-response settings and calculate relaxation. Review the convergence result and prepared baseline control.
5. Save the portable project. Export the coordinates, scientific report or captioned image as needed.

Drag to orbit, use the wheel to zoom and right-drag to pan. Arrow keys rotate; Shift+arrows pan; `+`/`−` zoom. `F` fits the molecule. **Commands** (`Ctrl+K`) finds actions; **Settings** contains themes, layout, input and accessibility preferences. The Help menu opens the offline guide.

## Scientific scope

A constructed PTM changes chemistry and local geometry. It does **not** uniquely predict a protein's equilibrium fold, biological activity or binding affinity. Restricted minimization finds a nearby configuration under the selected preparation and restraints; it does not sample an equilibrium ensemble. Raw potential-energy differences between chemically different systems are not binding free energies.

The initial local-response scope covers internal SEP/TPO/PTR residues with the bundled CHARMM36m parameters and internal ALY with the legacy CHARMM36 parameters. Methyllysine construction is available, but compatible relaxation parameters are not bundled. Terminal modifications, missing heavy atoms, unresolved alternates, incomplete chains or unparameterized partners can stop preparation. Display and static comparison remain available. Severe clashes or inverted retained stereocenters reject local response. Construction is a heavy-atom hypothesis; complete protonation and force-field charges belong to the supported preparation and its report. Phosphate templates are **monoanionic**; changing the preparation pH does not switch the phosphate state.

Contacts, overlaps and displacement are geometric descriptors. Biological assemblies follow deposited author assignments. Gene, isoform and processing annotations depend on curated references and successful mapping; a coordinate file alone may not identify a unique gene or transcript. Read the [methods and limitations](docs/SCIENCE.md) before interpreting results.

## Credits and license

I’m Robert Waite, an M.S. Biotechnology student at the University of South Florida. Proteonator is a small independent project I’ve been developing in my free time.

This project is independent and is not endorsed by the University of South Florida. Molecular visualization and calculations depend on the work of the Mol*, Gemmi, OpenMM, NumPy, wwPDB, RCSB PDB, UniProt, PDBe SIFTS and Ensembl communities. The Silkscreen typeface is by Jason Kottke. Original coordinate depositors retain their scientific credit; bundled examples link to their archive records.

Original Proteonator code is available under the [MIT license](LICENSE). Dependency and data terms are listed in [Third-party notices](THIRD_PARTY_NOTICES.md), with full license texts included in the application. Hilbert Curve implementation copyright 1998, Rice University.
