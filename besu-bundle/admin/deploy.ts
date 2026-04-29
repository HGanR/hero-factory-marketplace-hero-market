/**
 * Hardhat Deployment Script for TrustVerification Contract
 * 
 * This script deploys the TrustVerification smart contract to
 * a Hyperledger Besu network.
 * 
 * File: scripts/deploy.ts
 * 
 * Usage:
 * npx hardhat run scripts/deploy.ts --network besu
 * 
 * Output:
 * - Contract address
 * - Deployment transaction hash
 * - Deployment block number
 * - Gas used
 */

import { ethers } from 'hardhat';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// Configuration
// ============================================================================

const DEPLOYMENT_CONFIG = {
  contractName: 'TrustVerification',
  outputFile: 'deployment-info.json',
  verifyOnExplorer: false, // Set to true if explorer supports verification
};

// ============================================================================
// Deployment Functions
// ============================================================================

/**
 * Deploy the TrustVerification contract
 */
async function deployTrustVerification() {
  console.log('🚀 Starting TrustVerification contract deployment...\n');

  // ========================================================================
  // Step 1: Get Deployer Account
  // ========================================================================

  console.log('📝 Step 1: Getting deployer account...');
  const [deployer] = await ethers.getSigners();
  console.log(`   Deployer address: ${deployer.address}`);

  // Get account balance
  const balance = await ethers.provider.getBalance(deployer.address);
  const balanceInEth = ethers.formatEther(balance);
  console.log(`   Account balance: ${balanceInEth} ETH\n`);

  // ========================================================================
  // Step 2: Get Network Information
  // ========================================================================

  console.log('📡 Step 2: Getting network information...');
  const network = await ethers.provider.getNetwork();
  console.log(`   Network name: ${network.name}`);
  console.log(`   Chain ID: ${network.chainId}`);

  const blockNumber = await ethers.provider.getBlockNumber();
  console.log(`   Current block: ${blockNumber}`);

  const gasPrice = await ethers.provider.getGasPrice();
  const gasPriceInGwei = ethers.formatUnits(gasPrice, 'gwei');
  console.log(`   Gas price: ${gasPriceInGwei} gwei\n`);

  // ========================================================================
  // Step 3: Get Contract Factory
  // ========================================================================

  console.log('📦 Step 3: Getting contract factory...');
  const TrustVerification = await ethers.getContractFactory(
    DEPLOYMENT_CONFIG.contractName
  );
  console.log(`   Contract: ${DEPLOYMENT_CONFIG.contractName}`);
  console.log(`   Bytecode size: ${TrustVerification.bytecode.length / 2} bytes\n`);

  // ========================================================================
  // Step 4: Estimate Gas
  // ========================================================================

  console.log('⛽ Step 4: Estimating deployment gas...');
  const estimatedGas = await ethers.provider.estimateGas(
    TrustVerification.getDeployTransaction()
  );
  console.log(`   Estimated gas: ${estimatedGas.toString()}`);

  const estimatedCost = estimatedGas * gasPrice;
  const estimatedCostInEth = ethers.formatEther(estimatedCost);
  console.log(`   Estimated cost: ${estimatedCostInEth} ETH\n`);

  // ========================================================================
  // Step 5: Deploy Contract
  // ========================================================================

  console.log('🔧 Step 5: Deploying contract...');
  console.log('   Sending transaction...');

  const contract = await TrustVerification.deploy();

  console.log(`   Transaction hash: ${contract.deploymentTransaction()?.hash}`);

  console.log('   Waiting for confirmation...');
  const deploymentReceipt = await contract.deploymentTransaction()?.wait();

  console.log(`   ✅ Contract deployed!\n`);

  // ========================================================================
  // Step 6: Get Deployment Details
  // ========================================================================

  console.log('📋 Step 6: Getting deployment details...');
  const contractAddress = await contract.getAddress();
  console.log(`   Contract address: ${contractAddress}`);
  console.log(`   Deployment block: ${deploymentReceipt?.blockNumber}`);
  console.log(`   Gas used: ${deploymentReceipt?.gasUsed?.toString()}`);
  console.log(`   Transaction hash: ${deploymentReceipt?.hash}\n`);

  // ========================================================================
  // Step 7: Verify Deployment
  // ========================================================================

  console.log('✔️  Step 7: Verifying deployment...');

  // Check contract code
  const code = await ethers.provider.getCode(contractAddress);
  if (code === '0x') {
    throw new Error('Contract deployment failed - no code at address');
  }
  console.log(`   Contract code verified ✓`);

  // Get contract instance
  const deployedContract = TrustVerification.attach(contractAddress);
  console.log(`   Contract instance created ✓\n`);

  // ========================================================================
  // Step 8: Test Contract Functions
  // ========================================================================

  console.log('🧪 Step 8: Testing contract functions...');

  try {
    // Test getInstrumentCount (should be 0 initially)
    const count = await deployedContract.getInstrumentCount();
    console.log(`   Instrument count: ${count}`);

    // Test getIssuerCount (should be 0 initially)
    const issuerCount = await deployedContract.getIssuerCount();
    console.log(`   Issuer count: ${issuerCount}`);

    console.log('   ✓ Contract functions working\n');
  } catch (error) {
    console.error('   ⚠️  Error testing contract functions:', error);
  }

  // ========================================================================
  // Step 9: Save Deployment Information
  // ========================================================================

  console.log('💾 Step 9: Saving deployment information...');

  const deploymentInfo = {
    contractName: DEPLOYMENT_CONFIG.contractName,
    contractAddress: contractAddress,
    deployerAddress: deployer.address,
    deploymentBlock: deploymentReceipt?.blockNumber,
    deploymentHash: deploymentReceipt?.hash,
    deploymentTimestamp: new Date().toISOString(),
    network: {
      name: network.name,
      chainId: network.chainId,
    },
    gas: {
      used: deploymentReceipt?.gasUsed?.toString(),
      price: gasPrice.toString(),
      estimatedCost: estimatedCostInEth,
    },
    abi: TrustVerification.interface.formatJson(),
  };

  // Save to file
  const outputPath = path.join(process.cwd(), DEPLOYMENT_CONFIG.outputFile);
  fs.writeFileSync(outputPath, JSON.stringify(deploymentInfo, null, 2));
  console.log(`   Saved to: ${outputPath}\n`);

  // ========================================================================
  // Step 10: Display Summary
  // ========================================================================

  console.log('═══════════════════════════════════════════════════════════');
  console.log('✅ DEPLOYMENT SUCCESSFUL');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log('📌 IMPORTANT INFORMATION:\n');

  console.log(`Contract Address: ${contractAddress}`);
  console.log(`Deployment Block: ${deploymentReceipt?.blockNumber}`);
  console.log(`Deployment Hash: ${deploymentReceipt?.hash}`);
  console.log(`Gas Used: ${deploymentReceipt?.gasUsed?.toString()}\n`);

  console.log('🔧 NEXT STEPS:\n');

  console.log('1. Save the contract address to your environment variables:');
  console.log(`   TRUST_CONTRACT_ADDRESS=${contractAddress}\n`);

  console.log('2. Save the contract ABI:');
  console.log(`   TRUST_CONTRACT_ABI='${JSON.stringify(deploymentInfo.abi)}'`);
  console.log('   (Or save to a file and reference it)\n');

  console.log('3. Authorize the issuer:');
  console.log(`   npx hardhat run scripts/authorize-issuer.ts --network besu\n`);

  console.log('4. Test the contract:');
  console.log(`   npx hardhat test --network besu\n`);

  console.log('═══════════════════════════════════════════════════════════\n');

  return {
    contractAddress,
    deploymentInfo,
  };
}

/**
 * Authorize an issuer on the deployed contract
 */
async function authorizeIssuer(contractAddress: string) {
  console.log('🔐 Authorizing issuer...\n');

  const [signer] = await ethers.getSigners();
  const TrustVerification = await ethers.getContractFactory(
    DEPLOYMENT_CONFIG.contractName
  );
  const contract = TrustVerification.attach(contractAddress);

  const issuerAddress = signer.address;
  const issuerName = process.env.ISSUER_NAME || 'TroothHurtz';
  const issuerEmail = process.env.ISSUER_EMAIL || 'certificates@troothurtz.com';

  console.log(`Issuer address: ${issuerAddress}`);
  console.log(`Issuer name: ${issuerName}`);
  console.log(`Issuer email: ${issuerEmail}\n`);

  try {
    const tx = await contract.authorizeIssuer(
      issuerAddress,
      issuerName,
      issuerEmail
    );

    console.log(`Transaction hash: ${tx.hash}`);
    console.log('Waiting for confirmation...');

    const receipt = await tx.wait();

    console.log(`✅ Issuer authorized!`);
    console.log(`Block: ${receipt?.blockNumber}`);
    console.log(`Gas used: ${receipt?.gasUsed?.toString()}\n`);

    return receipt;
  } catch (error) {
    console.error('❌ Error authorizing issuer:', error);
    throw error;
  }
}

/**
 * Verify contract on block explorer
 */
async function verifyContractOnExplorer(
  contractAddress: string,
  constructorArgs: any[] = []
) {
  if (!DEPLOYMENT_CONFIG.verifyOnExplorer) {
    return;
  }

  console.log('🔍 Verifying contract on explorer...\n');

  try {
    await ethers.provider.verify(contractAddress, constructorArgs);
    console.log('✅ Contract verified on explorer\n');
  } catch (error) {
    console.warn('⚠️  Could not verify on explorer:', error);
  }
}

// ============================================================================
// Main Execution
// ============================================================================

async function main() {
  try {
    const { contractAddress, deploymentInfo } = await deployTrustVerification();

    // Optionally authorize issuer
    if (process.env.AUTO_AUTHORIZE_ISSUER === 'true') {
      console.log('🔐 Auto-authorizing issuer...\n');
      await authorizeIssuer(contractAddress);
    }

    // Optionally verify on explorer
    if (DEPLOYMENT_CONFIG.verifyOnExplorer) {
      await verifyContractOnExplorer(contractAddress);
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Deployment failed:', error);
    process.exit(1);
  }
}

main();
