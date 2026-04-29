#!/usr/bin/env node
const { execSync } = require("child_process");

const network = process.argv[2];
if (!network) {
  console.error("Usage: node scripts/vercel-redeploy.js <amoy|polygon>");
  process.exit(1);
}

const upper = network.toUpperCase();

try {
  execSync("vercel --version", { stdio: "ignore" });
} catch {
  console.error("Vercel CLI not found. Install it with: npm i -g vercel");
  process.exit(1);
}

console.log("");
console.log("============================================================");
console.log(`Vercel Redeploy (${network})`);
console.log("============================================================");
console.log("");
console.log("This will trigger: vercel --prod --yes");
console.log(`Make sure NEXT_PUBLIC_${upper}_* env vars are updated in Vercel first.`);
console.log("");

try {
  execSync("vercel whoami", { stdio: "ignore" });
} catch {
  console.error("Vercel CLI is not authenticated. Run: vercel login");
  process.exit(1);
}

try {
  execSync("vercel --prod --yes", { stdio: "inherit" });
} catch (err) {
  console.error("Redeploy failed:", err?.message || err);
  process.exit(1);
}

console.log("");
console.log("============================================================");
console.log("Vercel redeploy complete.");
console.log("============================================================");
console.log("");
