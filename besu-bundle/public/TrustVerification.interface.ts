/**
 * TrustVerification Smart Contract Interface
 * 
 * TypeScript interface and types for interacting with the TrustVerification
 * smart contract on Hyperledger Besu.
 * 
 * This file provides type-safe access to all contract functions, events,
 * and data structures.
 */

import { Contract, ContractInterface, Signer } from 'ethers';

// ============================================================================
// Data Structures
// ============================================================================

/**
 * Instrument - Represents a trust record on the blockchain
 */
export interface Instrument {
  instrumentId: string;
  issuer: string;
  amount: bigint;
  maturityDate: bigint;
  beneficiary: string;
  documentHash: string;
  recordedAt: bigint;
  recordedBlock: bigint;
  isRevoked: boolean;
}

/**
 * Payment - Represents a payment recorded on the blockchain
 */
export interface Payment {
  amount: bigint;
  timestamp: bigint;
  reference: string;
  method: string;
  notes: string;
}

/**
 * VerificationResult - Result of verifying an instrument
 */
export interface VerificationResult {
  instrumentExists: boolean;
  issuerAuthorized: boolean;
  documentHashMatches: boolean;
  verificationTimestamp: bigint;
  verificationBlock: bigint;
}

/**
 * InstrumentExistsResult - Result of checking if instrument exists
 */
export interface InstrumentExistsResult {
  exists: boolean;
  recordedAt: bigint;
  recordedBlock: bigint;
  issuer: string;
}

/**
 * IssuerAuthorizedResult - Result of checking issuer authorization
 */
export interface IssuerAuthorizedResult {
  authorized: boolean;
  issuerAddress: string;
  issuerName: string;
}

/**
 * DocumentHashMatchesResult - Result of checking document hash
 */
export interface DocumentHashMatchesResult {
  matches: boolean;
  storedHash: string;
  providedHash: string;
}

// ============================================================================
// Events
// ============================================================================

/**
 * InstrumentRecorded Event
 */
export interface InstrumentRecordedEvent {
  instrumentId: string;
  issuer: string;
  amount: bigint;
  timestamp: bigint;
}

/**
 * InstrumentRevoked Event
 */
export interface InstrumentRevokedEvent {
  instrumentId: string;
  timestamp: bigint;
}

/**
 * PaymentRecorded Event
 */
export interface PaymentRecordedEvent {
  instrumentId: string;
  amount: bigint;
  timestamp: bigint;
}

/**
 * IssuerAuthorized Event
 */
export interface IssuerAuthorizedEvent {
  issuer: string;
  timestamp: bigint;
}

// ============================================================================
// Smart Contract Interface
// ============================================================================

/**
 * TrustVerification Contract Interface
 * 
 * Main interface for interacting with the TrustVerification smart contract.
 * Provides type-safe access to all contract functions.
 */
export interface ITrustVerification extends Contract {
  // ========================================================================
  // Issuer Management Functions
  // ========================================================================

  /**
   * Authorize an issuer to record instruments
   * @param issuer - Address of the issuer to authorize
   */
  authorizeIssuer(issuer: string): Promise<any>;

  /**
   * Revoke an issuer's authorization
   * @param issuer - Address of the issuer to revoke
   */
  revokeIssuer(issuer: string): Promise<any>;

  /**
   * Check if an issuer is authorized
   * @param issuer - Address of the issuer to check
   * @returns True if issuer is authorized
   */
  isIssuerAuthorized(issuer: string): Promise<boolean>;

  // ========================================================================
  // Instrument Recording Functions
  // ========================================================================

  /**
   * Record a new instrument (trust record) on the blockchain
   * @param instrumentId - Unique identifier for the instrument
   * @param amount - Amount of the instrument
   * @param maturityDate - Unix timestamp of maturity date
   * @param beneficiary - Name or ID of beneficiary
   * @param documentHash - SHA256 hash of the document
   */
  recordInstrument(
    instrumentId: string,
    amount: bigint,
    maturityDate: bigint,
    beneficiary: string,
    documentHash: string
  ): Promise<any>;

  /**
   * Revoke an instrument
   * @param instrumentId - ID of instrument to revoke
   */
  revokeInstrument(instrumentId: string): Promise<any>;

  // ========================================================================
  // Instrument Verification Functions
  // ========================================================================

  /**
   * Verify an instrument with all checks
   * @param instrumentId - ID of instrument to verify
   * @param documentHash - SHA256 hash of the document
   * @returns VerificationResult with all checks
   */
  verifyInstrument(
    instrumentId: string,
    documentHash: string
  ): Promise<[boolean, boolean, boolean, bigint, bigint]>;

  /**
   * Check if an instrument exists
   * @param instrumentId - ID of instrument to check
   * @returns InstrumentExistsResult
   */
  instrumentExists(
    instrumentId: string
  ): Promise<[boolean, bigint, bigint, string]>;

  /**
   * Check if issuer is authorized for an instrument
   * @param instrumentId - ID of instrument
   * @returns IssuerAuthorizedResult
   */
  issuerAuthorized(
    instrumentId: string
  ): Promise<[boolean, string, string]>;

  /**
   * Check if document hash matches
   * @param instrumentId - ID of instrument
   * @param documentHash - SHA256 hash of the document
   * @returns DocumentHashMatchesResult
   */
  documentHashMatches(
    instrumentId: string,
    documentHash: string
  ): Promise<[boolean, string, string]>;

  // ========================================================================
  // Instrument Query Functions
  // ========================================================================

  /**
   * Get complete instrument details
   * @param instrumentId - ID of instrument
   * @returns Instrument object
   */
  getInstrument(instrumentId: string): Promise<Instrument>;

  /**
   * Get total count of recorded instruments
   * @returns Number of instruments
   */
  getInstrumentCount(): Promise<bigint>;

  // ========================================================================
  // Payment Recording Functions
  // ========================================================================

  /**
   * Record a payment for an instrument
   * @param instrumentId - ID of instrument
   * @param amount - Payment amount
   * @param timestamp - Unix timestamp of payment
   * @param reference - Payment reference number
   * @param method - Payment method (e.g., "bank_transfer")
   * @param notes - Additional notes
   */
  recordPayment(
    instrumentId: string,
    amount: bigint,
    timestamp: bigint,
    reference: string,
    method: string,
    notes: string
  ): Promise<any>;

  // ========================================================================
  // Payment Query Functions
  // ========================================================================

  /**
   * Get all payments for an instrument
   * @param instrumentId - ID of instrument
   * @returns Array of Payment objects
   */
  getPaymentHistory(instrumentId: string): Promise<Payment[]>;

  /**
   * Get count of payments for an instrument
   * @param instrumentId - ID of instrument
   * @returns Number of payments
   */
  getPaymentCount(instrumentId: string): Promise<bigint>;

  /**
   * Get specific payment by index
   * @param instrumentId - ID of instrument
   * @param index - Payment index
   * @returns Payment object
   */
  getPaymentByIndex(
    instrumentId: string,
    index: bigint
  ): Promise<Payment>;

  // ========================================================================
  // Statistics Functions
  // ========================================================================

  /**
   * Get total count of authorized issuers
   * @returns Number of authorized issuers
   */
  getAuthorizedIssuerCount(): Promise<bigint>;

  /**
   * Get owner of the contract
   * @returns Owner address
   */
  owner(): Promise<string>;
}

// ============================================================================
// Contract Factory
// ============================================================================

/**
 * Create a TrustVerification contract instance
 * @param address - Contract address
 * @param abi - Contract ABI
 * @param signer - Signer for transactions
 * @returns Contract instance
 */
export function createTrustVerificationContract(
  address: string,
  abi: ContractInterface,
  signer: Signer
): ITrustVerification {
  return new Contract(address, abi, signer) as unknown as ITrustVerification;
}

// ============================================================================
// Helper Types
// ============================================================================

/**
 * Transaction options
 */
export interface TransactionOptions {
  gasLimit?: bigint;
  gasPrice?: bigint;
  value?: bigint;
  nonce?: number;
}

/**
 * Deployment options
 */
export interface DeploymentOptions {
  gasLimit?: bigint;
  gasPrice?: bigint;
  value?: bigint;
}

/**
 * Contract deployment result
 */
export interface DeploymentResult {
  address: string;
  transactionHash: string;
  blockNumber: number;
  gasUsed: bigint;
}

/**
 * Verification options
 */
export interface VerificationOptions {
  includePayments?: boolean;
  includeEvents?: boolean;
  blockRange?: {
    from: number;
    to: number;
  };
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Contract error
 */
export class ContractError extends Error {
  constructor(
    public code: string,
    public message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ContractError';
  }
}

/**
 * Verification error
 */
export class VerificationError extends Error {
  constructor(
    public instrumentId: string,
    public message: string,
    public failedChecks?: string[]
  ) {
    super(message);
    this.name = 'VerificationError';
  }
}

/**
 * Authorization error
 */
export class AuthorizationError extends Error {
  constructor(
    public issuer: string,
    public message: string
  ) {
    super(message);
    this.name = 'AuthorizationError';
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Convert bytes32 to hex string
 * @param bytes32 - Bytes32 value
 * @returns Hex string
 */
export function bytes32ToHex(bytes32: string): string {
  return '0x' + bytes32.substring(2).padStart(64, '0');
}

/**
 * Convert hex string to bytes32
 * @param hex - Hex string
 * @returns Bytes32 value
 */
export function hexToBytes32(hex: string): string {
  return '0x' + hex.substring(2).padStart(64, '0');
}

/**
 * Create SHA256 hash of data
 * @param data - Data to hash
 * @returns SHA256 hash as hex string
 */
export async function createDocumentHash(data: string): Promise<string> {
  const crypto = await import('crypto');
  return '0x' + crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Verify document hash
 * @param data - Original data
 * @param hash - Hash to verify
 * @returns True if hash matches
 */
export async function verifyDocumentHash(
  data: string,
  hash: string
): Promise<boolean> {
  const computedHash = await createDocumentHash(data);
  return computedHash.toLowerCase() === hash.toLowerCase();
}

/**
 * Format instrument for display
 * @param instrument - Instrument to format
 * @returns Formatted string
 */
export function formatInstrument(instrument: Instrument): string {
  return `
Instrument: ${instrument.instrumentId}
Issuer: ${instrument.issuer}
Amount: ${instrument.amount.toString()}
Maturity: ${new Date(Number(instrument.maturityDate) * 1000).toISOString()}
Beneficiary: ${instrument.beneficiary}
Recorded: ${new Date(Number(instrument.recordedAt) * 1000).toISOString()}
Block: ${instrument.recordedBlock.toString()}
Revoked: ${instrument.isRevoked ? 'Yes' : 'No'}
  `.trim();
}

/**
 * Format payment for display
 * @param payment - Payment to format
 * @returns Formatted string
 */
export function formatPayment(payment: Payment): string {
  return `
Amount: ${payment.amount.toString()}
Date: ${new Date(Number(payment.timestamp) * 1000).toISOString()}
Reference: ${payment.reference}
Method: ${payment.method}
Notes: ${payment.notes}
  `.trim();
}

/**
 * Format verification result for display
 * @param result - Verification result
 * @returns Formatted string
 */
export function formatVerificationResult(result: VerificationResult): string {
  return `
Instrument Exists: ${result.instrumentExists ? '✓' : '✗'}
Issuer Authorized: ${result.issuerAuthorized ? '✓' : '✗'}
Document Hash Matches: ${result.documentHashMatches ? '✓' : '✗'}
Verification Time: ${new Date(Number(result.verificationTimestamp) * 1000).toISOString()}
Block: ${result.verificationBlock.toString()}
  `.trim();
}
