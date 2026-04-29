/**
 * Certificate Types
 * 
 * Comprehensive TypeScript interfaces for certificate data and digital signatures.
 * Used throughout the certificate generation, signing, and export workflow.
 */

// ============================================================================
// Trust Record Types
// ============================================================================

/**
 * Trust record as stored in database
 */
export interface TrustRecord {
  id: string;
  userId: string;
  name: string;
  amount: string;
  beneficiary: string;
  createdAt: Date;
  maturityDate: Date;
  terms: string;
  blockchainStatus: BlockchainStatus;
  transactionHash: string | null;
  blockNumber: number | null;
  contractAddress: string | null;
  verificationTimestamp: Date | null;
  isVerified: boolean;
}

/**
 * Blockchain verification status
 */
export type BlockchainStatus = 'pending' | 'syncing' | 'verified' | 'failed' | 'not_recorded';

// ============================================================================
// Blockchain Verification Types
// ============================================================================

/**
 * Blockchain verification details for a trust record
 */
export interface BlockchainVerification {
  transactionHash: string;
  blockNumber: number;
  verificationTimestamp: Date;
  explorerUrl: string;
  chainId?: number;
  gasUsed?: string;
  contractAddress?: string;
}

/**
 * Network status information
 */
export interface BlockchainNetworkStatus {
  connected: boolean;
  chainId?: number;
  blockNumber?: number;
  gasPrice?: string;
  rpcUrl?: string;
  error?: string;
  lastUpdated?: Date;
}

// ============================================================================
// Certificate Data Types
// ============================================================================

/**
 * Issuer information for certificate
 */
export interface CertificateIssuer {
  name: string;
  email: string;
  address: string;
  organization?: string;
  title?: string;
  phone?: string;
}

/**
 * Certificate metadata
 */
export interface CertificateMetadata {
  certificateId: string;
  trustId: string;
  trustName: string;
  generatedAt: Date;
  expiresAt?: Date;
  version: string;
  format: 'pdf' | 'json';
  hash: string;
  size?: number;
}

/**
 * Complete certificate data for PDF generation
 */
export interface CertificateData {
  // Trust information
  trustId: string;
  trustName: string;
  amount: string;
  beneficiary: string;
  maturityDate: Date;
  terms: string;

  // Blockchain verification
  blockchainVerification: BlockchainVerification;

  // Issuer information
  issuerName: string;
  issuerAddress: string;
  issuerEmail: string;
  issuer?: CertificateIssuer;

  // Additional metadata
  metadata?: CertificateMetadata;
  createdAt?: Date;
  locale?: string;
}

/**
 * Certificate content for PDF rendering
 */
export interface CertificateContent {
  title: string;
  subtitle: string;
  sections: CertificateSection[];
  footer: CertificateFooter;
  styling: CertificateStyling;
}

/**
 * Certificate section
 */
export interface CertificateSection {
  title: string;
  content: CertificateSectionContent[];
  type: 'details' | 'verification' | 'terms' | 'custom';
}

/**
 * Certificate section content
 */
export interface CertificateSectionContent {
  label: string;
  value: string | number | Date;
  type?: 'text' | 'number' | 'date' | 'address' | 'hash';
  highlighted?: boolean;
}

/**
 * Certificate footer
 */
export interface CertificateFooter {
  issuerName: string;
  issuerEmail: string;
  issuerSignature?: string;
  generatedDate: Date;
  certificateId: string;
}

/**
 * Certificate styling
 */
export interface CertificateStyling {
  backgroundColor?: string;
  borderColor?: string;
  textColor?: string;
  accentColor?: string;
  font?: string;
  fontSize?: number;
  logoUrl?: string;
  theme?: 'light' | 'dark' | 'professional' | 'modern';
}

// ============================================================================
// Digital Signature Types
// ============================================================================

/**
 * Signature algorithm type
 */
export type SignatureAlgorithm =
  | 'RSA-SHA256'
  | 'RSA-SHA384'
  | 'RSA-SHA512'
  | 'ECDSA-SHA256'
  | 'ECDSA-SHA384'
  | 'ECDSA-SHA512';

/**
 * Digital signature
 */
export interface DigitalSignature {
  // Signature data
  signature: string; // Base64 encoded signature
  publicKey: string; // Base64 encoded public key
  algorithm: SignatureAlgorithm;

  // Signature metadata
  timestamp: Date;
  isValid: boolean;
  expiresAt?: Date;

  // Signer information
  signerName?: string;
  signerEmail?: string;
  signerAddress?: string;

  // Verification
  verificationStatus?: 'valid' | 'invalid' | 'expired' | 'unknown';
  verificationMessage?: string;
}

/**
 * Signature verification result
 */
export interface SignatureVerificationResult {
  isValid: boolean;
  algorithm: SignatureAlgorithm;
  timestamp: Date;
  message: string;
  details?: {
    signatureMatch: boolean;
    timestampValid: boolean;
    publicKeyValid: boolean;
    notExpired: boolean;
  };
}

/**
 * Cryptographic key pair
 */
export interface KeyPair {
  privateKey: string; // PEM format
  publicKey: string; // PEM format
  algorithm: SignatureAlgorithm;
  keySize: number; // bits
  createdAt: Date;
  expiresAt?: Date;
}

/**
 * Key management metadata
 */
export interface KeyMetadata {
  keyId: string;
  algorithm: SignatureAlgorithm;
  keySize: number;
  createdAt: Date;
  expiresAt?: Date;
  isActive: boolean;
  rotationSchedule?: string;
  lastRotatedAt?: Date;
}

// ============================================================================
// Signed Certificate Types
// ============================================================================

/**
 * Complete signed certificate
 */
export interface SignedCertificate {
  // Certificate identification
  certificateId: string;
  trustId: string;

  // Certificate content
  pdfBuffer: Buffer;
  pdfBase64?: string;

  // Signature
  signature: DigitalSignature;

  // Verification
  hash: string; // SHA256 hash of PDF
  verificationHash?: string;

  // Metadata
  createdAt: Date;
  expiresAt?: Date;
  format: 'pdf' | 'json';
  size: number;
}

/**
 * Certificate export response
 */
export interface CertificateExportResponse {
  success: boolean;
  certificateId: string;
  format: 'pdf' | 'json';
  pdfBase64?: string;
  filename?: string;
  certificate?: object;
  signature?: {
    signature: string;
    algorithm: SignatureAlgorithm;
    timestamp: Date;
  };
  metadata: {
    trustId: string;
    trustName: string;
    amount: string;
    transactionHash: string;
    blockNumber: number;
    verifiedAt: Date;
  };
  downloadUrl?: string;
  error?: string;
}

/**
 * Certificate verification response
 */
export interface CertificateVerificationResponse {
  success: boolean;
  isValid: boolean;
  certificateId: string;
  hash: string;
  message: string;
  details?: {
    signatureValid: boolean;
    hashMatch: boolean;
    timestampValid: boolean;
    notExpired: boolean;
  };
  verifiedAt?: Date;
  error?: string;
}

// ============================================================================
// Certificate Request/Response Types
// ============================================================================

/**
 * Request to export certificate
 */
export interface ExportCertificateRequest {
  trustId: string;
  format: 'pdf' | 'json';
  includeSignature: boolean;
  includeMetadata?: boolean;
  locale?: string;
}

/**
 * Request to verify certificate
 */
export interface VerifyCertificateRequest {
  certificateId: string;
  pdfBase64?: string;
  metadataJson?: string;
  verifySignature?: boolean;
}

/**
 * Request to batch export certificates
 */
export interface BatchExportCertificatesRequest {
  trustIds: string[];
  format: 'pdf' | 'json';
  includeSignature?: boolean;
}

/**
 * Response for batch export
 */
export interface BatchExportCertificatesResponse {
  success: boolean;
  total: number;
  exported: number;
  failed: number;
  results: Array<{
    trustId: string;
    certificateId: string;
    success: boolean;
    filename: string;
    downloadUrl?: string;
  }>;
  errors?: Array<{
    trustId: string;
    error: string;
  }>;
}

// ============================================================================
// Certificate Storage Types
// ============================================================================

/**
 * Certificate stored in database
 */
export interface StoredCertificate {
  id: string;
  certificateId: string;
  trustId: string;
  userId: string;
  format: 'pdf' | 'json';
  hash: string;
  size: number;
  signatureHash: string;
  signatureAlgorithm: SignatureAlgorithm;
  createdAt: Date;
  expiresAt?: Date;
  downloadCount: number;
  lastDownloadedAt?: Date;
  isActive: boolean;
}

/**
 * Certificate audit log entry
 */
export interface CertificateAuditLog {
  id: string;
  certificateId: string;
  trustId: string;
  userId: string;
  action: 'created' | 'exported' | 'verified' | 'downloaded' | 'revoked';
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
  details?: Record<string, any>;
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Certificate error
 */
export interface CertificateError {
  code: string;
  message: string;
  details?: Record<string, any>;
  timestamp: Date;
}

/**
 * Signature error
 */
export interface SignatureError {
  code: string;
  message: string;
  reason: 'invalid_signature' | 'expired' | 'key_not_found' | 'algorithm_mismatch';
  timestamp: Date;
}

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Certificate service configuration
 */
export interface CertificateServiceConfig {
  // Key configuration
  privateKeyPath: string;
  publicKeyPath: string;
  keyRotationInterval?: number; // days

  // Issuer configuration
  issuerName: string;
  issuerEmail: string;
  issuerAddress: string;
  issuerOrganization?: string;

  // Certificate configuration
  certificateExpirationDays?: number;
  maxCertificateSize?: number; // bytes
  supportedFormats: ('pdf' | 'json')[];

  // Signing configuration
  signatureAlgorithm: SignatureAlgorithm;
  timestampServerUrl?: string;

  // Storage configuration
  storagePath?: string;
  enableCaching?: boolean;
  cacheExpiration?: number; // seconds

  // Security configuration
  enableAuditLogging?: boolean;
  requireSignatureVerification?: boolean;
  enableRateLimiting?: boolean;
  rateLimitPerMinute?: number;
}

/**
 * PDF generation configuration
 */
export interface PDFGenerationConfig {
  pageSize: 'letter' | 'a4';
  margins: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  styling: CertificateStyling;
  includeQRCode?: boolean;
  includeBarcode?: boolean;
  watermark?: string;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Generic result type
 */
export interface Result<T> {
  success: boolean;
  data?: T;
  error?: CertificateError;
}

/**
 * Paginated results
 */
export interface PaginatedResults<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

/**
 * Certificate statistics
 */
export interface CertificateStatistics {
  totalCertificates: number;
  totalExported: number;
  totalVerified: number;
  averageSize: number;
  mostCommonFormat: 'pdf' | 'json';
  signatureAlgorithmUsage: Record<SignatureAlgorithm, number>;
  createdAt: Date;
  period: 'daily' | 'weekly' | 'monthly' | 'yearly';
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard for CertificateData
 */
export function isCertificateData(obj: any): obj is CertificateData {
  return (
    obj &&
    typeof obj.trustId === 'string' &&
    typeof obj.trustName === 'string' &&
    typeof obj.amount === 'string' &&
    obj.blockchainVerification &&
    typeof obj.issuerName === 'string'
  );
}

/**
 * Type guard for DigitalSignature
 */
export function isDigitalSignature(obj: any): obj is DigitalSignature {
  return (
    obj &&
    typeof obj.signature === 'string' &&
    typeof obj.publicKey === 'string' &&
    typeof obj.algorithm === 'string' &&
    obj.timestamp instanceof Date &&
    typeof obj.isValid === 'boolean'
  );
}

/**
 * Type guard for SignedCertificate
 */
export function isSignedCertificate(obj: any): obj is SignedCertificate {
  return (
    obj &&
    typeof obj.certificateId === 'string' &&
    obj.pdfBuffer instanceof Buffer &&
    isDigitalSignature(obj.signature) &&
    typeof obj.hash === 'string'
  );
}

/**
 * Type guard for BlockchainStatus
 */
export function isBlockchainStatus(value: any): value is BlockchainStatus {
  return ['pending', 'syncing', 'verified', 'failed', 'not_recorded'].includes(value);
}

/**
 * Type guard for SignatureAlgorithm
 */
export function isSignatureAlgorithm(value: any): value is SignatureAlgorithm {
  return [
    'RSA-SHA256',
    'RSA-SHA384',
    'RSA-SHA512',
    'ECDSA-SHA256',
    'ECDSA-SHA384',
    'ECDSA-SHA512',
  ].includes(value);
}

export default {
  isCertificateData,
  isDigitalSignature,
  isSignedCertificate,
  isBlockchainStatus,
  isSignatureAlgorithm,
};
