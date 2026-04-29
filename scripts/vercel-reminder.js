#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const network = process.argv[2];
if (!network) {
  console.error("Usage: node scripts/vercel-reminder.js <amoy|polygon>");
  process.exit(1);
}

const file = path.join(process.cwd(), "deployments", `${network}.env.local`);
if (!fs.existsSync(file)) {
  console.error(`Missing ${file}. Deploy first: npm run deploy:${network}`);
  process.exit(1);
}

const envLines = fs.readFileSync(file, "utf8").trim();
const upper = network.toUpperCase();

console.log("");
console.log("============================================================");
console.log(`Vercel Env Var Reminder (${network})`);
console.log("============================================================");
console.log("");
console.log("1) Copy/paste these lines into:");
console.log("   Vercel Project -> Settings -> Environment Variables");
console.log("");
console.log(envLines);
console.log("");
console.log("2) After updating env vars, redeploy your app (Vercel):");
console.log("   vercel --prod --yes");
console.log("");
console.log("Important:");
console.log("- Vercel does NOT deploy contracts.");
console.log(`- Your app must be configured with NEXT_PUBLIC_${upper}_* values above.`);
console.log("");
console.log("============================================================");
console.log("");
