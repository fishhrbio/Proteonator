# Fixture provenance and use

`PROVENANCE.json` records exact byte counts, SHA-256 values, sources and recovery/generation dates. Original retrieval timestamps were unavailable and are left null. No private molecular data is included.

| Fixture | Source or generation | Purpose |
|---|---|---|
| `structures/1CRN.pdb` | [RCSB 1CRN](https://www.rcsb.org/structure/1CRN), Hendrickson and Teeter | Small observed-coordinate example; 327 atoms, 46 residues |
| `structures/1CRN.cif` | [RCSB 1CRN mmCIF](https://files.rcsb.org/download/1CRN.cif) | Cross-format atom-site import check; 327 atoms, 46 residues |
| `structures/1BRS.pdb` | [RCSB 1BRS](https://www.rcsb.org/structure/1BRS), Buckle, Schreiber and Fersht | Multi-chain observed-coordinate example; 5,153 recorded atoms |
| `synthetic/barnase-comparison.pdb` | Renumbered, transformed and locally perturbed 1BRS chain A | Alignment test and illustration; **not an observed conformation** |
| `synthetic/crambin-grid-48.pdb` | 48 translations of 1CRN, separated on a 100 Å grid | 15,696-atom parser load test; **not an observed assembly or biological model** |
| `synthetic/distance-3-4-5.pdb` | Two artificial coordinate records | Exact distance expectation of 5 Å |
| `synthetic/contact-boundary.pdb` | Two artificial coordinate records | Inclusive 4 Å contact boundary |
| `synthetic/insertion-alternates.pdb` | Four artificial coordinate records | Residue numbering and occupancy-selected alternate identity |
| `ccd/*.cif` | Eight public CCD components | Reference inventory only, not a chemistry implementation |

PDB archive data are distributed under [CC0 1.0 according to wwPDB](https://www.wwpdb.org/about/usage-policies). Attribute the original depositors when sharing these structures. The synthetic grid is derived from the public 1CRN coordinate file and is prominently labeled artificial. The public PDB/mmCIF coordinates are cross-checked against Gemmi; this checks the supplied fixtures rather than full mmCIF dictionary compliance.

`expected/1BRS-A-D.json` contains the independently calculated expectation and exact atom-serial pair lists. `expected/synthetic.json` contains the simple numerical/identity expectations. `scripts/reference_geometry.py` recomputes the real-fixture oracle. Analytic tests use independent fixed-column test builders. Never present a synthetic fixture as an experimental structure.
