# Third-party notices

ProView's original code and icon are copyright © 2026 Robert Waite, released under the MIT license in `LICENSE`. This does not replace any dependency or data license.

| Component | Purpose | License / included notice |
| --- | --- | --- |
| 3Dmol.js 2.5.5 | Local WebGL visualization and inferred display bonds | BSD-3-Clause, `licenses/3dmol-LICENSE.txt` |
| Zod 4.6.7 | Runtime validation of scientific and project data | MIT, `licenses/zod-LICENSE.txt` |
| Electron 45.3.0 | Bundled desktop runtime | MIT, `licenses/electron-LICENSE.txt`; installed `LICENSE.electron.txt` |
| Chromium, Node.js and Electron's runtime dependencies | Embedded runtime components | Installed `LICENSES.chromium.html` and Electron notice files |
| wwPDB / RCSB coordinate archive | Bundled 1BRS and 1CRN examples | CC0-1.0; original depositors and exact file provenance in `fixtures/PROVENANCE.json` and `fixtures/README.md` |

3Dmol.js: Nicholas Rego and David Koes, “3Dmol.js: molecular visualization with WebGL,” Bioinformatics 31(8), 1322–1324 (2015). [Publication](https://doi.org/10.1093/bioinformatics/btu829), [project](https://3dmol.org/).

1BRS: Buckle, Schreiber and Fersht, “Protein-protein recognition: crystal structural analysis of a barnase-barstar complex at 2.0-Å resolution,” Biochemistry (1994). [RCSB record](https://www.rcsb.org/structure/1BRS).

1CRN depositors: W. A. Hendrickson and M. M. Teeter. Primary entry citation: M. M. Teeter, “Water structure of a hydrophobic protein at atomic resolution: Pentagon rings of water molecules in crystals of crambin,” PNAS 81, 6014–6018 (1984). [RCSB record](https://www.rcsb.org/structure/1CRN).

Overlap radii use the C/N/O/S/P subset from A. Bondi, “van der Waals Volumes and Radii,” J. Phys. Chem. 68(3), 441–451 (1964). [Publication](https://doi.org/10.1021/j100785a001).

Proper rigid fitting solves the least-squares rotation problem using Horn's quaternion eigenvector formulation: B. K. P. Horn, “Closed-form solution of absolute orientation using unit quaternions,” JOSA A 4(4), 629–642 (1987). [Publication](https://doi.org/10.1364/JOSAA.4.000629). The method allows rotation and translation, with determinant +1 and no reflection or scale.

Coordinate archive [usage policy](https://www.wwpdb.org/about/usage-policies). Synthetic comparison and load-test fixtures are explicitly identified as derived test data and are not experimental assemblies. Development dependencies and the independent validation tools are not part of the installed scientific engine.
