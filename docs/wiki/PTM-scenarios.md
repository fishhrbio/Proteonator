# PTM scenarios

Version 1.1 constructs SEP, TPO and PTR phosphorylation, ALY acetyllysine, and MLZ/MLY/M3L methyllysines from supported parent residues. Source heavy atoms remain fixed during construction; added atoms are attached using CCD ideal geometry. Phosphates use a monoanionic state; methyllysines use cationic states. Review the chemical-state description before interpreting a scenario.

Edits live in separate scenarios. Undo/redo, remove, duplicate and rename help compare alternatives. New/lost 4 Å heavy-atom contacts, bond geometry, torsions, added-atom overlaps and displacement are geometric descriptors. New angles have no measured baseline counterpart. A zero initial common-heavy-atom RMSD is expected when construction preserves those coordinates.

Internal complete SEP/TPO/PTR sites can use the bundled CHARMM36m parameters; internal ALY uses legacy CHARMM36. Methyllysine relaxation parameters are not bundled. Missing heavy atoms, modified termini, unresolved alternate sites or unparameterized partners can stop preparation without preventing visualization.

Local response is restricted vacuum minimization with explicit pH, neighborhood, harmonic restraints, iteration budget, force tolerance and seed. The prepared baseline is calculated separately. Review convergence; a completed but unconverged result remains unconverged in the report. Return to constructed state restores the unrelaxed chemistry. Re-running begins from that constructed state.

Source, constructed and locally relaxed states have distinct evidence labels. None establishes global equilibrium folding, biological modification of the site or binding affinity. Potential-energy differences across different chemical systems are not binding free energies.
