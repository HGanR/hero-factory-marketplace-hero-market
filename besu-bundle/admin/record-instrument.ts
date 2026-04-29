/**
 * Record Instrument Script
 * 
 * This script records a trust instrument on the TrustVerification smart contract.
 * Used for testing and demonstration purposes.
 * 
 * File: scripts/record-instrument.ts
 * 
 * Usage:
 * npx hardhat run scripts/record-instrument.ts --network besu
 * 
 * Prerequisites:
 * - Smart contract deployed
 * - Issuer authorized
 * - TRUST_CONTRACT_ADDRESS set in environment
 */

import { ethers } from 'hardhat';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// ============================================================================
// Configuration
// ============================================================================

const RECORD_CONFIG = {
  outputFile: 'recorded-instrument-info.json',
  retryAttempts: 3,
  retryDelayMs: 2000,
};

// ============================================================================
// Type Definitions
// ============================================================================

interface InstrumentData {
  instrumentId: string;
  name: string;
  amount: string; // in ETH
  beneficiary: string;
  maturityDate: string; // YYYY-MM-DD
  terms: string;
}

interface RecordingResult {
  success: boolean;
  instrumentId: string;
  name: string;
  amount: string;
  beneficiary: string;
  maturityDate: string;
  documentHash: string;
  transactionHash: string;
  blockNumber: number;
  gasUsed: string;
  timestamp: string;
  contractAddress: string;
  explorerUrl: string;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create SHA256 hash of instrument data
 */
function createDocumentHash(data: InstrumentData): string {
  const dataString = JSON.stringify({
    instrumentId: data.instrumentId,
    name: data.name,
    amount: data.amount,
    beneficiary: data.beneficiary,
    maturityDate: data.maturityDate,
    terms: data.terms,
  });

  const hash = crypto.createHash('sha256').update(dataString).digest('hex');
  return '0x' + hash;
}

/**
 * Get instrument data from environment or config
 */
function getInstrumentData(): InstrumentData {
  const instrumentId = process.env.INSTRUMENT_ID || 'trust-' + Date.now();
  const name = process.env.INSTRUMENT_NAME || 'Sample Trust Record';
  const amount = process.env.INSTRUMENT_AMOUNT || '50000'; // ETH
  const beneficiary = process.env.BENEFICIARY_ADDRESS;
  const maturityDate = process.env.MATURITY_DATE || '2025-12-31';
  const terms =
    process.env.INSTRUMENT_TERMS ||
    'This is a sample trust record for testing purposes.';

  if (!beneficiary) {
    throw new Error('BENEFICIARY_ADDRESS not set in environment variables');
  }

  return {
    instrumentId,
    name,
    amount,
    beneficiary,
    maturityDate,
    terms,
  };
}

/**
 * Convert date string to Unix timestamp
 */
function dateToUnixTimestamp(dateString: string): number {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date format: ${dateString}`);
  }
  return Math.floor(date.getTime() / 1000);
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
  attempts: number = RECORD_CONFIG.retryAttempts
): Promise<T> {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === attempts - 1) {
        throw error;
      }
      console.log(
        `   Attempt ${i + 1} failed, retrying in ${RECORD_CONFIG.retryDelayMs}ms...`
      );
      await new Promise((resolve) =>
        setTimeout(resolve, RECORD_CONFIG.retryDelayMs)
      );
    }
  }
  throw new Error('All retry attempts failed');
}

/**
 * Validate instrument data
 */
function validateInstrumentData(data: InstrumentData): void {
  if (!data.instrumentId || data.instrumentId.trim() === '') {
    throw new Error('Instrument ID cannot be empty');
  }

  if (!data.name || data.name.trim() === '') {
    throw new Error('Instrument name cannot be empty');
  }

  const amount = parseFloat(data.amount);
  if (isNaN(amount) || amount <= 0) {
    throw new Error('Amount must be a positive number');
  }

  if (!ethers.isAddress(data.beneficiary)) {
    throw new Error(`Invalid beneficiary address: ${data.beneficiary}`);
  }

  const maturityTimestamp = dateToUnixTimestamp(data.maturityDate);
  const now = Math.floor(Date.now() / 1000);
  if (maturityTimestamp <= now) {
    throw new Error('Maturity date must be in the future');
  }

  if (!data.terms || data.terms.trim() === '') {
    throw new Error('Terms cannot be empty');
  }
}

/**
 * Save recording information to file
 */
function saveRecordingInfo(result: RecordingResult): void {
  const outputPath = path.join(process.cwd(), RECORD_CONFIG.outputFile);
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
  console.log(`   Saved to: ${outputPath}`);
}

/**
 * Display recording summary
 */
function displaySummary(result: RecordingResult): void {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('✅ INSTRUMENT RECORDED SUCCESSFULLY');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log('📌 INSTRUMENT DETAILS:\n');

  console.log(`Instrument ID: ${result.instrumentId}`);
  console.log(`Name: ${result.name}`);
  console.log(`Amount: ${result.amount} ETH`);
  console.log(`Beneficiary: ${result.beneficiary}`);
  console.log(`Maturity Date: ${result.maturityDate}`);
  console.log(`Document Hash: ${result.documentHash}`);
  console.log(`Contract Address: ${result.contractAddress}`);
  console.log(`Transaction Hash: ${result.transactionHash}`);
  console.log(`Block Number: ${result.blockNumber}`);
  console.log(`Gas Used: ${result.gasUsed}`);
  console.log(`Timestamp: ${result.timestamp}\n`);

  console.log('🔗 BLOCKCHAIN EXPLORER:\n');
  console.log(`View Transaction: ${result.explorerUrl}\n`);

  console.log('🔧 NEXT STEPS:\n');

  console.log('1. Verify the instrument was recorded:');
  console.log(`   npx hardhat run scripts/verify-instrument.ts --network besu\n`);

  console.log('2. Record a payment:');
  console.log(`   npx hardhat run scripts/record-payment.ts --network besu\n`);

  console.log('3. Query instrument details:');
  console.log(`   npx hardhat run scripts/query-instrument.ts --network besu\n`);

  console.log('═══════════════════════════════════════════════════════════\n');
}

// ============================================================================
// Main Recording Function
// ============================================================================

/**
 * Main recording process
 */
async function recordInstrument(): Promise<RecordingResult> {
  console.log('📝 Starting Instrument Recording Process...\n');

  try {
    // ====================================================================
    // Step 1: Get Signer
    // ====================================================================

    console.log('📝 Step 1: Getting signer (issuer)...');
    const [signer] = await ethers.getSigners();
    console.log(`   Signer address: ${signer.address}`);

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

    const code = await ethers.provider.getCode(contractAddress);
    if (code === '0x') {
      throw new Error('Contract not found at address');
    }
    console.log('   Contract verified ✓\n');

    // ====================================================================
    // Step 4: Get Instrument Data
    // ====================================================================

    console.log('📋 Step 4: Getting instrument data...');
    const instrumentData = getInstrumentData();
    console.log(`   Instrument ID: ${instrumentData.instrumentId}`);
    console.log(`   Name: ${instrumentData.name}`);
    console.log(`   Amount: ${instrumentData.amount} ETH`);
    console.log(`   Beneficiary: ${instrumentData.beneficiary}`);
    console.log(`   Maturity Date: ${instrumentData.maturityDate}`);
    console.log(`   Terms: ${instrumentData.terms.substring(0, 50)}...\n`);

    // ====================================================================
    // Step 5: Validate Instrument Data
    // ====================================================================

    console.log('✔️  Step 5: Validating instrument data...');
    validateInstrumentData(instrumentData);
    console.log('   All validations passed ✓\n');

    // ====================================================================
    // Step 6: Create Document Hash
    // ====================================================================

    console.log('🔐 Step 6: Creating document hash...');
    const documentHash = createDocumentHash(instrumentData);
    console.log(`   Document hash: ${documentHash}\n`);

    // ====================================================================
    // Step 7: Prepare Transaction Parameters
    // ====================================================================

    console.log('⚙️  Step 7: Preparing transaction parameters...');

    const amount = ethers.parseUnits(instrumentData.amount, 18);
    console.log(`   Amount (wei): ${amount.toString()}`);

    const maturityTimestamp = dateToUnixTimestamp(instrumentData.maturityDate);
    console.log(`   Maturity timestamp: ${maturityTimestamp}`);

    console.log(`   Beneficiary: ${instrumentData.beneficiary}\n`);

    // ====================================================================
    // Step 8: Estimate Gas
    // ====================================================================

    console.log('⛽ Step 8: Estimating gas...');

    const estimatedGas = await contract.recordInstrument.estimateGas(
      instrumentData.instrumentId,
      instrumentData.name,
      amount,
      instrumentData.beneficiary,
      maturityTimestamp,
      instrumentData.terms,
      documentHash
    );

    console.log(`   Estimated gas: ${estimatedGas.toString()}`);

    const estimatedCost = estimatedGas * gasPrice;
    const estimatedCostInEth = ethers.formatEther(estimatedCost);
    console.log(`   Estimated cost: ${estimatedCostInEth} ETH\n`);

    // ====================================================================
    // Step 9: Send Recording Transaction
    // ====================================================================

    console.log('🔧 Step 9: Sending recording transaction...');
    console.log('   Transaction pending...');

    const tx = await retryWithBackoff(async () => {
      return await contract.recordInstrument(
        instrumentData.instrumentId,
        instrumentData.name,
        amount,
        instrumentData.beneficiary,
        maturityTimestamp,
        instrumentData.terms,
        documentHash
      );
    });

    console.log(`   Transaction hash: ${tx.hash}`);
    console.log('   Waiting for confirmation...\n');

    // ====================================================================
    // Step 10: Wait for Confirmation
    // ====================================================================

    console.log('⏳ Step 10: Waiting for transaction confirmation...');
    const receipt = await tx.wait();

    if (!receipt) {
      throw new Error('Transaction receipt not found');
    }

    console.log(`   ✅ Transaction confirmed!`);
    console.log(`   Block number: ${receipt.blockNumber}`);
    console.log(`   Gas used: ${receipt.gasUsed?.toString()}\n`);

    // ====================================================================
    // Step 11: Verify Recording
    // ====================================================================

    console.log('✔️  Step 11: Verifying instrument was recorded...');

    const [exists, recordedAt, recordedBlock, issuer] =
      await contract.instrumentExists(instrumentData.instrumentId);

    if (!exists) {
      throw new Error('Instrument verification failed - not found on blockchain');
    }

    console.log('   Instrument found on blockchain ✓');
    console.log(`   Recorded at: ${new Date(recordedAt * 1000).toISOString()}`);
    console.log(`   Recorded block: ${recordedBlock}`);
    console.log(`   Issuer: ${issuer}\n`);

    // ====================================================================
    // Step 12: Get Full Instrument Details
    // ====================================================================

    console.log('📋 Step 12: Getting full instrument details...');

    const instrument = await contract.getInstrument(
      instrumentData.instrumentId
    );

    console.log(`   Name: ${instrument.name}`);
    console.log(`   Amount: ${ethers.formatUnits(instrument.amount, 18)} ETH`);
    console.log(`   Beneficiary: ${instrument.beneficiary}`);
    console.log(`   Revoked: ${instrument.revoked}`);
    console.log(`   Total Payments: ${instrument.totalPayments}\n`);

    // ====================================================================
    // Step 13: Save Information
    // ====================================================================

    console.log('💾 Step 13: Saving recording information...');

    const explorerUrl =
      (process.env.BESU_EXPLORER_URL || 'http://localhost:4000') +
      `/tx/${tx.hash}`;

    const result: RecordingResult = {
      success: true,
      instrumentId: instrumentData.instrumentId,
      name: instrumentData.name,
      amount: instrumentData.amount,
      beneficiary: instrumentData.beneficiary,
      maturityDate: instrumentData.maturityDate,
      documentHash: documentHash,
      transactionHash: tx.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed?.toString() || '0',
      timestamp: new Date().toISOString(),
      contractAddress: contractAddress,
      explorerUrl: explorerUrl,
    };

    saveRecordingInfo(result);

    // ====================================================================
    // Display Summary
    // ====================================================================

    displaySummary(result);

    return result;
  } catch (error) {
    console.error('\n❌ Recording failed:', error);

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

export default recordInstrument;

// Execute if run directly
if (require.main === module) {
  recordInstrument()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}
