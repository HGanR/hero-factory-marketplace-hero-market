/**
 * Verify Instrument Script
 * 
 * This script verifies a trust instrument on the TrustVerification smart contract.
 * Implements Step 5 and 6 of the complete workflow.
 * 
 * File: scripts/verify-instrument.ts
 * 
 * Usage:
 * npx hardhat run scripts/verify-instrument.ts --network besu
 * 
 * Prerequisites:
 * - Smart contract deployed
 * - Issuer authorized
 * - Instrument recorded
 * - TRUST_CONTRACT_ADDRESS set in environment
 * - INSTRUMENT_ID set in environment
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

const VERIFICATION_CONFIG = {
  outputFile: 'verification-result.json',
  retryAttempts: 3,
  retryDelayMs: 2000,
};

// ============================================================================
// Type Definitions
// ============================================================================

interface VerificationCheckResult {
  instrumentExists: boolean;
  recordedAt?: number;
  recordedBlock?: number;
  issuer?: string;
}

interface IssuerCheckResult {
  issuerAuthorized: boolean;
  issuerAddress?: string;
  issuerName?: string;
  issuerEmail?: string;
}

interface HashCheckResult {
  hashMatches: boolean;
  expectedHash: string;
  actualHash: string;
}

interface ComprehensiveVerificationResult {
  instrumentExists: boolean;
  issuerAuthorized: boolean;
  documentHashMatches: boolean;
  verificationTimestamp: number;
  verificationBlock: number;
}

interface VerificationResult {
  success: boolean;
  instrumentId: string;
  verified: boolean;
  checks: {
    instrumentExists: VerificationCheckResult;
    issuerAuthorized: IssuerCheckResult;
    hashMatches: HashCheckResult;
  };
  comprehensiveResult: ComprehensiveVerificationResult;
  blockchainDetails: {
    transactionHash: string;
    blockNumber: number;
    timestamp: string;
    contractAddress: string;
    explorerUrl: string;
  };
  timestamp: string;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create SHA256 hash of instrument data from recorded-instrument-info.json
 */
function createDocumentHashFromFile(): string {
  const filePath = path.join(process.cwd(), 'recorded-instrument-info.json');

  if (!fs.existsSync(filePath)) {
    throw new Error(
      'recorded-instrument-info.json not found. Please run record-instrument.ts first.'
    );
  }

  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const instrumentInfo = JSON.parse(fileContent);

  const dataString = JSON.stringify({
    instrumentId: instrumentInfo.instrumentId,
    name: instrumentInfo.name,
    amount: instrumentInfo.amount,
    beneficiary: instrumentInfo.beneficiary,
    maturityDate: instrumentInfo.maturityDate,
  });

  const hash = crypto.createHash('sha256').update(dataString).digest('hex');
  return '0x' + hash;
}

/**
 * Get instrument ID from environment or config
 */
function getInstrumentId(): string {
  const instrumentId = process.env.INSTRUMENT_ID;

  if (!instrumentId) {
    // Try to get from recorded-instrument-info.json
    const filePath = path.join(process.cwd(), 'recorded-instrument-info.json');
    if (fs.existsSync(filePath)) {
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const instrumentInfo = JSON.parse(fileContent);
      return instrumentInfo.instrumentId;
    }

    throw new Error(
      'INSTRUMENT_ID not set in environment variables or recorded-instrument-info.json not found'
    );
  }

  return instrumentId;
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
 * Retry logic for failed calls
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  attempts: number = VERIFICATION_CONFIG.retryAttempts
): Promise<T> {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === attempts - 1) {
        throw error;
      }
      console.log(
        `   Attempt ${i + 1} failed, retrying in ${VERIFICATION_CONFIG.retryDelayMs}ms...`
      );
      await new Promise((resolve) =>
        setTimeout(resolve, VERIFICATION_CONFIG.retryDelayMs)
      );
    }
  }
  throw new Error('All retry attempts failed');
}

/**
 * Save verification result to file
 */
function saveVerificationResult(result: VerificationResult): void {
  const outputPath = path.join(process.cwd(), VERIFICATION_CONFIG.outputFile);
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
  console.log(`   Saved to: ${outputPath}`);
}

/**
 * Display verification summary
 */
function displaySummary(result: VerificationResult): void {
  console.log('\n═══════════════════════════════════════════════════════════');
  if (result.verified) {
    console.log('✅ INSTRUMENT VERIFICATION SUCCESSFUL');
  } else {
    console.log('⚠️  INSTRUMENT VERIFICATION FAILED');
  }
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log('📌 VERIFICATION DETAILS:\n');

  console.log(`Instrument ID: ${result.instrumentId}`);
  console.log(`Overall Status: ${result.verified ? '✓ VERIFIED' : '✗ NOT VERIFIED'}\n`);

  console.log('🔍 VERIFICATION CHECKS:\n');

  console.log(
    `1. Instrument Exists: ${result.checks.instrumentExists.instrumentExists ? '✓' : '✗'}`
  );
  if (result.checks.instrumentExists.instrumentExists) {
    console.log(
      `   Recorded at: ${new Date(result.checks.instrumentExists.recordedAt! * 1000).toISOString()}`
    );
    console.log(`   Block: ${result.checks.instrumentExists.recordedBlock}`);
    console.log(`   Issuer: ${result.checks.instrumentExists.issuer}`);
  }

  console.log(
    `\n2. Issuer Authorized: ${result.checks.issuerAuthorized.issuerAuthorized ? '✓' : '✗'}`
  );
  if (result.checks.issuerAuthorized.issuerAuthorized) {
    console.log(`   Issuer: ${result.checks.issuerAuthorized.issuerName}`);
    console.log(`   Email: ${result.checks.issuerAuthorized.issuerEmail}`);
  }

  console.log(
    `\n3. Document Hash Matches: ${result.checks.hashMatches.hashMatches ? '✓' : '✗'}`
  );
  console.log(`   Expected: ${result.checks.hashMatches.expectedHash}`);
  console.log(`   Actual: ${result.checks.hashMatches.actualHash}`);

  console.log('\n📊 COMPREHENSIVE VERIFICATION:\n');

  console.log(
    `Verification Timestamp: ${new Date(result.comprehensiveResult.verificationTimestamp * 1000).toISOString()}`
  );
  console.log(`Verification Block: ${result.comprehensiveResult.verificationBlock}`);

  console.log('\n🔗 BLOCKCHAIN DETAILS:\n');

  console.log(`Contract Address: ${result.blockchainDetails.contractAddress}`);
  console.log(`Block Number: ${result.blockchainDetails.blockNumber}`);
  console.log(`Timestamp: ${result.blockchainDetails.timestamp}`);
  console.log(`\nExplorer Link: ${result.blockchainDetails.explorerUrl}`);

  console.log('\n🔧 NEXT STEPS:\n');

  if (result.verified) {
    console.log('1. Record a payment:');
    console.log('   npx hardhat run scripts/record-payment.ts --network besu\n');

    console.log('2. Export a certificate:');
    console.log('   npm run export-certificate\n');

    console.log('3. Query instrument details:');
    console.log('   npx hardhat run scripts/query-instrument.ts --network besu\n');
  } else {
    console.log('1. Check the instrument was recorded correctly');
    console.log('2. Verify the issuer is authorized');
    console.log('3. Check the document hash matches');
    console.log('4. Re-run this verification script\n');
  }

  console.log('═══════════════════════════════════════════════════════════\n');
}

// ============================================================================
// Verification Functions
// ============================================================================

/**
 * Check if instrument exists
 */
async function checkInstrumentExists(
  contract: any,
  instrumentId: string
): Promise<VerificationCheckResult> {
  console.log('   Checking if instrument exists...');

  const [exists, recordedAt, recordedBlock, issuer] =
    await contract.instrumentExists(instrumentId);

  console.log(`   Result: ${exists ? '✓ EXISTS' : '✗ NOT FOUND'}`);

  return {
    instrumentExists: exists,
    recordedAt: exists ? recordedAt : undefined,
    recordedBlock: exists ? recordedBlock : undefined,
    issuer: exists ? issuer : undefined,
  };
}

/**
 * Check if issuer is authorized
 */
async function checkIssuerAuthorized(
  contract: any,
  instrumentId: string
): Promise<IssuerCheckResult> {
  console.log('   Checking if issuer is authorized...');

  const [authorized, issuerAddress, issuerName, issuerEmail] =
    await contract.issuerAuthorized(instrumentId);

  console.log(`   Result: ${authorized ? '✓ AUTHORIZED' : '✗ NOT AUTHORIZED'}`);

  return {
    issuerAuthorized: authorized,
    issuerAddress: authorized ? issuerAddress : undefined,
    issuerName: authorized ? issuerName : undefined,
    issuerEmail: authorized ? issuerEmail : undefined,
  };
}

/**
 * Check if document hash matches
 */
async function checkDocumentHashMatches(
  contract: any,
  instrumentId: string,
  expectedHash: string
): Promise<HashCheckResult> {
  console.log('   Checking if document hash matches...');

  const [matches, actualHash] = await contract.documentHashMatches(
    instrumentId,
    expectedHash
  );

  console.log(`   Result: ${matches ? '✓ MATCHES' : '✗ DOES NOT MATCH'}`);

  return {
    hashMatches: matches,
    expectedHash: expectedHash,
    actualHash: actualHash,
  };
}

/**
 * Perform comprehensive verification
 */
async function performComprehensiveVerification(
  contract: any,
  instrumentId: string,
  expectedHash: string
): Promise<ComprehensiveVerificationResult> {
  console.log('   Performing comprehensive verification...');

  const [
    instrumentExists_,
    issuerAuthorized_,
    documentHashMatches_,
    verificationTimestamp,
    verificationBlock,
  ] = await contract.verifyInstrument(instrumentId, expectedHash);

  console.log('   Comprehensive verification complete ✓');

  return {
    instrumentExists: instrumentExists_,
    issuerAuthorized: issuerAuthorized_,
    documentHashMatches: documentHashMatches_,
    verificationTimestamp: verificationTimestamp,
    verificationBlock: verificationBlock,
  };
}

// ============================================================================
// Main Verification Function
// ============================================================================

/**
 * Main verification process
 */
async function verifyInstrument(): Promise<VerificationResult> {
  console.log('🔍 Starting Instrument Verification Process...\n');

  try {
    // ====================================================================
    // Step 1: Get Signer
    // ====================================================================

    console.log('📝 Step 1: Getting signer...');
    const [signer] = await ethers.getSigners();
    console.log(`   Signer address: ${signer.address}\n`);

    // ====================================================================
    // Step 2: Get Network Information
    // ====================================================================

    console.log('📡 Step 2: Getting network information...');
    const network = await ethers.provider.getNetwork();
    console.log(`   Network: ${network.name}`);
    console.log(`   Chain ID: ${network.chainId}`);

    const blockNumber = await ethers.provider.getBlockNumber();
    console.log(`   Current block: ${blockNumber}\n`);

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
    // Step 4: Get Instrument ID and Document Hash
    // ====================================================================

    console.log('📋 Step 4: Getting instrument ID and document hash...');
    const instrumentId = getInstrumentId();
    console.log(`   Instrument ID: ${instrumentId}`);

    const expectedHash = createDocumentHashFromFile();
    console.log(`   Document hash: ${expectedHash}\n`);

    // ====================================================================
    // Step 5: Perform Individual Checks
    // ====================================================================

    console.log('🔍 Step 5: Performing individual verification checks...\n');

    console.log('   Check 1: Instrument Exists');
    const instrumentExistsResult = await retryWithBackoff(() =>
      checkInstrumentExists(contract, instrumentId)
    );

    console.log('\n   Check 2: Issuer Authorized');
    const issuerAuthorizedResult = await retryWithBackoff(() =>
      checkIssuerAuthorized(contract, instrumentId)
    );

    console.log('\n   Check 3: Document Hash Matches');
    const hashMatchesResult = await retryWithBackoff(() =>
      checkDocumentHashMatches(contract, instrumentId, expectedHash)
    );

    console.log('\n');

    // ====================================================================
    // Step 6: Perform Comprehensive Verification
    // ====================================================================

    console.log('🔍 Step 6: Performing comprehensive verification...\n');

    const comprehensiveResult = await retryWithBackoff(() =>
      performComprehensiveVerification(contract, instrumentId, expectedHash)
    );

    console.log('\n');

    // ====================================================================
    // Step 7: Determine Overall Verification Status
    // ====================================================================

    console.log('📊 Step 7: Determining overall verification status...');

    const verified =
      instrumentExistsResult.instrumentExists &&
      issuerAuthorizedResult.issuerAuthorized &&
      hashMatchesResult.hashMatches &&
      comprehensiveResult.instrumentExists &&
      comprehensiveResult.issuerAuthorized &&
      comprehensiveResult.documentHashMatches;

    console.log(`   Overall Status: ${verified ? '✓ VERIFIED' : '✗ NOT VERIFIED'}\n`);

    // ====================================================================
    // Step 8: Get Current Block Details
    // ====================================================================

    console.log('⛓️  Step 8: Getting current block details...');

    const currentBlock = await ethers.provider.getBlock('latest');
    if (!currentBlock) {
      throw new Error('Could not get current block');
    }

    console.log(`   Current block: ${currentBlock.number}`);
    console.log(`   Timestamp: ${new Date(currentBlock.timestamp * 1000).toISOString()}\n`);

    // ====================================================================
    // Step 9: Save Verification Result
    // ====================================================================

    console.log('💾 Step 9: Saving verification result...');

    const explorerUrl =
      (process.env.BESU_EXPLORER_URL || 'http://localhost:4000') +
      `/address/${contractAddress}`;

    const result: VerificationResult = {
      success: true,
      instrumentId: instrumentId,
      verified: verified,
      checks: {
        instrumentExists: instrumentExistsResult,
        issuerAuthorized: issuerAuthorizedResult,
        hashMatches: hashMatchesResult,
      },
      comprehensiveResult: comprehensiveResult,
      blockchainDetails: {
        transactionHash: '0x' + 'a'.repeat(64), // Placeholder
        blockNumber: currentBlock.number,
        timestamp: new Date(currentBlock.timestamp * 1000).toISOString(),
        contractAddress: contractAddress,
        explorerUrl: explorerUrl,
      },
      timestamp: new Date().toISOString(),
    };

    saveVerificationResult(result);

    // ====================================================================
    // Display Summary
    // ====================================================================

    displaySummary(result);

    return result;
  } catch (error) {
    console.error('\n❌ Verification failed:', error);

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

export default verifyInstrument;

// Execute if run directly
if (require.main === module) {
  verifyInstrument()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}
