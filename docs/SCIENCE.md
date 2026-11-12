# Scientific methods

Distances and fit displacements are expressed in Å. Normalized identities preserve source hash, coordinate model, author chain/residue identity, insertion code, alternate label and atom identity. mmCIF label chain/residue identities are retained separately. Source text and normalized coordinates are checked again when opening a project.

## Interface geometry

For each eligible cross-partner atom pair, ProView evaluates `sqrt(dx² + dy² + dz²)` from source coordinates. It takes the minimum directly, counts distances ≤ 4.0 Å and deduplicates the contacting residue pairs. Eligibility and alternate-conformer policies are in the user guide and serialized result provenance. Display transforms and inferred visualization bonds do not enter this calculation.

Overlap is `radiusA + radiusB − distance`, using Bondi radii C 1.70, N 1.55, O 1.52, S 1.80 and P 1.80 Å. A candidate requires overlap > 0.4 Å beyond a 10⁻¹² Å tolerance. The tolerance resolves binary floating-point boundary noise rather than rounding coordinates. Explicit CONECT 1–2/1–3 neighbors are excluded from overlaps, while contacts remain included. Unknown radii are counted and excluded from candidate overlap results. Connectivity remains incomplete, particularly for mmCIF, where bond categories are not reconstructed.

The independent Python reference enumerates the exact 1BRS A/D atom-pair sets. Expected results are minimum distance 2.497251489137609 Å, 165 contacts, 36 unique residue-pair contacts and one overlap candidate among 598,752 evaluated pairs. Tests additionally check analytic distances, inclusive/strict boundaries, alternate conformers, unknown chemistry, explicit bonds, cancellation and resource caps. This verifies the stated geometry implementation; it does not validate a physical interaction model or a clashscore.

## Proper rigid alignment

The user supplies a one-to-one set of atom correspondences. The desktop editor maps active canonical-protein Cα atoms in one selected chain/model per structure. At least three non-collinear points are required. After subtracting centroids, the implementation obtains the proper least-squares rotation using Horn's symmetric quaternion eigenproblem and a Jacobi eigensolver, then derives the translation. The transform has orthonormal rows and determinant +1; reflections and scaling are prohibited. The serialized method identifier is `kabsch-no-reflection`, describing the same proper least-squares fitting objective.

Fitted RMSD is the square root of the mean matched squared distance after transformation. Per-residue displacement uses only the explicitly matched atoms of that residue pair. Source coordinates remain authoritative; the mobile overlay is a display transform. Pair identity review is separate from numerical fitting. No sequence alignment or homology inference is performed.

An independent NumPy SVD implementation checks transforms, fitted RMSD and every per-residue displacement on fixed seeded rigid, perturbed and reflected coordinate sets. The points are serialized through PDB first; a nominally exact generated transform can therefore retain sub-milliångström residuals from PDB's three-decimal coordinate precision. Non-collinear analytic inputs also verify the known transform without this precision ambiguity. Gemmi separately cross-checks all retained atom positions and author identities for public and synthetic fixtures. See `evidence/independent-verification.json` and `evidence/numerical-verification.json` for the executed values and versions.

## Scope

Annotations describe user hypotheses and never alter coordinates. Missing coordinates, chemical construction, protonation, hydrogen optimization, force-field energy, docking, dynamics, biological causality and affinity are outside these calculations. The viewport displays active protein partners; preserved non-protein data does not imply it participates in the analysis. Secondary structure and biological assemblies are not inferred. Independent mathematical checks do not establish biological validity of a supplied structure or correspondence.

Method citations and licenses are listed in [third-party notices](../THIRD_PARTY_NOTICES.md).
