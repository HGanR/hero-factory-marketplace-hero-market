#!/usr/bin/env node
/**
 * Fail fast if `npm run build` is executed from the wrong directory on Vercel/CI.
 * A mistaken Root Directory (or missing `cd hero-market`) produces a tiny build
 * (~1 static page, only Route (pages) /404) and every URL 404s.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function mustExist(rel) {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) {
    console.error(`[verify-vercel-root] Missing ${rel} — are you in hero-market? cwd context: ${root}`);
    process.exit(1);
  }
}

mustExist("package.json");
mustExist("src/app/page.tsx");
mustExist("src/app/layout.tsx");
mustExist("next.config.ts");

const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
if (pkg.name !== "hero-market") {
  console.error(
    `[verify-vercel-root] Expected package name "hero-market", got ${JSON.stringify(pkg.name)}.`,
  );
  process.exit(1);
}

const appDir = path.join(root, "src", "app");
const appEntries = fs.readdirSync(appDir, { withFileTypes: true });
if (appEntries.length < 30) {
  console.error(
    `[verify-vercel-root] src/app has only ${appEntries.length} entries — full app not present. Wrong Root Directory or incomplete checkout.`,
  );
  process.exit(1);
}

console.log("[verify-vercel-root] OK (hero-market app tree present)");
