import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Deployment Script for TrustVerification Smart Contract
 * 
 * This script deploys the TrustVerification contract to Hyperledger Besu
 * and performs all necessary setup and verification steps.
 * 
 * Usage:
 * npx hardhat run scripts/deploy-trustverification.ts --network besu
 */

interface DeploymentInfo {
  contractAddress: string;
  deployerAddress: string;
  deploymentBlock: number;
  deploymentTimestamp: string;
  networkName: string;
  chainId: number;
  transactionHash: string;
  gasUsed: string;
  gasPrice: string;
  totalCost: string;
}

/**
 * Format large numbers with commas
 */
function formatNumber(num: bigint | number): string {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * Format address with checksum
 */
function formatAddress(address: string): string {
  return ethers.getAddress(address);
}

/**
 * Convert Wei to ETH
 */
function weiToEth(wei: bigint): string {
  return ethers.formatEther(wei);
}

/**
 * Main deployment function
 */
async function main() {
  console.log("\n" + "=".repeat(80));
  console.log("TrustVerification Contract Deployment");
  console.log("=".repeat(80) + "\n");

  try {
    // ========================================================================
    // Step 1: Get Network Information
    // ========================================================================
    console.log("📡 Step 1: Getting network information...");

    const provider = ethers.provider;
    const network = await provider.getNetwork();
    const chainId = Number(network.chainId);
    const networkName = network.name;

    console.log(`   Network: ${networkName}`);
    console.log(`   Chain ID: ${chainId}`);

    // ========================================================================
    // Step 2: Get Deployer Account
    // ========================================================================
    console.log("\n👤 Step 2: Getting deployer account...");

    const [deployer] = await ethers.getSigners();
    const deployerAddress = formatAddress(deployer.address);
    const balance = await provider.getBalance(deployer.address);

    console.log(`   Deployer: ${deployerAddress}`);
    console.log(`   Balance: ${weiToEth(balance)} ETH`);

    // Verify sufficient balance
    if (balance < ethers.parseEther("0.1")) {
      throw new Error(
        `Insufficient balance. Need at least 0.1 ETH, have ${weiToEth(balance)} ETH`
      );
    }

    // ========================================================================
    // Step 3: Get Current Block Information
    // ========================================================================
    console.log("\n📦 Step 3: Getting current block information...");

    const currentBlock = await provider.getBlockNumber();
    const blockDetails = await provider.getBlock(currentBlock);
    const gasPrice = await provider.getGasPrice();

    console.log(`   Current Block: ${currentBlock}`);
    console.log(`   Block Timestamp: ${blockDetails?.timestamp}`);
    console.log(`   Gas Price: ${formatNumber(gasPrice)} wei (${weiToEth(gasPrice)} ETH/gas)`);

    // ========================================================================
    // Step 4: Compile Contract
    // ========================================================================
    console.log("\n🔨 Step 4: Compiling TrustVerification contract...");

    const TrustVerification = await ethers.getContractFactory("TrustVerification");
    console.log("   ✓ Contract compiled successfully");

    // ========================================================================
    // Step 5: Estimate Gas
    // ========================================================================
    console.log("\n⛽ Step 5: Estimating deployment gas...");

    const deploymentData = TrustVerification.bytecode;
    const estimatedGas = await provider.estimateGas({
      data: deploymentData,
      from: deployer.address,
    });

    const estimatedCost = estimatedGas * gasPrice;

    console.log(`   Estimated Gas: ${formatNumber(estimatedGas)}`);
    console.log(`   Estimated Cost: ${weiToEth(estimatedCost)} ETH`);

    // ========================================================================
    // Step 6: Deploy Contract
    // ========================================================================
    console.log("\n🚀 Step 6: Deploying TrustVerification contract...");

    const contract = await TrustVerification.deploy();
    await contract.waitForDeployment();

    const contractAddress = formatAddress(await contract.getAddress());
    const deploymentReceipt = await provider.getTransactionReceipt(
      contract.deploymentTransaction()!.hash
    );

    console.log(`   ✓ Contract deployed successfully`);
    console.log(`   Contract Address: ${contractAddress}`);

    if (deploymentReceipt) {
      console.log(`   Transaction Hash: ${deploymentReceipt.hash}`);
      console.log(`   Block Number: ${deploymentReceipt.blockNumber}`);
      console.log(`   Gas Used: ${formatNumber(deploymentReceipt.gasUsed)}`);
      console.log(`   Actual Cost: ${weiToEth(deploymentReceipt.gasUsed * gasPrice)} ETH`);
    }

    // ========================================================================
    // Step 7: Verify Contract Deployment
    // ========================================================================
    console.log("\n✅ Step 7: Verifying contract deployment...");

    const code = await provider.getCode(contractAddress);
    if (code === "0x") {
      throw new Error("Contract deployment failed - no code at address");
    }

    console.log(`   ✓ Contract code verified (${code.length / 2} bytes)`);

    // ========================================================================
    // Step 8: Test Contract Functions
    // ========================================================================
    console.log("\n🧪 Step 8: Testing contract functions...");

    // Test 1: Get owner
    const owner = await contract.getOwner();
    console.log(`   ✓ getOwner(): ${formatAddress(owner)}`);

    // Test 2: Get instrument count
    const instrumentCount = await contract.getInstrumentCount();
    console.log(`   ✓ getInstrumentCount(): ${instrumentCount}`);

    // Test 3: Get authorized issuer count
    const issuerCount = await contract.getAuthorizedIssuerCount();
    console.log(`   ✓ getAuthorizedIssuerCount(): ${issuerCount}`);

    // ========================================================================
    // Step 9: Prepare Deployment Information
    // ========================================================================
    console.log("\n📝 Step 9: Preparing deployment information...");

    const deploymentInfo: DeploymentInfo = {
      contractAddress,
      deployerAddress,
      deploymentBlock: deploymentReceipt?.blockNumber || currentBlock,
      deploymentTimestamp: new Date().toISOString(),
      networkName,
      chainId,
      transactionHash: deploymentReceipt?.hash || "",
      gasUsed: deploymentReceipt?.gasUsed.toString() || "0",
      gasPrice: gasPrice.toString(),
      totalCost: (deploymentReceipt?.gasUsed || estimatedGas * gasPrice).toString(),
    };

    console.log("   ✓ Deployment information prepared");

    // ========================================================================
    // Step 10: Save Deployment Information
    // ========================================================================
    console.log("\n💾 Step 10: Saving deployment information...");

    const deploymentsDir = path.join(process.cwd(), "deployments");
    if (!fs.existsSync(deploymentsDir)) {
      fs.mkdirSync(deploymentsDir, { recursive: true });
    }

    const deploymentFile = path.join(
      deploymentsDir,
      `trustverification-${networkName}-${Date.now()}.json`
    );
    fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));

    // Also save to latest file
    const latestFile = path.join(deploymentsDir, "trustverification-latest.json");
    fs.writeFileSync(latestFile, JSON.stringify(deploymentInfo, null, 2));

    console.log(`   ✓ Deployment info saved to: ${deploymentFile}`);
    console.log(`   ✓ Latest deployment saved to: ${latestFile}`);

    // ========================================================================
    // Step 11: Save Environment Variables
    // ========================================================================
    console.log("\n🔐 Step 11: Generating environment variables...");

    const envContent = `
# TrustVerification Contract Deployment
TRUST_CONTRACT_ADDRESS=${contractAddress}
TRUST_CONTRACT_DEPLOYER=${deployerAddress}
TRUST_CONTRACT_DEPLOYMENT_BLOCK=${deploymentInfo.deploymentBlock}
TRUST_CONTRACT_NETWORK=${networkName}
TRUST_CONTRACT_CHAIN_ID=${chainId}
TRUST_CONTRACT_DEPLOYMENT_TX=${deploymentReceipt?.hash}
`;

    const envFile = path.join(process.cwd(), ".env.trustverification");
    fs.writeFileSync(envFile, envContent.trim());

    console.log(`   ✓ Environment variables saved to: ${envFile}`);
    console.log("\n   Add these to your .env.local file:");
    console.log(`   TRUST_CONTRACT_ADDRESS=${contractAddress}`);
    console.log(`   TRUST_CONTRACT_NETWORK=${networkName}`);

    // ========================================================================
    // Step 12: Display Summary
    // ========================================================================
    console.log("\n" + "=".repeat(80));
    console.log("✅ DEPLOYMENT SUCCESSFUL");
    console.log("=".repeat(80));

    console.log("\n📊 Deployment Summary:");
    console.log(`   Contract Address:    ${contractAddress}`);
    console.log(`   Deployer Address:    ${deployerAddress}`);
    console.log(`   Network:             ${networkName}`);
    console.log(`   Chain ID:            ${chainId}`);
    console.log(`   Deployment Block:    ${deploymentInfo.deploymentBlock}`);
    console.log(`   Transaction Hash:    ${deploymentReceipt?.hash}`);
    console.log(`   Gas Used:            ${formatNumber(deploymentReceipt?.gasUsed || 0)}`);
    console.log(`   Total Cost:          ${weiToEth(BigInt(deploymentInfo.totalCost))} ETH`);
    console.log(`   Timestamp:           ${deploymentInfo.deploymentTimestamp}`);

    console.log("\n📋 Next Steps:");
    console.log("   1. Copy the contract address to your backend configuration");
    console.log("   2. Run the authorize-issuer.ts script to authorize issuers");
    console.log("   3. Update your .env.local with the contract address");
    console.log("   4. Deploy to staging and test the integration");
    console.log("   5. Deploy to production");

    console.log("\n🔗 Useful Commands:");
    console.log(`   Get Contract Info:   npx hardhat verify --network ${networkName} ${contractAddress}`);
    console.log(`   Check Balance:       npx hardhat balance --account ${deployerAddress} --network ${networkName}`);

    console.log("\n" + "=".repeat(80) + "\n");

    return deploymentInfo;
  } catch (error) {
    console.error("\n❌ Deployment failed:");
    console.error(error);
    process.exit(1);
  }
}

// Run deployment
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
