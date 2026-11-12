# Portable projects and compatibility

ProView 1.0 writes `.proview` project format `proview-project`, schema 2.0.0. Molecular, annotation and analysis contracts remain version 1.0.0. Runtime Zod contracts in `src/contracts/index.ts` are authoritative; generated JSON Schemas describe the serial shape and cannot express every semantic invariant.

A project contains one reference structure and an optional supplied mobile structure. Original UTF-8 coordinate text is embedded and SHA-256 identified. Source data are not replaced by rendered coordinates. The comparison records selected chain/model identities, explicit one-to-one atom correspondence, the derived proper rigid fit and per-residue displacements. View state records partner selections, representation, camera, clipping, selection, reduced motion and overlay visibility.

Opening verifies input hashes, re-imports normalized structures and compares their coordinates and identities, validates references and re-runs every stored geometry/alignment result. Revalidation compares scientific values while allowing the calculation timestamp to differ. Duplicate mappings, inactive alternates, wrong sources and modified derived values reject before replacing the workspace.

Legacy `ptm-desktop-project` 1.0.0 geometry files migrate to 2.0.0 in memory. Geometry method naming is normalized to `proview-geometry-1` without changing the calculation. Legacy parser diagnostic prose is refreshed from the preserved input, while all normalized coordinates and identities remain checked. No legacy alignment extension is inferred. Unknown versions fail without modifying the file.

Limits: two embedded sources, one reference structure, 5 MiB and 25,000 recorded atoms per input, 50 MiB per project, 20 retained geometry results and 10,000 annotations. The current workspace saves one displayed geometry result and one current alignment. Original inputs remain embedded and do not depend on absolute paths. Saves use a temporary sibling and replacement rename; power-loss durability is not guaranteed.
