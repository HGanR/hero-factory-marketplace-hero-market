#!/usr/bin/env node
/**
 * Read-only scan for TS/TSX files under src/ that look like empty stubs (no exports, no runtime body).
 * Builds a single-pass import graph (@/ and relative) to list importers without spawning ripgrep per file.
 *
 * Usage: node scripts/typecheck-empty-modules-report.mjs [--write]
 * --write is reserved for future auto-fix; currently it only prints a notice (no file mutations).
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, normalize, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SRC = join(ROOT, "src");

const WRITE = process.argv.includes("--write");

function walkTs(dir, out = []) {
  let names;
  try {
    names = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const ent of names) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === "node_modules" || ent.name === ".next") continue;
      walkTs(p, out);
    } else if (ent.isFile() && /\.(ts|tsx)$/.test(ent.name) && !ent.name.endsWith(".d.ts")) {
      out.push(p);
    }
  }
  return out;
}

function stripCommentsRough(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/^\s*#.*$/gm, "");
}

function hasExportKeyword(src) {
  return /\bexport\b/.test(stripCommentsRough(src));
}

function bodyAfterImports(src) {
  const t = stripCommentsRough(src).trim();
  const lines = t.split(/\n+/);
  const kept = lines.filter((line) => {
    const s = line.trim();
    if (!s) return false;
    if (/^import\s/.test(s)) return false;
    return true;
  });
  return kept.join("\n").trim();
}

function isEmptyLikeModule(src) {
  if (!stripCommentsRough(src).trim()) return true;
  if (hasExportKeyword(src)) return false;
  return bodyAfterImports(src).length === 0;
}

function resolveImportTarget(importerAbs, spec) {
  if (!spec || spec.startsWith("node:")) return null;
  if (spec[0] !== "." && spec[0] !== "@") return null;

  let basePath;
  if (spec.startsWith("@/")) {
    basePath = join(ROOT, "src", spec.slice(2));
  } else {
    basePath = join(dirname(importerAbs), spec);
  }

  const ext = extname(basePath);
  if (ext === ".ts" || ext === ".tsx") {
    try {
      const st = statSync(basePath);
      if (st.isFile()) return normalize(basePath);
    } catch {
      return null;
    }
    return null;
  }

  const candidates = [`${basePath}.ts`, `${basePath}.tsx`, join(basePath, "index.ts"), join(basePath, "index.tsx")];
  for (const c of candidates) {
    try {
      if (existsSync(c) && statSync(c).isFile()) return normalize(c);
    } catch {
      /* ignore */
    }
  }
  return null;
}

function buildTargetToImporters(files) {
  /** @type {Map<string, Set<string>>} */
  const map = new Map();
  function add(target, importer) {
    if (!map.has(target)) map.set(target, new Set());
    map.get(target).add(importer);
  }
  for (const importerAbs of files) {
    let text;
    try {
      text = readFileSync(importerAbs, "utf8");
    } catch {
      continue;
    }
    for (const m of text.matchAll(/\bfrom\s+["']([^"']+)["']/g)) {
      const spec = m[1];
      const resolved = resolveImportTarget(importerAbs, spec);
      if (!resolved) continue;
      add(resolved, normalize(importerAbs));
    }
  }
  return map;
}

const namedFromRe =
  /import\s+(?:type\s+)?(?<clause>[\w*{}\s,]+?)\s+from\s+["'](?<spec>[^"']+)["']/g;

function suggestedExportsForFile(importerAbs, targetNorm) {
  const names = new Set();
  let text;
  try {
    text = readFileSync(importerAbs, "utf8");
  } catch {
    return [];
  }
  let m;
  namedFromRe.lastIndex = 0;
  while ((m = namedFromRe.exec(text)) !== null) {
    const spec = m.groups?.spec ?? "";
    const resolved = resolveImportTarget(importerAbs, spec);
    if (!resolved || resolved !== targetNorm) continue;
    const clause = (m.groups?.clause ?? "").trim();
    const brace = /\{([^}]+)\}/.exec(clause);
    if (brace) {
      for (const part of brace[1].split(",")) {
        const token = part.trim().split(/\s+as\s+/)[0]?.trim();
        if (token && token !== "type") names.add(token);
      }
    } else {
      const def = /^(\w+)$/.exec(clause.replace(/\s+/g, " "));
      if (def) names.add(def[1]);
    }
  }
  return [...names];
}

function main() {
  if (WRITE) {
    console.error("[typecheck-empty-modules-report] --write requested: no auto-fixes are performed in this version.");
  }

  const files = walkTs(SRC);
  const targetToImporters = buildTargetToImporters(files);

  const suspects = [];
  for (const abs of files) {
    let src;
    try {
      src = readFileSync(abs, "utf8");
    } catch {
      continue;
    }
    if (isEmptyLikeModule(src)) suspects.push(abs);
  }

  console.log(`Scanned ${files.length} files under src/.`);
  console.log(`Suspicious empty / export-less stubs: ${suspects.length}\n`);

  for (const abs of suspects) {
    const rel = relative(ROOT, abs).split(sep).join("/");
    const key = normalize(abs);
    const importerSet = targetToImporters.get(key);
    const importers = importerSet ? [...importerSet].sort() : [];

    const suggested = new Set();
    for (const imp of importers) {
      for (const n of suggestedExportsForFile(imp, key)) suggested.add(n);
    }

    console.log(`--- ${rel}`);
    if (!importers.length) {
      console.log("  importers: (none found — check path aliases or dynamic imports)");
    } else {
      console.log("  importers:");
      for (const p of importers) {
        console.log(`    - ${relative(ROOT, p).split(sep).join("/")}`);
      }
    }
    if (suggested.size) {
      console.log(`  suggested exports (from import clauses): ${[...suggested].sort().join(", ")}`);
    }
    console.log("");
  }
}

main();
