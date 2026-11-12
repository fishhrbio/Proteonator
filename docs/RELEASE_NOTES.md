# ProView 1.0.0

ProView is a standalone local protein structure visualizer for Windows 11 x64. This release includes PDB/mmCIF import, linked residue inspection, source-preserving PTM annotations, interface geometry, reviewed Cα structural alignment, fitted displacement overlays, portable projects, JSON results and captioned PNG exports.

The installer bundles Electron, the scientific engine, visualization library, examples, an offline user guide, licenses and fixture provenance. No separate Node.js or Python installation is required. All core operations work offline. Public RCSB retrieval is optional and explicit.

Portable projects use schema 2.0.0. Legacy `.ptmw` schema 1.0.0 geometry projects migrate in memory and can be saved as `.proview`; their original files are not overwritten during opening. Projects preserve both source coordinate inputs and revalidate derived scientific results on reopen.

The Windows installer is unsigned. No signing certificate was available. macOS, Linux, Windows ARM64 and Windows 10 were not tested and are not supported claims for this release. There is no notarization claim. Public release files should be obtained from the repository's release page and checked against the accompanying SHA-256 file.

Scientific results describe supplied static coordinates and reviewed correspondences. They do not establish PTM effects, biological causality, binding affinity or clinical significance. Waters, ligands, unsupported modified residues and non-protein polymers are preserved in input data but hidden from the protein viewport and excluded from interface geometry. See the user guide for supported format semantics and resource limits.

Original code and icon: MIT license, Robert Waite. Third-party software and coordinate credits remain in `THIRD_PARTY_NOTICES.md` and the installed notice files. This is an independent project without institutional endorsement.
