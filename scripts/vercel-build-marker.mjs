#!/usr/bin/env node
/**
 * Prints a loud banner at the start of `npm run build` so Vercel logs prove cwd + package.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

const line = "═".repeat(62);
console.log(`\n${line}`);
console.log("BUILDING HERO-MARKET APP FROM:", process.cwd());
console.log("PACKAGE ROOT (resolved):", root);
console.log("PACKAGE NAME:", pkg.name);
console.log(`${line}\n`);

if (pkg.name !== "hero-market") {
  console.error("[vercel-build-marker] Expected package.json name 'hero-market'.");
  process.exit(1);
}
