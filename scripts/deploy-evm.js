const hre = require("hardhat");

/**
 * Deployment script for EVM chains (Ethereum, Polygon, Metallicus)
 * This script deploys TrooNFT and TrooMarketplace contracts
 */

async function main() {
  console.log("🚀 Starting EVM contract deployment...\n");

  // Get deployer account
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", balance.toString(), "\n");

  // Configuration
  const PLATFORM_WALLET = process.env.PLATFORM_WALLET || deployer.address;
  const TROO_TOKEN_ADDRESS = process.env.TROO_TOKEN_ADDRESS || "0x0000000000000000000000000000000000000000";
  const PLATFORM_FEE_BPS = Number(process.env.PLATFORM_FEE_BPS || "250");
  const FACTORY_DEPLOY_FEE_ETH = process.env.FACTORY_DEPLOY_FEE_ETH || "0";
  let factoryDeployFeeWei = 0n;
  try {
    factoryDeployFeeWei = hre.ethers.parseEther(FACTORY_DEPLOY_FEE_ETH);
  } catch {
    factoryDeployFeeWei = 0n;
  }
  
  console.log("Configuration:");
  console.log("- Platform Wallet:", PLATFORM_WALLET);
  console.log("- TROO Token Address:", TROO_TOKEN_ADDRESS);
  console.log("- Platform Fee Bps:", PLATFORM_FEE_BPS);
  console.log("- Factory Deploy Fee (ETH):", FACTORY_DEPLOY_FEE_ETH);
  console.log("");

  // Deploy TrooNFT
  console.log("📝 Deploying TrooNFT contract...");
  const TrooNFT = await hre.ethers.getContractFactory("contracts/TrooNFT.sol:TrooNFT");
  const trooNftArgs = ["Troo NFT", "TROONFT", PLATFORM_WALLET];
  const trooNFT = await TrooNFT.deploy(
    ...trooNftArgs
  );
  await trooNFT.waitForDeployment();
  const trooNftAddress = await trooNFT.getAddress();
  console.log("✅ TrooNFT deployed to:", trooNftAddress);
  console.log("");

  // Deploy TrooMarketplace
  console.log("📝 Deploying TrooMarketplace contract...");
  const TrooMarketplace = await hre.ethers.getContractFactory("TrooMarketplace");
  const trooMarketArgs = [PLATFORM_WALLET, TROO_TOKEN_ADDRESS];
  const trooMarketplace = await TrooMarketplace.deploy(
    ...trooMarketArgs
  );
  await trooMarketplace.waitForDeployment();
  const trooMarketplaceAddress = await trooMarketplace.getAddress();
  console.log("✅ TrooMarketplace deployed to:", trooMarketplaceAddress);
  console.log("");

  // Deploy TrooNFTFactory (for creator-deployed collections)
  console.log("📝 Deploying TrooNFTFactory contract...");
  const TrooNFTFactory = await hre.ethers.getContractFactory("TrooNFTFactory");
  const trooFactoryArgs = [PLATFORM_WALLET, PLATFORM_FEE_BPS, factoryDeployFeeWei];
  const trooFactory = await TrooNFTFactory.deploy(...trooFactoryArgs);
  await trooFactory.waitForDeployment();
  const trooFactoryAddress = await trooFactory.getAddress();
  console.log("✅ TrooNFTFactory deployed to:", trooFactoryAddress);
  console.log("");

  // Verify deployment
  console.log("🔍 Verifying deployment...");
  const platformWallet = await trooMarketplace.platformWallet();
  const platformFee = await trooMarketplace.platformFee();
  const discountedFee = await trooMarketplace.discountedFee();
  const mintingFee = await trooNFT.mintingFee();

  console.log("Marketplace Configuration:");
  console.log("- Platform Wallet:", platformWallet);
  const platformFeeNum = Number(platformFee);
  const discountedFeeNum = Number(discountedFee);
  console.log("- Platform Fee:", platformFee.toString(), "basis points (", platformFeeNum / 100, "%)");
  console.log("- Discounted Fee:", discountedFee.toString(), "basis points (", discountedFeeNum / 100, "%)");
  console.log("- Minting Fee:", hre.ethers.formatEther(mintingFee), "ETH");
  console.log("");

  const serializeArgs = (args) => args.map((arg) => (typeof arg === "bigint" ? arg.toString() : arg));

  // Save deployment info
  const deploymentInfo = {
    network: hre.network.name,
    chainId: hre.network.config?.chainId ?? null,
    deployer: deployer.address,
    contracts: {
      TrooNFT: { address: trooNftAddress, args: serializeArgs(trooNftArgs) },
      TrooMarketplace: { address: trooMarketplaceAddress, args: serializeArgs(trooMarketArgs) },
      TrooNFTFactory: { address: trooFactoryAddress, args: serializeArgs(trooFactoryArgs) },
    },
    configuration: {
      platformWallet: PLATFORM_WALLET,
      trooTokenAddress: TROO_TOKEN_ADDRESS,
      platformFeeBps: PLATFORM_FEE_BPS.toString(),
      factoryDeployFeeWei: factoryDeployFeeWei.toString(),
      platformFee: platformFee.toString(),
      discountedFee: discountedFee.toString(),
      mintingFee: mintingFee.toString(),
    },
    timestamp: new Date().toISOString(),
  };

  const fs = require("fs");
  const path = require("path");
  const deploymentsDir = "./deployments";
  const deploymentPath = `${deploymentsDir}/${hre.network.name}.json`;
  fs.mkdirSync(deploymentsDir, { recursive: true });
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  console.log("💾 Deployment info saved to:", deploymentPath);
  console.log("");

  const upper = hre.network.name.toUpperCase();
  const envLines = [
    `NEXT_PUBLIC_${upper}_NFT_CONTRACT=${trooNftAddress}`,
    `NEXT_PUBLIC_${upper}_MARKETPLACE_CONTRACT=${trooMarketplaceAddress}`,
    `NEXT_PUBLIC_${upper}_NFT_FACTORY=${trooFactoryAddress}`,
    `NEXT_PUBLIC_${upper}_NFT_FACTORY_DEPLOY_FEE_WEI=${factoryDeployFeeWei.toString()}`,
  ];
  if (hre.network.name === "polygon") {
    envLines.push(`NEXT_PUBLIC_POLYGON_RPC=${process.env.POLYGON_RPC_URL || "https://polygon-rpc.com"}`);
  } else if (hre.network.name === "amoy") {
    envLines.push(`NEXT_PUBLIC_AMOY_RPC=${process.env.AMOY_RPC_URL || "https://rpc-amoy.polygon.technology"}`);
  }
  const envPath = path.join(process.cwd(), deploymentsDir, `${hre.network.name}.env.local`);
  fs.writeFileSync(envPath, envLines.join("\n") + "\n");
  console.log("💾 Next.js env file saved to:", envPath);
  console.log("Paste these into .env.local (local) and Vercel Environment Variables:");
  console.log(envLines.join("\n"));
  console.log("");

  // Verification instructions
  console.log("📋 Next steps:");
  console.log("1. Verify contracts on block explorer:");
  console.log(`   npx hardhat verify --network ${hre.network.name} ${trooNftAddress} "Troo NFT" "TROONFT" ${PLATFORM_WALLET}`);
  console.log(`   npx hardhat verify --network ${hre.network.name} ${trooMarketplaceAddress} ${PLATFORM_WALLET} ${TROO_TOKEN_ADDRESS}`);
  console.log("2. Update your Next.js env (.env.local) with the contract addresses (printed above).");
  console.log("");
  console.log("3. Test the contracts:");
  console.log(`   npx hardhat run scripts/test-contracts.js --network ${hre.network.name}`);
  console.log("");
  console.log("✅ Deployment complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
