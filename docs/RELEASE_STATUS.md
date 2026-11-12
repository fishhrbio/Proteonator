# Release status — ProView 1.0.0

| Platform or action | Actual status |
| --- | --- |
| Windows 11 x64, current-user NSIS installation | Built and tested on Windows 11 Home 10.0.26200, x64 |
| Windows installer signing | Not signed; no signing credential was supplied or configured |
| macOS ARM64 | Target configuration only; no Mac was available, and no DMG/app ZIP was built or tested |
| Linux, Windows ARM64, Windows 10 | Not tested; not claimed as supported |
| Apple notarization | Not performed; no macOS build or credentials |
| Native CI | Workflow prepared for manual dispatch; no repository CI run has been performed |
| Final interactive installer/uninstaller review | Interrupted by the user stopping Computer Use with Escape; not claimed passed |
| Public repository / installer upload | Not performed; final interactive review and owner approval remain |

This release supports the tested Windows 11 x64 current-user workflow. The all-users installer option was not exercised. Testing used the current Windows account with isolated application profiles; a separate fresh Windows account or clean physical machine was not provisioned. Developer runtimes were removed from the installed application's PATH for the end-to-end test.

The README's public download URL matches the exact installer asset name and version tag. It becomes live only when the owner approves publication of that release and asset. The local installer, source archive and checksums are provided together in the delivery package.

MIT licensing was selected by Robert Waite. Installed notices include the ProView license, 3Dmol.js and Zod notices, Electron/Chromium licenses, fixture provenance and the offline guide. Source and packaged resource bytes were compared. No institutional endorsement is implied.
