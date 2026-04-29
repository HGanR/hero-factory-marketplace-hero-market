#!/usr/bin/env node
/**
 * Verify scenery GLB assets exist.
 * Fails build/CI if expected files are missing.
 * Run: node scripts/verify-scenery.mjs
 */
import { existsSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const root = join(__dirname, "..");
const sceneryDir = join(root, "public", "models", "scenery");

const REQUIRED = [
  "tree_birch.glb",
  "tree_maple.glb",
  "tree_oak.glb",
  "tree_pine.glb",
  "tree_willow.glb",
];

const missing = REQUIRED.filter((f) => !existsSync(join(sceneryDir, f)));

if (missing.length > 0) {
  console.error("Missing scenery GLB files:", missing.join(", "));
  console.error("Run: npm run seed:scenery");
  process.exit(1);
}

console.log("✓ All scenery assets present");
