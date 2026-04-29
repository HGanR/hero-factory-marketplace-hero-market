#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const network = process.argv[2];
if (!network) {
  console.error("Usage: node scripts/verify-from-deployments.js <amoy|polygon>");
  process.exit(1);
}

const file = path.join(process.cwd(), "deployments", `${network}.json`);
if (!fs.existsSync(file)) {
  console.error(`Missing ${file}. Deploy first: npm run deploy:${network}`);
  process.exit(1);
}

const d = JSON.parse(fs.readFileSync(file, "utf8"));
const contracts = d.contracts || d;

const nft = contracts.TrooNFT?.address || contracts.TrooNFT;
const market = contracts.TrooMarketplace?.address || contracts.TrooMarketplace;
const nftArgs = contracts.TrooNFT?.args || [];
const marketArgs = contracts.TrooMarketplace?.args || [];

if (!nft || !market) {
  console.error("Missing TrooNFT or TrooMarketplace addresses in deployment JSON.");
  process.exit(1);
}

function verify(address, args) {
  const cmd = ["npx", "hardhat", "verify", "--network", network, address, ...args.map(String)];
  console.log("Running:", cmd.join(" "));
  execSync(cmd.join(" "), { stdio: "inherit" });
}

console.log("");
console.log(`Verifying on ${network}...`);
verify(nft, nftArgs);
verify(market, marketArgs);
console.log("Done.");
console.log("");
