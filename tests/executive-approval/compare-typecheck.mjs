import { readFileSync } from "node:fs";

// Compare complete diagnostics with multiplicity; line shifts and checkout roots
// are irrelevant. Existing errors remain reported, never called a clean check.
const [headLog, baseLog, headRoot, baseRoot] = process.argv.slice(2);
function diagnostics(file, root) {
  const text = readFileSync(file, "utf8").replaceAll(root, "<repo>");
  if (/^error TS\d+:/m.test(text)) {
    throw Error("TypeScript reported a global error that requires inspection: " + file);
  }
  const blocks = [];
  let current;
  for (const line of text.split("\n")) {
    if (/^.+\(\d+,\d+\): error TS\d+:/.test(line)) {
      current = line.replace(/\(\d+,\d+\): error /, ": error ");
      blocks.push([current]);
    } else if (current && /^\s+\S/.test(line)) {
      blocks.at(-1).push(line);
    } else current = undefined;
  }
  if (!blocks.length && !/error TS\d+:/.test(text)) {
    // An OOM, missing tool or parser failure must not masquerade as no new errors.
    if (!text.includes("tsc --noEmit -p tsconfig.json") || /FATAL ERROR|Killed|not found|Cannot find module/.test(text)) {
      throw Error("TypeScript did not produce a comparable result: " + file);
    }
  }
  const counts = new Map();
  for (const block of blocks) {
    const key = block.join("\n");
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return { counts, total: blocks.length };
}
const head = diagnostics(headLog, headRoot), base = diagnostics(baseLog, baseRoot);
const added = [];
for (const [message, count] of head.counts) {
  for (let i = base.counts.get(message) ?? 0; i < count; i++) added.push(message);
}
console.log(JSON.stringify({ baselineDiagnostics: base.total, headDiagnostics: head.total, newDiagnostics: added.length }));
if (added.length) {
  console.error(added.join("\n\n"));
  process.exitCode = 1;
}
