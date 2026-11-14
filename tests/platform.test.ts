import {test} from 'node:test';import assert from 'node:assert/strict';
import {computeExecutableName,projectPathFromArgument} from '../src/desktop/platform';
test('Native scientific executable names match each target platform',()=>{assert.equal(computeExecutableName('win32'),'ProteonatorCompute.exe');for(const p of ['darwin','linux'] as const)assert.equal(computeExecutableName(p),'ProteonatorCompute');});
test('Native document paths retain Unicode and decode desktop file URIs',()=>{
 assert.equal(projectPathFromArgument('file:///tmp/project%20%C3%A9.proteonator','linux'),'/tmp/project é.proteonator');
 assert.equal(projectPathFromArgument('file:///Users/test/Project%20%C3%A9.proteonator','darwin'),'/Users/test/Project é.proteonator');
 assert.equal(projectPathFromArgument('file:///C:/Test/Project%20%C3%A9.proteonator','win32'),'C:\\Test\\Project é.proteonator');
 assert.equal(projectPathFromArgument('/tmp/legacy.proview','linux'),'/tmp/legacy.proview');
 for(const p of ['--user-data-dir=test.proteonator','file://remote/tmp/a.proteonator','/tmp/a.txt'])assert.equal(projectPathFromArgument(p,'linux'),null);
});
