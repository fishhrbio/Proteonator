import path from 'node:path';
process.env.PROVIEW_EXE??=path.resolve(import.meta.dirname,'../release/win-unpacked/ProView.exe');
process.env.PROVIEW_TEST_NAME??='packaged';
await import('./verify-release.mjs');
