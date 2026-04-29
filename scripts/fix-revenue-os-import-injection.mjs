import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const bad = /import \{\s*\nimport \{ enforceRevenueOsApiAccess \} from "@\/lib\/revenue-os-api-access";\s*\n/g;

function walkApi(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walkApi(p, acc);
    else if (name === "route.ts") acc.push(p);
  }
  return acc;
}

const MARK = "import {\nimport { enforceRevenueOsApiAccess";
const files = walkApi(join(ROOT, "src/app/api")).filter((f) => readFileSync(f, "utf8").includes(MARK));

for (const f of files) {
  let c = readFileSync(f, "utf8");
  const before = c;
  c = c.replace(bad, "import {\n");
  if (c === before) continue;
  if (!c.includes('from "@/lib/revenue-os-api-access"')) {
    const lines = c.split("\n");
    const exportIdx = lines.findIndex((l) => /^export\s/.test(l));
    const ins = 'import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";';
    if (exportIdx >= 0) lines.splice(exportIdx, 0, ins);
    else lines.unshift(ins);
    c = lines.join("\n");
  }
  writeFileSync(f, c, "utf8");
  console.log("fixed", f.slice(ROOT.length + 1));
}
