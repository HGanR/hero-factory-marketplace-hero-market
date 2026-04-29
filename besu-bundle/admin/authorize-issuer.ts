/**
 * Authorize Issuer Script
 * 
 * This script authorizes an issuer (TroothHurtz) to record instruments
 * on the TrustVerification smart contract.
 * 
 * File: scripts/authorize-issuer.ts
 * 
 * Usage:
 * npx hardhat run scripts/authorize-issuer.ts --network besu
 * 
 * Prerequisites:
 * - Smart contract already deployed
 * - TRUST_CONTRACT_ADDRESS set in environment
 * - ISSUER_PRIVATE_KEY set in environment
 */

import { ethers } from 'hardhat';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// ============================================================================
// Configuration
// ============================================================================

const AUTHORIZATION_CONFIG = {
  outputFile: 'authorization-info.json',
  retryAttempts: 3,
  retryDelayMs: 2000,
};

// ============================================================================
// Type Definitions
// ============================================================================

interface IssuerInfo {
  address: string;
  name: string;
  email: string;
}

interface AuthorizationResult {
  success: boolean;
  issuerAddress: string;
  issuerName: string;
  issuerEmail: string;
  transactionHash: string;
  blockNumber: number;
  gasUsed: string;
  timestamp: string;
  contractAddress: string;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get issuer information from environment or config
 */
function getIssuerInfo(): IssuerInfo {
  const address = process.env.ISSUER_ADDRESS;
  const name = process.env.ISSUER_NAME || 'TroothHurtz';
  const email = process.env.ISSUER_EMAIL || 'certificates@troothurtz.com';

  if (!address) {
    throw new Error('ISSUER_ADDRESS not set in environment variables');
  }

  return { address, name, email };
}

/**
 * Get contract instance
 */
async function getContractInstance() {
  const contractAddress = process.env.TRUST_CONTRACT_ADDRESS;

  if (!contractAddress) {
    throw new Error('TRUST_CONTRACT_ADDRESS not set in environment variables');
  }

  const TrustVerification = await ethers.getContractFactory(
    'TrustVerification'
  );
  const contract = TrustVerification.attach(contractAddress);

  return { contract, contractAddress };
}

/**
 * Retry logic for failed transactions
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  attempts: number = AUTHORIZATION_CONFIG.retryAttempts
): Promise<T> {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === attempts - 1) {
        throw error;
      }
      console.log(
        `   Attempt ${i + 1} failed, retrying in ${AUTHORIZATION_CONFIG.retryDelayMs}ms...`
      );
      await new Promise((resolve) =>
        setTimeout(resolve, AUTHORIZATION_CONFIG.retryDelayMs)
      );
    }
  }
  throw new Error('All retry attempts failed');
}

/**
 * Validate issuer is not already authorized
 */
async function validateNotAlreadyAuthorized(
  contract: any,
  issuerAddress: string
): Promise<boolean> {
  try {
    const issuerInfo = await contract.getIssuer(issuerAddress);
    return issuerInfo.isActive;
  } catch {
    return false;
  }
}

/**
 * Save authorization information to file
 */
function saveAuthorizationInfo(result: AuthorizationResult) {
  const outputPath = path.join(
    process.cwd(),
    AUTHORIZATION_CONFIG.outputFile
  );

  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
  console.log(`   Saved to: ${outputPath}`);
}

/**
 * Display authorization summary
 */
function displaySummary(result: AuthorizationResult) {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('✅ ISSUER AUTHORIZATION SUCCESSFUL');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log('📌 AUTHORIZATION DETAILS:\n');

  console.log(`Issuer Address: ${result.issuerAddress}`);
  console.log(`Issuer Name: ${result.issuerName}`);
  console.log(`Issuer Email: ${result.issuerEmail}`);
  console.log(`Contract Address: ${result.contractAddress}`);
  console.log(`Transaction Hash: ${result.transactionHash}`);
  console.log(`Block Number: ${result.blockNumber}`);
  console.log(`Gas Used: ${result.gasUsed}`);
  console.log(`Timestamp: ${result.timestamp}\n`);

  console.log('🔧 NEXT STEPS:\n');

  console.log('1. Verify authorization on block explorer:');
  console.log(
    `   ${process.env.BESU_EXPLORER_URL || 'http://localhost:4000'}/tx/${result.transactionHash}\n`
  );

  console.log('2. Test recording an instrument:');
  console.log('   npx hardhat run scripts/record-instrument.ts --network besu\n');

  console.log('3. Verify the instrument:');
  console.log('   npx hardhat run scripts/verify-instrument.ts --network besu\n');

  console.log('═══════════════════════════════════════════════════════════\n');
}

// ============================================================================
// Main Authorization Function
// ============================================================================

/**
 * Main authorization process
 */
async function authorizeIssuer() {
  console.log('🔐 Starting Issuer Authorization Process...\n');

  try {
    // ====================================================================
    // Step 1: Get Signer
    // ====================================================================

    console.log('📝 Step 1: Getting signer...');
    const [signer] = await ethers.getSigners();
    console.log(`   Signer address: ${signer.address}`);

    // Get balance
    const balance = await ethers.provider.getBalance(signer.address);
    const balanceInEth = ethers.formatEther(balance);
    console.log(`   Signer balance: ${balanceInEth} ETH\n`);

    // ====================================================================
    // Step 2: Get Network Information
    // ====================================================================

    console.log('📡 Step 2: Getting network information...');
    const network = await ethers.provider.getNetwork();
    console.log(`   Network: ${network.name}`);
    console.log(`   Chain ID: ${network.chainId}`);

    const blockNumber = await ethers.provider.getBlockNumber();
    console.log(`   Current block: ${blockNumber}`);

    const gasPrice = await ethers.provider.getGasPrice();
    const gasPriceInGwei = ethers.formatUnits(gasPrice, 'gwei');
    console.log(`   Gas price: ${gasPriceInGwei} gwei\n`);

    // ====================================================================
    // Step 3: Get Contract Instance
    // ====================================================================

    console.log('📦 Step 3: Getting contract instance...');
    const { contract, contractAddress } = await getContractInstance();
    console.log(`   Contract address: ${contractAddress}`);

    // Verify contract has code
    const code = await ethers.provider.getCode(contractAddress);
    if (code === '0x') {
      throw new Error('Contract not found at address - deployment may have failed');
    }
    console.log('   Contract verified ✓\n');

    // ====================================================================
    // Step 4: Get Issuer Information
    // ====================================================================

    console.log('👤 Step 4: Getting issuer information...');
    const issuerInfo = getIssuerInfo();
    console.log(`   Issuer address: ${issuerInfo.address}`);
    console.log(`   Issuer name: ${issuerInfo.name}`);
    console.log(`   Issuer email: ${issuerInfo.email}\n`);

    // ====================================================================
    // Step 5: Check if Already Authorized
    // ====================================================================

    console.log('🔍 Step 5: Checking if issuer already authorized...');
    const alreadyAuthorized = await validateNotAlreadyAuthorized(
      contract,
      issuerInfo.address
    );

    if (alreadyAuthorized) {
      console.log('   ⚠️  Issuer already authorized\n');
      console.log('   Skipping authorization...\n');

      // Get existing authorization info
      const issuerData = await contract.getIssuer(issuerInfo.address);
      const result: AuthorizationResult = {
        success: true,
        issuerAddress: issuerInfo.address,
        issuerName: issuerData.issuerName,
        issuerEmail: issuerData.issuerEmail,
        transactionHash: 'N/A - Already authorized',
        blockNumber: 0,
        gasUsed: '0',
        timestamp: new Date().toISOString(),
        contractAddress: contractAddress,
      };

      saveAuthorizationInfo(result);
      displaySummary(result);
      return result;
    }

    console.log('   Issuer not yet authorized ✓\n');

    // ====================================================================
    // Step 6: Estimate Gas
    // ====================================================================

    console.log('⛽ Step 6: Estimating gas...');
    const estimatedGas = await contract.authorizeIssuer.estimateGas(
      issuerInfo.address,
      issuerInfo.name,
      issuerInfo.email
    );
    console.log(`   Estimated gas: ${estimatedGas.toString()}`);

    const estimatedCost = estimatedGas * gasPrice;
    const estimatedCostInEth = ethers.formatEther(estimatedCost);
    console.log(`   Estimated cost: ${estimatedCostInEth} ETH\n`);

    // ====================================================================
    // Step 7: Send Authorization Transaction
    // ====================================================================

    console.log('🔧 Step 7: Sending authorization transaction...');
    console.log('   Transaction pending...');

    const tx = await retryWithBackoff(async () => {
      return await contract.authorizeIssuer(
        issuerInfo.address,
        issuerInfo.name,
        issuerInfo.email
      );
    });

    console.log(`   Transaction hash: ${tx.hash}`);
    console.log('   Waiting for confirmation...\n');

    // ====================================================================
    // Step 8: Wait for Confirmation
    // ====================================================================

    console.log('⏳ Step 8: Waiting for transaction confirmation...');
    const receipt = await tx.wait();

    if (!receipt) {
      throw new Error('Transaction receipt not found');
    }

    console.log(`   ✅ Transaction confirmed!`);
    console.log(`   Block number: ${receipt.blockNumber}`);
    console.log(`   Gas used: ${receipt.gasUsed?.toString()}\n`);

    // ====================================================================
    // Step 9: Verify Authorization
    // ====================================================================

    console.log('✔️  Step 9: Verifying authorization...');

    const verifyIsAuthorized = await validateNotAlreadyAuthorized(
      contract,
      issuerInfo.address
    );

    if (!verifyIsAuthorized) {
      throw new Error('Authorization verification failed');
    }

    console.log('   Authorization verified ✓');

    // Get issuer details
    const issuerData = await contract.getIssuer(issuerInfo.address);
    console.log(`   Issuer name: ${issuerData.issuerName}`);
    console.log(`   Issuer email: ${issuerData.issuerEmail}`);
    console.log(`   Active: ${issuerData.isActive}\n`);

    // ====================================================================
    // Step 10: Save Information
    // ====================================================================

    console.log('💾 Step 10: Saving authorization information...');

    const result: AuthorizationResult = {
      success: true,
      issuerAddress: issuerInfo.address,
      issuerName: issuerInfo.name,
      issuerEmail: issuerInfo.email,
      transactionHash: tx.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed?.toString() || '0',
      timestamp: new Date().toISOString(),
      contractAddress: contractAddress,
    };

    saveAuthorizationInfo(result);

    // ====================================================================
    // Display Summary
    // ====================================================================

    displaySummary(result);

    return result;
  } catch (error) {
    console.error('\n❌ Authorization failed:', error);

    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Stack:', error.stack);
    }

    process.exit(1);
  }
}

// ============================================================================
// Export and Execute
// ============================================================================

export default authorizeIssuer;

// Execute if run directly
if (require.main === module) {
  authorizeIssuer()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}
