# Release status — ProView 1.0.0

| Platform or action | Actual status |
| --- | --- |
| Windows 11 x64, current-user NSIS installation | Built and tested on Windows 11 Home 10.0.26200, x64 |
| Windows installer signing | Not signed; no signing credential was supplied or configured |
| macOS ARM64 | Target configuration only; no Mac was available, and no DMG/app ZIP was built or tested |
| Linux, Windows ARM64, Windows 10 | Not tested; not claimed as supported |
| Apple notarization | Not performed; no macOS build or credentials |
| Native CI | Windows GitHub runner: build, 40 unit tests and 38 packaged checks passed; [run](https://github.com/fishhrbio/ProView-1.0/actions/runs/43159721598) |
| Final interactive installer/uninstaller review | Interrupted by the user stopping Computer Use with Escape; not claimed passed |
| Publication approval | Robert Waite approved the 1.0 launch with the documented test scope and interrupted interactive review |

This release supports the tested Windows 11 x64 current-user workflow. The all-users installer option was not exercised. Testing used the current Windows account with isolated application profiles; a separate fresh Windows account or clean physical machine was not provisioned. Developer runtimes were removed from the installed application's PATH for the end-to-end test.

Robert Waite approved publication on November 11, 2026 (America/New_York), after reviewing the local delivery and readiness report. The interrupted final interactive review is retained as a verification limitation; it has not been relabeled as a pass. The README's public download URL matches the exact installer asset name and version tag. The versioned GitHub release supplies the installer, integrated source archive and SHA-256 checksums.

MIT licensing was selected by Robert Waite. Installed notices include the ProView license, 3Dmol.js and Zod notices, Electron/Chromium licenses, fixture provenance and the offline guide. Source and packaged resource bytes were compared. No institutional endorsement is implied.
