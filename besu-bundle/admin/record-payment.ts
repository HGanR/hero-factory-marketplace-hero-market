/**
 * Record Payment Script
 * 
 * This script records a payment against a trust instrument on the blockchain.
 * Implements payment tracking and settlement verification.
 * 
 * File: scripts/record-payment.ts
 * 
 * Usage:
 * npx hardhat run scripts/record-payment.ts --network besu
 * 
 * Prerequisites:
 * - Smart contract deployed
 * - Issuer authorized
 * - Instrument recorded and verified
 * - TRUST_CONTRACT_ADDRESS set in environment
 * - INSTRUMENT_ID set in environment
 */

import { ethers } from 'hardhat';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

dotenv.config();

// ============================================================================
// Configuration
// ============================================================================

const PAYMENT_CONFIG = {
  outputFile: 'payment-record.json',
  retryAttempts: 3,
  retryDelayMs: 2000,
};

// ============================================================================
// Type Definitions
// ============================================================================

interface PaymentData {
  instrumentId: string;
  amount: string; // in ETH
  paymentDate: string; // YYYY-MM-DD
  paymentReference: string;
  paymentMethod: string;
  notes?: string;
}

interface PaymentResult {
  success: boolean;
  instrumentId: string;
  amount: string;
  paymentDate: string;
  paymentReference: string;
  paymentMethod: string;
  transactionHash: string;
  blockNumber: number;
  gasUsed: string;
  timestamp: string;
  contractAddress: string;
  explorerUrl: string;
  paymentIndex: number;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get payment data from environment or config
 */
function getPaymentData(): PaymentData {
  const instrumentId = process.env.INSTRUMENT_ID;
  const amount = process.env.PAYMENT_AMOUNT;
  const paymentDate = process.env.PAYMENT_DATE || new Date().toISOString().split('T')[0];
  const paymentReference = process.env.PAYMENT_REFERENCE || `PAY-${Date.now()}`;
  const paymentMethod = process.env.PAYMENT_METHOD || 'bank_transfer';
  const notes = process.env.PAYMENT_NOTES;

  if (!instrumentId) {
    throw new Error('INSTRUMENT_ID not set in environment variables');
  }

  if (!amount) {
    throw new Error('PAYMENT_AMOUNT not set in environment variables');
  }

  return {
    instrumentId,
    amount,
    paymentDate,
    paymentReference,
    paymentMethod,
    notes,
  };
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
  attempts: number = PAYMENT_CONFIG.retryAttempts
): Promise<T> {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === attempts - 1) {
        throw error;
      }
      console.log(
        `   Attempt ${i + 1} failed, retrying in ${PAYMENT_CONFIG.retryDelayMs}ms...`
      );
      await new Promise((resolve) =>
        setTimeout(resolve, PAYMENT_CONFIG.retryDelayMs)
      );
    }
  }
  throw new Error('All retry attempts failed');
}

/**
 * Validate payment data
 */
function validatePaymentData(data: PaymentData): void {
  if (!data.instrumentId || data.instrumentId.trim() === '') {
    throw new Error('Instrument ID cannot be empty');
  }

  const amount = parseFloat(data.amount);
  if (isNaN(amount) || amount <= 0) {
    throw new Error('Payment amount must be a positive number');
  }

  const paymentDate = new Date(data.paymentDate);
  if (isNaN(paymentDate.getTime())) {
    throw new Error(`Invalid payment date format: ${data.paymentDate}`);
  }

  if (!data.paymentReference || data.paymentReference.trim() === '') {
    throw new Error('Payment reference cannot be empty');
  }

  if (!data.paymentMethod || data.paymentMethod.trim() === '') {
    throw new Error('Payment method cannot be empty');
  }
}

/**
 * Save payment record to file
 */
function savePaymentRecord(result: PaymentResult): void {
  const outputPath = path.join(process.cwd(), PAYMENT_CONFIG.outputFile);
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
  console.log(`   Saved to: ${outputPath}`);
}

/**
 * Display payment summary
 */
function displaySummary(result: PaymentResult): void {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('✅ PAYMENT RECORDED SUCCESSFULLY');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log('💰 PAYMENT DETAILS:\n');

  console.log(`Instrument ID: ${result.instrumentId}`);
  console.log(`Amount: ${result.amount} ETH`);
  console.log(`Payment Date: ${result.paymentDate}`);
  console.log(`Payment Reference: ${result.paymentReference}`);
  console.log(`Payment Method: ${result.paymentMethod}`);
  console.log(`Payment Index: ${result.paymentIndex}`);
  console.log(`Contract Address: ${result.contractAddress}`);
  console.log(`Transaction Hash: ${result.transactionHash}`);
  console.log(`Block Number: ${result.blockNumber}`);
  console.log(`Gas Used: ${result.gasUsed}`);
  console.log(`Timestamp: ${result.timestamp}\n`);

  console.log('🔗 BLOCKCHAIN EXPLORER:\n');
  console.log(`View Transaction: ${result.explorerUrl}\n`);

  console.log('🔧 NEXT STEPS:\n');

  console.log('1. Record another payment:');
  console.log('   npx hardhat run scripts/record-payment.ts --network besu\n');

  console.log('2. Query payment history:');
  console.log('   npx hardhat run scripts/query-payments.ts --network besu\n');

  console.log('3. Export certificate:');
  console.log('   npm run export-certificate\n');

  console.log('═══════════════════════════════════════════════════════════\n');
}

// ============================================================================
// Main Recording Function
// ============================================================================

/**
 * Main payment recording process
 */
async function recordPayment(): Promise<PaymentResult> {
  console.log('💰 Starting Payment Recording Process...\n');

  try {
    // ====================================================================
    // Step 1: Get Signer
    // ====================================================================

    console.log('📝 Step 1: Getting signer...');
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
    // Step 4: Get Payment Data
    // ====================================================================

    console.log('💳 Step 4: Getting payment data...');
    const paymentData = getPaymentData();
    console.log(`   Instrument ID: ${paymentData.instrumentId}`);
    console.log(`   Amount: ${paymentData.amount} ETH`);
    console.log(`   Payment Date: ${paymentData.paymentDate}`);
    console.log(`   Payment Reference: ${paymentData.paymentReference}`);
    console.log(`   Payment Method: ${paymentData.paymentMethod}`);
    if (paymentData.notes) {
      console.log(`   Notes: ${paymentData.notes}`);
    }
    console.log('');

    // ====================================================================
    // Step 5: Validate Payment Data
    // ====================================================================

    console.log('✔️  Step 5: Validating payment data...');
    validatePaymentData(paymentData);
    console.log('   All validations passed ✓\n');

    // ====================================================================
    // Step 6: Check Instrument Exists
    // ====================================================================

    console.log('🔍 Step 6: Checking if instrument exists...');
    const [exists] = await contract.instrumentExists(paymentData.instrumentId);

    if (!exists) {
      throw new Error('Instrument not found on blockchain');
    }
    console.log('   Instrument found ✓\n');

    // ====================================================================
    // Step 7: Prepare Transaction Parameters
    // ====================================================================

    console.log('⚙️  Step 7: Preparing transaction parameters...');

    const amount = ethers.parseUnits(paymentData.amount, 18);
    console.log(`   Amount (wei): ${amount.toString()}`);

    const paymentDate = new Date(paymentData.paymentDate);
    const paymentTimestamp = Math.floor(paymentDate.getTime() / 1000);
    console.log(`   Payment timestamp: ${paymentTimestamp}`);

    console.log(`   Payment reference: ${paymentData.paymentReference}`);
    console.log(`   Payment method: ${paymentData.paymentMethod}\n`);

    // ====================================================================
    // Step 8: Estimate Gas
    // ====================================================================

    console.log('⛽ Step 8: Estimating gas...');

    const estimatedGas = await contract.recordPayment.estimateGas(
      paymentData.instrumentId,
      amount,
      paymentTimestamp,
      paymentData.paymentReference,
      paymentData.paymentMethod,
      paymentData.notes || ''
    );

    console.log(`   Estimated gas: ${estimatedGas.toString()}`);

    const estimatedCost = estimatedGas * gasPrice;
    const estimatedCostInEth = ethers.formatEther(estimatedCost);
    console.log(`   Estimated cost: ${estimatedCostInEth} ETH\n`);

    // ====================================================================
    // Step 9: Send Payment Transaction
    // ====================================================================

    console.log('🔧 Step 9: Sending payment transaction...');
    console.log('   Transaction pending...');

    const tx = await retryWithBackoff(async () => {
      return await contract.recordPayment(
        paymentData.instrumentId,
        amount,
        paymentTimestamp,
        paymentData.paymentReference,
        paymentData.paymentMethod,
        paymentData.notes || ''
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
    // Step 11: Get Payment Index
    // ====================================================================

    console.log('📊 Step 11: Getting payment index...');

    const instrument = await contract.getInstrument(paymentData.instrumentId);
    const paymentIndex = instrument.totalPayments - 1;

    console.log(`   Total payments: ${instrument.totalPayments}`);
    console.log(`   Payment index: ${paymentIndex}\n`);

    // ====================================================================
    // Step 12: Get Payment Details
    // ====================================================================

    console.log('💾 Step 12: Getting payment details...');

    const payment = await contract.getPayment(
      paymentData.instrumentId,
      paymentIndex
    );

    console.log(`   Amount: ${ethers.formatUnits(payment.amount, 18)} ETH`);
    console.log(`   Timestamp: ${new Date(payment.timestamp * 1000).toISOString()}`);
    console.log(`   Reference: ${payment.reference}`);
    console.log(`   Method: ${payment.method}\n`);

    // ====================================================================
    // Step 13: Save Payment Record
    // ====================================================================

    console.log('💾 Step 13: Saving payment record...');

    const explorerUrl =
      (process.env.BESU_EXPLORER_URL || 'http://localhost:4000') +
      `/tx/${tx.hash}`;

    const result: PaymentResult = {
      success: true,
      instrumentId: paymentData.instrumentId,
      amount: paymentData.amount,
      paymentDate: paymentData.paymentDate,
      paymentReference: paymentData.paymentReference,
      paymentMethod: paymentData.paymentMethod,
      transactionHash: tx.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed?.toString() || '0',
      timestamp: new Date().toISOString(),
      contractAddress: contractAddress,
      explorerUrl: explorerUrl,
      paymentIndex: paymentIndex,
    };

    savePaymentRecord(result);

    // ====================================================================
    // Display Summary
    // ====================================================================

    displaySummary(result);

    return result;
  } catch (error) {
    console.error('\n❌ Payment recording failed:', error);

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

export default recordPayment;

if (require.main === module) {
  recordPayment()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}
