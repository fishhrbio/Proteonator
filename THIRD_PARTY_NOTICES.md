# Third-party notices

Original Proteonator code and the emerald fedora icon are copyright © 2026 Robert Waite and distributed under the MIT license in `LICENSE`. Dependency, font and data licenses remain separate. No institutional endorsement is implied.

| Component | Purpose | Terms and included notice |
| --- | --- | --- |
| Mol* 5.13.0 | Molecular visualization, connectivity, representations, maps and measurement display | MIT; `licenses/Molstar-MIT.txt` |
| Gemmi 0.7.5 | Coordinate parsing, assemblies, chemical data and mmCIF writing | MPL-2.0; `licenses/Gemmi-MPL-2.0.txt`; unmodified upstream source below |
| OpenMM 8.6.0 | CPU preparation and local minimization | API/CPU/Reference: MIT; additional component terms in `licenses/OpenMM-Licenses.txt`; complete LGPL/GPL texts also included |
| CHARMM force-field XML distributed with OpenMM | Molecular parameters | Source/version and scientific references embedded in the XML; distributed with the OpenMM runtime |
| NumPy 2.3.5 and bundled numerical libraries | Numerical geometry and linear algebra | BSD and bundled dependency terms; `licenses/NumPy-and-bundled-libraries.txt` |
| Biopython 1.86 | GenBank/CDS parsing and reviewed sequence alignment | Biopython license; full license in `licenses/python-additions/biopython-1.86.dist-info` |
| ViennaRNA 2.7.2 | Local RNA secondary structure and base-pair probabilities | ViennaRNA permission terms require attribution and prohibit redistribution for a fee beyond media costs; see full COPYING/AUTHORS under `licenses/python-additions/viennarna-2.7.2.dist-info` and the separate NAVIEW notice |
| Matplotlib 3.10.8 and plotting dependencies | Scientific profile and displacement figures | Full Matplotlib, font, Pillow, contourpy, cycler, fonttools, kiwisolver, packaging, pyparsing, dateutil and tzdata notices retained in `licenses/python-additions`; exact distribution inventory included |
| Microsoft Visual C++ app-local x64 runtime 14.52.37029 | C++ support for the scientific libraries | Microsoft Software License Terms and the included Redist list; full runtime inventory in `compute/runtime-libraries.json` and notices under `licenses/Microsoft-Visual-Cpp-*` |
| CPython 3.12.14 | Standalone molecular runtime | PSF and included component licenses; `licenses/Python-PSF.txt` |
| PyInstaller 6.17.0 bootloader | Standalone executable | GPL with application-distribution exception; `licenses/PyInstaller-license-and-exception.txt` |
| charset-normalizer 3.5.2 | Runtime text support | MIT; `licenses/charset-normalizer-MIT.txt` |
| Electron 45.3.0 | Desktop runtime | MIT; `licenses/electron-LICENSE.txt`; installed `LICENSE.electron.txt` |
| Chromium, Node.js and Electron runtime components | Embedded desktop services | Installed `LICENSES.chromium.html` and runtime notice files |
| 3Dmol.js 2.5.5 | Compatibility source dependency | BSD-3-Clause; `licenses/3dmol-LICENSE.txt` |
| Zod 4.6.7 | Project/input validation | MIT; `licenses/zod-LICENSE.txt` |
| JavaScript transitive dependencies | Library components | Full notices in `licenses/JavaScript-dependencies.txt`, version inventory in the companion JSON |
| Silkscreen, Jason Kottke | Painted Pixels typeface | SIL Open Font License 1.1; `licenses/Silkscreen-OFL.txt`; unmodified font |
| wwPDB Chemical Component Dictionary and PDB archive | Chemistry definitions and example structures | CC0-1.0; archive links and provenance below |

OpenMM reports its internal revision as `8.6.0.dev-c6173db`; the installed distribution version is 8.6.0. Only CPU/Reference execution is used. OpenCL/CUDA plugins are not supplied as a supported calculation path. PdbxReader by John Westbrook is redistributed within OpenMM under CC BY 3.0; see [license](https://creativecommons.org/licenses/by/3.0/) and the full OpenMM notices. Hilbert Curve implementation copyright 1998, Rice University.

Gemmi: © 2017–2025 Global Phasing Ltd and contributors. The executable library is unmodified. Its corresponding source is freely available from the [v0.7.5 source archive](https://github.com/project-gemmi/gemmi/archive/refs/tags/v0.7.5.tar.gz) and [upstream repository](https://github.com/project-gemmi/gemmi/tree/v0.7.5), under MPL-2.0. Proteonator's separate code remains MIT. Other exact-version source links are listed in `licenses/DEPENDENCY_SOURCES.md`.

Mol*: Sehnal et al., [Nucleic Acids Research (2021)](https://doi.org/10.1093/nar/gkab314). OpenMM and CHARMM parameter references are described in the [scientific methods](docs/SCIENCE.md) and parameter XML. The 3Dmol compatibility dependency is by Nicholas Rego and David Koes, [Bioinformatics (2015)](https://doi.org/10.1093/bioinformatics/btu829).

## Coordinate and chemistry data

Public archive examples are credited to their depositors and primary publications through their entry records: [1BRS](https://www.rcsb.org/structure/1BRS), [1CRN](https://www.rcsb.org/structure/1CRN), [1UBQ](https://www.rcsb.org/structure/1UBQ), [4HHB](https://www.rcsb.org/structure/4HHB), [1BNA](https://www.rcsb.org/structure/1BNA) and [1HZH](https://www.rcsb.org/structure/1HZH). Exact coordinate bytes and chemistry-component hashes are recorded in `fixtures/PROVENANCE.json` and `data/PROVENANCE.json`. Synthetic fixtures are explicitly identified as artificial and are not deposited biological assemblies or observations of PTM-induced folding.

The [wwPDB usage policy](https://www.wwpdb.org/about/usage-policies) places PDB archive data and the [Chemical Component Dictionary](https://www.wwpdb.org/data/ccd) under CC0. Cite original structures and scientific methods when reporting analyses.

## Optional reference services

Biological annotations come from [UniProt](https://www.uniprot.org/help/license), [PDBe SIFTS](https://www.ebi.ac.uk/pdbe/docs/sifts/quick.html) and [Ensembl](https://www.ensembl.org/info/about/legal/disclaimer.html). UniProt copyrightable database content uses CC BY 4.0. PDBe's [public-data statement](https://www.ebi.ac.uk/pdbe/about/public-data-access-statement) describes CC0 archive/derived data and service terms. Cached records retain source and retrieval time; these services and contributors do not endorse Proteonator. Local coordinate files are not uploaded for context retrieval.

## RNA calculations and sequence references

ViennaRNA is credited to Ronny Lorenz, Ivo L. Hofacker, the ViennaRNA contributors, and the Institute for Theoretical Chemistry, University of Vienna. Its bundled permission terms differ from Proteonator's MIT license. NAVIEW, included in the upstream library, is copyright Robert E. Bruccoleri; copying is by his permission under its included terms. Proteonator uses its own circular schematic for RNA display. This distribution is provided without a redistribution fee. Consult the full upstream terms before commercial redistribution; the original Proteonator code remains MIT.

Biopython: Cock et al., [Bioinformatics (2009)](https://doi.org/10.1093/bioinformatics/btp163). ViennaRNA: Lorenz et al., [Algorithms for Molecular Biology (2011)](https://doi.org/10.1186/1748-7188-6-26). Matplotlib: Hunter, [Computing in Science & Engineering (2007)](https://doi.org/10.1109/MCSE.2007.55). Genetic-code tables use the versioned Biopython definitions derived from the [NCBI genetic codes](https://www.ncbi.nlm.nih.gov/Taxonomy/Utils/wprintgc.cgi); source/version are included with the table data. Imported Infernal and tRNAscan-SE results retain their supplied method, database and threshold provenance; those programs and databases are not bundled.
