#!/usr/bin/env node
/**
 * Post-`next build` guard: fail if .next output looks like a 404-only / stub deploy.
 * Run from hero-market/ (package root).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const nextDir = path.join(root, ".next");

const routesManifestPath = path.join(nextDir, "routes-manifest.json");
const appPathRoutesPath = path.join(nextDir, "app-path-routes-manifest.json");
const serverAppPathsPath = path.join(nextDir, "server", "app-paths-manifest.json");

function mustExist(p, label) {
  if (!fs.existsSync(p)) {
    console.error(`[verify-next-routes] Missing ${label}: ${p}`);
    process.exit(1);
  }
}

mustExist(routesManifestPath, "routes-manifest.json");
mustExist(appPathRoutesPath, "app-path-routes-manifest.json");
mustExist(serverAppPathsPath, "server/app-paths-manifest.json");

const appPaths = JSON.parse(fs.readFileSync(appPathRoutesPath, "utf8"));
const routesManifest = JSON.parse(fs.readFileSync(routesManifestPath, "utf8"));

/** Manifest maps file path → URL path */
const urlPaths = new Set(Object.values(appPaths));
const keyCount = Object.keys(appPaths).length;

const required = ["/", "/dashboard", "/clients/new", "/site-builder"];
const missing = required.filter((r) => !urlPaths.has(r));

const line = "═".repeat(62);
console.log(`\n${line}`);
console.log("POST-BUILD ROUTE VERIFY");
console.log("CWD:", process.cwd());
console.log("PACKAGE ROOT:", root);
console.log("APP PATH MANIFEST ENTRIES:", keyCount);
console.log("UNIQUE URL PATHS (sample size):", urlPaths.size);
console.log(`${line}\n`);

if (missing.length) {
  console.error("[verify-next-routes] Required routes missing from app-path-routes-manifest values:", missing);
  process.exit(1);
}

/** Broken deploy: tiny manifest (only not-found + a handful of stubs) */
const MIN_ENTRIES = 80;
if (keyCount < MIN_ENTRIES) {
  console.error(
    `[verify-next-routes] Only ${keyCount} app-path entries (expected >= ${MIN_ENTRIES}).`,
    "This looks like a 404-only or wrong-directory build.",
  );
  process.exit(1);
}

/** Suspicious: almost nothing except not-found */
const onlyNotFound =
  keyCount < 15 && Object.keys(appPaths).every((k) => k.includes("not-found") || k.includes("_not-found"));
if (onlyNotFound) {
  console.error("[verify-next-routes] Manifest appears to contain only not-found routes.");
  process.exit(1);
}

const dynamicLen = Array.isArray(routesManifest.dynamicRoutes) ? routesManifest.dynamicRoutes.length : 0;
if (dynamicLen < 50) {
  console.error(
    `[verify-next-routes] routes-manifest dynamicRoutes length is ${dynamicLen} (expected many for this app).`,
    "Suspect incomplete Next build output.",
  );
  process.exit(1);
}

console.log("ROUTE COUNT:", keyCount);
console.log("routes-manifest dynamicRoutes count:", dynamicLen);
console.log("/clients/new in manifest:", urlPaths.has("/clients/new") ? "yes" : "no");
console.log("[verify-next-routes] OK — real hero-market app output.\n");
