import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const ENFORCE = 'import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";';

function walkApi(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walkApi(p, acc);
    else if (name === "route.ts") acc.push(p);
  }
  return acc;
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

for (const f of walkApi(join(ROOT, "src/app/api"))) {
  let c = readFileSync(f, "utf8");
  if (!c.includes("enforceRevenueOsApiAccess")) continue;
  const lines = c.split("\n");
  const filtered = lines.filter((l) => l.trim() !== ENFORCE);
  const insertAt = endOfImportSection(filtered);
  const alreadyThere = filtered[insertAt]?.trim() === ENFORCE;
  if (alreadyThere) continue;
  filtered.splice(insertAt, 0, ENFORCE);
  const next = filtered.join("\n");
  if (next !== c) {
    writeFileSync(f, next, "utf8");
    console.log("normalized", f.slice(ROOT.length + 1));
  }
}
