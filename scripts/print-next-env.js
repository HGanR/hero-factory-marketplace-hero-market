#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const network = process.argv[2];
if (!network) {
  console.error("Usage: node scripts/print-next-env.js <amoy|polygon>");
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
const factory = contracts.TrooNFTFactory?.address || contracts.TrooNFTFactory;
const factoryFeeWei = d?.configuration?.factoryDeployFeeWei || "";

if (!nft || !market) {
  console.error("Deployment JSON is missing expected keys. Expected TrooNFT and TrooMarketplace addresses.");
  console.error("JSON contents:", d);
  process.exit(1);
}

const rpc =
  network === "polygon"
    ? (process.env.POLYGON_RPC_URL || "https://polygon-rpc.com")
    : (process.env.AMOY_RPC_URL || "https://rpc-amoy.polygon.technology");

const upper = network.toUpperCase();
const lines = [
  `NEXT_PUBLIC_${upper}_NFT_CONTRACT=${nft}`,
  `NEXT_PUBLIC_${upper}_MARKETPLACE_CONTRACT=${market}`,
  `NEXT_PUBLIC_${upper}_RPC=${rpc}`,
];
if (factory) {
  lines.push(`NEXT_PUBLIC_${upper}_NFT_FACTORY=${factory}`);
}
if (factoryFeeWei !== "") {
  lines.push(`NEXT_PUBLIC_${upper}_NFT_FACTORY_DEPLOY_FEE_WEI=${factoryFeeWei}`);
}

console.log("");
console.log("Paste these into .env.local (local) and Vercel Environment Variables:");
console.log(lines.join("\n"));
console.log("");

const outPath = path.join(process.cwd(), "deployments", `${network}.env.local`);
try {
  fs.writeFileSync(outPath, lines.join("\n") + "\n", "utf8");
  console.log(`Wrote ${outPath}`);
} catch (err) {
  console.error("Failed to write env file:", err?.message || err);
}
