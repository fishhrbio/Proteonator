# Interchange formats

Portable project version 4 preserves source documents, hashes, identities and scientific settings. Earlier version 3 and supported historical formats are read into new copies. Future unknown versions or hash mismatches reject before replacing the workspace. Expanded project data is bounded at 200 MiB.

Sequence feature/domain JSON uses format `proteonator-sequence-features`, an existing `recordId`, exact `sequenceSha256` and feature objects with type/name, zero-based start-inclusive/end-exclusive intervals, strand ±1, source and evidence. Protein display positions are one-based. Source codon-position arrays use zero-based nucleotide offsets, with strand retained separately.

RNA evidence JSON uses `proteonator-rna-analysis`, an existing nucleotide `recordId`, exact sequence hash, method/version/settings, database/model/threshold description and interval/score/family entries. RNA hit intervals are one-based inclusive; strand is explicit where supplied. Scores/E-values and inclusion thresholds are not calibrated probabilities.

Residue evidence JSON uses `proteonator-residue-evidence`, version 1, exact source/coordinate hashes, model/assembly, metric, units, method, source and unique structural-residue values/notes. pLDDT requires its explicitly labeled 0–100 scale. This is supplied evidence, not a newly calculated confidence score.

Edit tables use `proteonator-edit-table`, version 1, exact source hash/model/assembly and supported residue/modification entries. Disulfides require a distinct partner. They are reviewed before construction and do not map residue numbers across unrelated proteins.

Trajectory JSON uses `proteonator-trajectory`, version 1, exact topology hash and ordered atomIds, declared `angstrom`/`nanometer` units, `trajectory`/`ensemble` semantics, source/method and frame positions. Trajectory times use ps and must increase; ensembles omit time. Export topology registration from the app before preparing actual external frames. No DCD/XTC import or interpolation is implied.

FASTA does not encode disulfides, termini or full evidence. Keep its sidecar. Original GenBank export preserves the actual imported record. Review ZIP is a flat, bounded archive with a per-file integrity manifest.
