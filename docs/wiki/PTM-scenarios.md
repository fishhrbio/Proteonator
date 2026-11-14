# Chemical scenarios

Create a separate scenario for supported phosphorylation, acetylation, methylation or trans-4-hydroxyproline. Preflight distinguishes construction eligibility from parameter/preparation requirements. Reviewed multi-site edits commit atomically. Undo/redo stays with the scenario; folders, tags and pins organize alternatives. Edit tables require exact source/model/assembly and reviewed sites.

Canonical substitutions use CCD L-residue side chains in a retained N/CA/C frame. Explicit side-chain links, alternates, incomplete backbone and incompatible stereochemistry reject construction. This does not predict a new fold.

Primary terminal amides require the observed complete canonical carboxyl terminus of a chain with at least two residues. CT2 preparation uses legacy CHARMM36, explicit C–NT topology and two amide hydrogens. Explicit disulfides require unpaired cysteines already1.8–2.3 Å apart; distant cysteines are not folded together.

Local response uses complete supported chemistry, explicit pH/forcefield/radius/restraints/iteration/tolerance/seed and a separately prepared baseline control. Covalent/disulfide identity is transferred before hydrogen preparation. Legacy CHARMM36 covers supported ALY/HYP/CT2 cases; listed monoanionic phosphate templates use CHARMM36m. Methyllysine relaxation parameters and incompatible mixed parameter requirements are unavailable.

Review convergence and provenance. Unconverged results are labeled. Potential-energy differences across chemically different systems are not binding free energies. Short vacuum minimization does not establish equilibrium folding, biological activity or expression yield. Read the [full method](https://github.com/fishhrbio/Proteonator/blob/main/docs/SCIENCE.md).
