#!/usr/bin/env node
/**
 * Next.js forbids two sibling folders like `[id]` and `[agentId]` under the same parent.
 * Fail the build so production never ships a broken route tree again.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(__dirname, "../src/app");
const segment = /^\[[^\]]+\]$/;

function walk(absDir) {
  let entries;
  try {
    entries = fs.readdirSync(absDir, { withFileTypes: true });
  } catch {
    return;
  }
  const dynamicChildren = [];
  const dirs = [];
  for (const ent of entries) {
    if (!ent.isDirectory()) continue;
    if (segment.test(ent.name)) dynamicChildren.push(ent.name);
    dirs.push(path.join(absDir, ent.name));
  }
  if (dynamicChildren.length > 1) {
    console.error(
      "[check-app-dynamic-segment-conflicts] Multiple dynamic segment folders under the same parent:",
      "\n  dir:",
      absDir,
      "\n  segments:",
      dynamicChildren.join(", "),
    );
    process.exit(1);
  }
  for (const d of dirs) walk(d);
}

if (!fs.existsSync(APP)) {
  console.error("[check-app-dynamic-segment-conflicts] Missing", APP);
  process.exit(1);
}
walk(APP);
