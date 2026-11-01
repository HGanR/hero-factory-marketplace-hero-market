const {test} = require('node:test');
const assert = require('node:assert/strict');
const {validateSelection, selectionRegex} = require('../scripts/test-selection.cjs');
test('Jest selections are exact and exclude Node and empty suites', () => {
 const m = validateSelection();
 const a = new RegExp(selectionRegex('jestNode')), b = new RegExp(selectionRegex('jestBrowser'));
 for (const f of [...m.node,...m.unlistedNode,...m.missingCoverage]) { assert.equal(a.test('/'+f),false,f); assert.equal(b.test('/'+f),false,f); }
 for (const f of m.jestNode) { assert.ok(a.test('/'+f),f); assert.equal(b.test('/'+f),false,f); }
 for (const f of m.jestBrowser) { assert.ok(b.test('/'+f),f); assert.equal(a.test('/'+f),false,f); }
});
test('original Node command and missing coverage remain explicit', () => {
 const m=validateSelection(); assert.equal(m.node.length,96); assert.equal(m.missingCoverage.length,26);
 assert.deepEqual(m.nodeCommand.split(/\s+/).slice(4),m.node);
});
