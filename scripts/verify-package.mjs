import {readFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve(import.meta.dirname,'..');
const manifest=JSON.parse(await readFile(path.join(root,'MANIFEST.json'),'utf8'));
const seen=new Set();
for(const file of manifest.files){
  assert.equal(seen.has(file.path),false,'Duplicate manifest entry');seen.add(file.path);
  const target=path.resolve(root,file.path);
  assert.ok(target.startsWith(root+path.sep),'Manifest entry escapes package');
  const bytes=await readFile(target);
  assert.equal(bytes.length,file.bytes,`Byte length: ${file.path}`);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),file.sha256,`SHA-256: ${file.path}`);
  assert.equal((await stat(target)).isFile(),true);
}
assert.equal(seen.has('MANIFEST.json'),false,'Manifest must exclude itself');
console.log(JSON.stringify({status:'passed',verifiedFiles:seen.size,contractVersion:manifest.contractVersion},null,2));
