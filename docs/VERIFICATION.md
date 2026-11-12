# Release verification

Initial checks executed November 11, 2026, with release retests November 12, 2026, America/New_York. Host: Windows 11 Home 10.0.26200 x64; Intel i7-13700F, 24 logical CPUs, 31.72 GiB RAM; NVIDIA GeForce RTX 4060 Ti, ANGLE Direct3D 11 / WebGL 2.0. Source toolchain: Node 24.22.1 and pnpm 11.25.0. Bundled runtime: Electron 45.3.0.

| Check | Observed result / evidence |
| --- | --- |
| Starting source manifest | 142 files verified; `evidence/baseline-integrity.json` |
| Clean pinned dependency setup, typecheck, schemas and build | Passed; 23 schemas and 27 validated examples; `evidence/toolchain-verification.json` |
| Unit and failure/recovery tests | 40 passed, zero failed |
| Source desktop workflow | 38 checks passed; `evidence/source-release.json` |
| Installed desktop workflow | 38 checks passed; `evidence/installed-release.json` |
| Install, shortcuts, reinstall, uninstall, project retention | Exit codes 0; `evidence/installer-verification.json` |
| Numerical interface oracle | Exact independent atom-pair sets and counts; `evidence/numerical-verification.json` |
| Independent import / alignment | Gemmi 0.7.5 and NumPy 2.3.5 passed; `evidence/independent-verification.json` |
| Multi-model selection / save / reopen | Source models 7 and 42 verified; `evidence/model-verification.json` |
| Native close and cancel | Both paths passed after correcting an unsaved-change shutdown bug; `evidence/close-verification.json` |
| Shutdown during a running worker | Process exited; `evidence/lifecycle-verification.json` |
| Moved project after restart, original inputs unavailable | Passed offline with both source files temporarily renamed; `evidence/portability-verification.json` |
| Offline operation | Examples, imports, geometry, comparison, save/reopen and exports passed; zero background HTTP(S) requests observed |
| Explicit live RCSB retrieval | 1CRN mmCIF retrieved with 327 atoms and recorded URL/hash/time; `evidence/live-retrieval.json` |
| Automated accessibility | Zero axe WCAG 2.1 A/AA violations in main and comparison states; gradient cases checked separately |
| Manual contrast | Six checks passed, including gradient text and 3:1 control boundaries; `evidence/manual-contrast.json` |
| 150% / 200% native display scaling | 960×720, 1280×800 and 1600×1000 passed; accessible names and keyboard controls verified; `evidence/display-verification.json` |
| Packaged resources and notices | Source resource/icon bytes match, required modules and notices present; `evidence/packaging-audit.json` |
| GitHub Windows build and packaged workflow | Passed: 40 unit tests, 23 schemas/27 examples, installer build and 38 packaged checks; `evidence/github-actions-verification.json` and `evidence/cloud-packaged-release.json` |
| Production dependency audit | No reported vulnerabilities at audit time; not a guarantee against all runtime vulnerabilities |

The geometry reference reproduces a 2.497251489137609 Å minimum distance, 165 contacts, 36 residue-pair contacts and one overlap candidate over 598,752 A/D atom pairs from 1BRS. Independent alignment comparisons cover rigid, perturbed and reflected inputs; the maximum per-residue displacement difference from NumPy was below 3.3×10⁻¹³ Å. Gemmi matched all retained coordinates and author identities across five public/synthetic inputs, with zero coordinate difference. These checks validate the specified calculations, not biological interpretation or full format-dictionary compliance.

Desktop benchmarking used one warm-up and three measured five-second rotation paths per fixture, in a visible foreground window. The 1CRN, 1BRS and synthetic large scene rendered 327, 1,557 and 15,696 active protein atoms, respectively. The large scene consolidates synthetic grid copies into one display chain and is not an observed assembly. Measured median/p95 callback intervals were approximately 2.1/2.2 ms on this host. These are requestAnimationFrame-plus-render interaction timings, not guaranteed monitor presentation or GPU throughput. The largest sampled aggregate working-set peak was 728.2 MiB; 50 ms samples are a lower bound on instantaneous aggregate peaks, and OS per-process high-water marks are retained separately. Import times were about 102, 175 and 502 ms in this desktop run. Raw data: `evidence/desktop-performance.json`; engine runs: `evidence/engine-benchmark.json`.

The desktop suite controls file-dialog destinations and selected native message-box responses; earlier interactive wizard, picking and guide observations, and the interrupted final interactive rerun, are recorded separately in `evidence/native-ui-verification.json`. Native accessibility text exposes labels, source residue identity and live statuses. Narrator/NVDA speech output and a formal accessibility certification were not performed; the 3D shape has no screen-reader-equivalent spatial description. Numeric results, residue selection and correspondence remain available as text and keyboard controls.

A clean short checkout resolved NSIS's long-path template error. Invalid encodings, malformed and oversize inputs, BOM-preserving hashes, project corruption and unknown versions, failed writes, worker failure/timeout/cancel, unsafe resources/navigation and normal close/discard are covered. Failed attempts were corrected and their relevant checks repeated. The final distribution's manifest/ZIP and clean extraction results are recorded in the accompanying readiness report.

See `docs/RELEASE_STATUS.md` for untested platforms, unsigned status, account scope and the owner's launch approval with the documented interrupted-review limitation.


Two initial cloud runs exposed repeated molecular-scene rebuilding during a full correspondence paste. The editor now clears an invalidated fit immediately and rebuilds only when an existing fit must be removed, retaining the camera. The 108-pair paste emitted 215 input events and completed in approximately 42 ms on the cloud runner and 53 ms locally after this fix. A desktop regression check verifies fit invalidation and reviewed refitting. The cloud workflow, source workflow and exact rebuilt installer were retested successfully. The cloud pass targets application commit `b88a51274c4478f650f73c3d0f9c29e9c3b0e2df`; subsequent source changes only record evidence/documentation and strengthen the installer verification script.
