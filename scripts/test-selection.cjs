const fs = require('node:fs');
const path = require('node:path');
const manifest = require('../tests/runner-selection.json');
const root = path.resolve(__dirname, '..');
const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function validateSelection() {
  const groups = ['node', 'jestNode', 'jestBrowser', 'missingCoverage', 'unlistedNode'];
  const owner = new Map();
  for (const group of groups) for (const file of manifest[group]) {
    if (owner.has(file)) throw Error(`Runner overlap: ${file}`);
    owner.set(file, group);
    const text = fs.readFileSync(path.join(root, file), 'utf8');
    if (group === 'missingCoverage' ? text.trim() : !text.trim()) throw Error(`Coverage classification changed: ${file}`);
    if (group.startsWith('jest') && /['"]node:test['"]/.test(text)) throw Error(`Node suite selected by Jest: ${file}`);
  }
  if (require('../package.json').scripts.test !== manifest.nodeCommand) throw Error('Node command changed: review runner-selection.json');
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, {withFileTypes:true})) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (/\.spec\.tsx?$/.test(file)) {
        const relative = path.relative(root,file).split(path.sep).join('/');
        if (!owner.has(relative)) throw Error(`Unassigned suite: ${relative}`);
      }
    }
  }
  walk(path.join(root,'src'));
  return manifest;
}
function selectionRegex(group) {
  const m = validateSelection();
  if (!['jestNode','jestBrowser'].includes(group)) throw Error('Unknown Jest group');
  return `/(?:${m[group].map(escape).join('|')})$`;
}
module.exports = {validateSelection, selectionRegex};
if (require.main === module) console.log(Object.fromEntries(Object.entries(validateSelection()).filter(([,v]) => Array.isArray(v)).map(([k,v]) => [k,v.length])));
