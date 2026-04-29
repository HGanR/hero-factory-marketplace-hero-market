#!/usr/bin/env node
/**
 * Injects `enforceRevenueOsApiAccess` at the start of each exported GET/POST/PUT/PATCH/DELETE
 * handler in selected API route files. Idempotent (skips if already present).
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const TARGET_DIRS = [
  join(ROOT, "src/app/api/revenue-os"),
  join(ROOT, "src/app/api/campaigns"),
  join(ROOT, "src/app/api/bentley-social-leads"),
  join(ROOT, "src/app/api/social"),
];

const TARGET_FILES = [
  join(ROOT, "src/app/api/trends/generate/route.ts"),
  join(ROOT, "src/app/api/clients/me/route.ts"),
];

function walk(dir, acc = []) {
  if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) return acc;
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next") continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, acc);
    else if (name === "route.ts") acc.push(p);
  }
  return acc;
}

function extractFirstParamName(paramsStr) {
  const trimmed = paramsStr.trim();
  if (!trimmed) return null;
  let depth = 0;
  let segEnd = trimmed.length;
  for (let i = 0; i < trimmed.length; i++) {
    const c = trimmed[i];
    if (c === "(") depth++;
    else if (c === ")") depth--;
    else if (c === "," && depth === 0) {
      segEnd = i;
      break;
    }
  }
  const segment = trimmed.slice(0, segEnd).trim();
  const m = segment.match(/^([a-zA-Z0-9_]+)\s*:/);
  return m ? m[1] : null;
}

function findHandlerBlocks(content) {
  const blocks = [];
  const re = /\bexport\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)\s*\(/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    const paramOpen = content.indexOf("(", m.index);
    let depth = 0;
    let j = paramOpen;
    for (; j < content.length; j++) {
      const c = content[j];
      if (c === "(") depth++;
      else if (c === ")") {
        depth--;
        if (depth === 0) {
          j++;
          break;
        }
      }
    }
    const paramsStr = content.slice(paramOpen + 1, j - 1);
    let k = j;
    while (k < content.length && /\s/.test(content[k])) k++;
    if (content[k] !== "{") continue;
    const bodyOpen = k;
    blocks.push({
      bodyOpen,
      firstParam: extractFirstParamName(paramsStr),
    });
  }
  return blocks;
}

function endOfImportSection(lines) {
  let i = 0;
  while (i < lines.length) {
    const t = lines[i].trim();
    if (t === "" || t.startsWith("//")) {
      i++;
      continue;
    }
    if (!t.startsWith("import ")) break;
    while (i < lines.length && !lines[i].trim().endsWith(";")) i++;
    i++;
  }
  return i;
}

function ensureImport(content) {
  if (content.includes('from "@/lib/revenue-os-api-access"')) return content;
  const lines = content.split("\n");
  const ins = 'import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";';
  const at = endOfImportSection(lines);
  lines.splice(at, 0, ins);
  return lines.join("\n");
}

function processFile(filePath) {
  let content = readFileSync(filePath, "utf8");
  if (content.includes("enforceRevenueOsApiAccess")) return false;

  let blocks = findHandlerBlocks(content);
  if (blocks.length === 0) return false;

  content = ensureImport(content);
  blocks = findHandlerBlocks(content);
  if (blocks.length === 0) return false;

  blocks.sort((a, b) => b.bodyOpen - a.bodyOpen);
  for (const { bodyOpen, firstParam } of blocks) {
    const guard =
      firstParam != null
        ? `\n  const __rosGate = await enforceRevenueOsApiAccess(${firstParam});\n  if (__rosGate) return __rosGate;`
        : `\n  const __rosGate = await enforceRevenueOsApiAccess();\n  if (__rosGate) return __rosGate;`;
    content = content.slice(0, bodyOpen + 1) + guard + content.slice(bodyOpen + 1);
  }

  writeFileSync(filePath, content, "utf8");
  return true;
}

const files = new Set();
for (const d of TARGET_DIRS) {
  for (const f of walk(d)) files.add(f);
}
for (const f of TARGET_FILES) {
  if (statSync(f, { throwIfNoEntry: false })) files.add(f);
}

let n = 0;
for (const f of [...files].sort()) {
  if (processFile(f)) {
    console.log("patched", f.slice(ROOT.length + 1));
    n++;
  }
}
console.log(`Done. Patched ${n} files.`);
