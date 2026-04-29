/**
 * Certificate Signing Service
 * 
 * Generates blockchain-verified PDF certificates with digital signatures.
 * Handles PDF generation, digital signing, and certificate management.
 */

import { PDFDocument, PDFPage, rgb, degrees } from 'pdf-lib';
import { createHash, createSign, createVerify } from 'crypto';
import fs from 'fs/promises';
import path from 'path';

// ============================================================================
// Types
// ============================================================================

export interface CertificateData {
  trustId: string;
  trustName: string;
  amount: string;
  beneficiary: string;
  maturityDate: Date;
  terms: string;
  blockchainVerification: {
    transactionHash: string;
    blockNumber: number;
    verificationTimestamp: Date;
    explorerUrl: string;
  };
  issuerName: string;
  issuerAddress: string;
  issuerEmail: string;
}

export interface DigitalSignature {
  signature: string; // Base64 encoded signature
  publicKey: string; // Base64 encoded public key
  algorithm: string; // e.g., 'RSA-SHA256'
  timestamp: Date;
  isValid: boolean;
}

export interface SignedCertificate {
  certificateId: string;
  pdfBuffer: Buffer;
  signature: DigitalSignature;
  hash: string; // SHA256 hash of PDF
  createdAt: Date;
}

// ============================================================================
// Certificate Signing Service
// ============================================================================

export class CertificateSigningService {
  private privateKey: string;
  private publicKey: string;
  private issuerName: string;
  private issuerEmail: string;

  constructor(
    privateKeyPath: string,
    publicKeyPath: string,
    issuerName: string,
    issuerEmail: string
  ) {
    this.privateKey = '';
    this.publicKey = '';
    this.issuerName = issuerName;
    this.issuerEmail = issuerEmail;

    // Load keys synchronously in constructor
    try {
      this.privateKey = require('fs').readFileSync(privateKeyPath, 'utf8');
      this.publicKey = require('fs').readFileSync(publicKeyPath, 'utf8');
    } catch (error) {
      console.warn('Certificate keys not loaded. Using test mode.');
    }
  }

  /**
   * Generate a PDF certificate
   */
  async generateCertificate(data: CertificateData): Promise<Buffer> {
    try {
      // Create PDF document
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([612, 792]); // Letter size

      // Draw certificate background
      this.drawCertificateBackground(page);

      // Draw certificate content
      this.drawCertificateContent(page, data);

      // Draw blockchain verification section
      this.drawBlockchainVerification(page, data);

      // Draw footer
      this.drawFooter(page, data);

      // Save to buffer
      const pdfBytes = await pdfDoc.save();
      return Buffer.from(pdfBytes);
    } catch (error) {
      throw new Error(`Failed to generate certificate: ${error}`);
    }
  }

  /**
   * Sign a certificate
   */
  async signCertificate(pdfBuffer: Buffer): Promise<DigitalSignature> {
    try {
      // Calculate hash of PDF
      const hash = createHash('sha256').update(pdfBuffer).digest('hex');

      // Sign the hash
      const signer = createSign('RSA-SHA256');
      signer.update(pdfBuffer);
      const signature = signer.sign(this.privateKey, 'base64');

      return {
        signature,
        publicKey: this.publicKey,
        algorithm: 'RSA-SHA256',
        timestamp: new Date(),
        isValid: true,
      };
    } catch (error) {
      throw new Error(`Failed to sign certificate: ${error}`);
    }
  }

  /**
   * Verify a certificate signature
   */
  verifySignature(pdfBuffer: Buffer, signature: DigitalSignature): boolean {
    try {
      const verifier = createVerify('RSA-SHA256');
      verifier.update(pdfBuffer);

      return verifier.verify(signature.publicKey, signature.signature, 'base64');
    } catch (error) {
      console.error('Signature verification failed:', error);
      return false;
    }
  }

  /**
   * Create a signed certificate
   */
  async createSignedCertificate(
    data: CertificateData
  ): Promise<SignedCertificate> {
    try {
      // Generate PDF
      const pdfBuffer = await this.generateCertificate(data);

      // Sign PDF
      const signature = await this.signCertificate(pdfBuffer);

      // Calculate hash
      const hash = createHash('sha256').update(pdfBuffer).digest('hex');

      // Create certificate ID
      const certificateId = `CERT-${data.trustId}-${Date.now()}`;

      return {
        certificateId,
        pdfBuffer,
        signature,
        hash,
        createdAt: new Date(),
      };
    } catch (error) {
      throw new Error(`Failed to create signed certificate: ${error}`);
    }
  }

  /**
   * Export signed certificate to file
   */
  async exportCertificate(
    signedCertificate: SignedCertificate,
    outputPath: string
  ): Promise<string> {
    try {
      // Save PDF
      const pdfPath = `${outputPath}.pdf`;
      await fs.writeFile(pdfPath, signedCertificate.pdfBuffer);

      // Save signature metadata
      const metadataPath = `${outputPath}.json`;
      const metadata = {
        certificateId: signedCertificate.certificateId,
        hash: signedCertificate.hash,
        signature: signedCertificate.signature.signature,
        algorithm: signedCertificate.signature.algorithm,
        timestamp: signedCertificate.signature.timestamp,
        createdAt: signedCertificate.createdAt,
      };

      await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));

      return pdfPath;
    } catch (error) {
      throw new Error(`Failed to export certificate: ${error}`);
    }
  }

  /**
   * Load and verify a certificate
   */
  async loadAndVerifyCertificate(
    pdfPath: string,
    metadataPath: string
  ): Promise<{
    isValid: boolean;
    certificateId: string;
    hash: string;
    message: string;
  }> {
    try {
      // Load PDF
      const pdfBuffer = await fs.readFile(pdfPath);

      // Load metadata
      const metadataContent = await fs.readFile(metadataPath, 'utf8');
      const metadata = JSON.parse(metadataContent);

      // Verify signature
      const signature: DigitalSignature = {
        signature: metadata.signature,
        publicKey: this.publicKey,
        algorithm: metadata.algorithm,
        timestamp: new Date(metadata.timestamp),
        isValid: true,
      };

      const isValid = this.verifySignature(pdfBuffer, signature);

      return {
        isValid,
        certificateId: metadata.certificateId,
        hash: metadata.hash,
        message: isValid
          ? 'Certificate signature is valid'
          : 'Certificate signature is invalid',
      };
    } catch (error) {
      throw new Error(`Failed to verify certificate: ${error}`);
    }
  }

  // ========================================================================
  // Private Drawing Methods
  // ========================================================================

  /**
   * Draw certificate background
   */
  private drawCertificateBackground(page: PDFPage): void {
    const { width, height } = page.getSize();

    // Border
    page.drawRectangle({
      x: 20,
      y: 20,
      width: width - 40,
      height: height - 40,
      borderColor: rgb(0.2, 0.4, 0.8),
      borderWidth: 3,
    });

    // Inner border
    page.drawRectangle({
      x: 30,
      y: 30,
      width: width - 60,
      height: height - 60,
      borderColor: rgb(0.2, 0.4, 0.8),
      borderWidth: 1,
    });

    // Decorative top bar
    page.drawRectangle({
      x: 30,
      y: height - 80,
      width: width - 60,
      height: 50,
      color: rgb(0.2, 0.4, 0.8),
    });
  }

  /**
   * Draw certificate content
   */
  private drawCertificateContent(page: PDFPage, data: CertificateData): void {
    const { width, height } = page.getSize();
    const centerX = width / 2;

    // Title
    page.drawText('TRUST VERIFICATION CERTIFICATE', {
      x: centerX - 150,
      y: height - 65,
      size: 24,
      color: rgb(1, 1, 1),
      font: undefined,
    });

    // Subtitle
    page.drawText('Blockchain-Verified Legal Document', {
      x: centerX - 120,
      y: height - 95,
      size: 12,
      color: rgb(0.5, 0.5, 0.5),
    });

    // Certificate ID
    page.drawText(`Certificate ID: ${data.trustId}`, {
      x: 50,
      y: height - 140,
      size: 10,
      color: rgb(0.3, 0.3, 0.3),
    });

    // Trust Details Section
    let yPosition = height - 180;
    const lineHeight = 25;

    page.drawText('TRUST DETAILS', {
      x: 50,
      y: yPosition,
      size: 12,
      color: rgb(0.2, 0.4, 0.8),
    });

    yPosition -= lineHeight;
    page.drawText(`Trust Name: ${data.trustName}`, {
      x: 70,
      y: yPosition,
      size: 11,
      color: rgb(0, 0, 0),
    });

    yPosition -= lineHeight;
    page.drawText(`Amount: $${data.amount}`, {
      x: 70,
      y: yPosition,
      size: 11,
      color: rgb(0, 0, 0),
    });

    yPosition -= lineHeight;
    page.drawText(`Beneficiary: ${data.beneficiary}`, {
      x: 70,
      y: yPosition,
      size: 10,
      color: rgb(0, 0, 0),
    });

    yPosition -= lineHeight;
    page.drawText(`Maturity Date: ${data.maturityDate.toLocaleDateString()}`, {
      x: 70,
      y: yPosition,
      size: 11,
      color: rgb(0, 0, 0),
    });

    // Terms Section
    yPosition -= lineHeight * 1.5;
    page.drawText('TERMS AND CONDITIONS', {
      x: 50,
      y: yPosition,
      size: 12,
      color: rgb(0.2, 0.4, 0.8),
    });

    yPosition -= lineHeight;
    const termsLines = this.wrapText(data.terms, 80);
    for (const line of termsLines.slice(0, 3)) {
      page.drawText(line, {
        x: 70,
        y: yPosition,
        size: 9,
        color: rgb(0, 0, 0),
      });
      yPosition -= lineHeight * 0.8;
    }
  }

  /**
   * Draw blockchain verification section
   */
  private drawBlockchainVerification(page: PDFPage, data: CertificateData): void {
    const { width } = page.getSize();

    // Blockchain Section
    page.drawRectangle({
      x: 50,
      y: 150,
      width: width - 100,
      height: 120,
      borderColor: rgb(0.2, 0.8, 0.2),
      borderWidth: 2,
      color: rgb(0.9, 1, 0.9),
    });

    page.drawText('✓ BLOCKCHAIN VERIFIED', {
      x: 70,
      y: 255,
      size: 12,
      color: rgb(0.2, 0.8, 0.2),
    });

    page.drawText(`Transaction Hash: ${data.blockchainVerification.transactionHash.slice(0, 20)}...`, {
      x: 70,
      y: 235,
      size: 9,
      color: rgb(0, 0, 0),
    });

    page.drawText(`Block Number: ${data.blockchainVerification.blockNumber}`, {
      x: 70,
      y: 220,
      size: 9,
      color: rgb(0, 0, 0),
    });

    page.drawText(
      `Verified: ${data.blockchainVerification.verificationTimestamp.toLocaleString()}`,
      {
        x: 70,
        y: 205,
        size: 9,
        color: rgb(0, 0, 0),
      }
    );

    page.drawText(`Network: Hyperledger Besu`, {
      x: 70,
      y: 190,
      size: 9,
      color: rgb(0, 0, 0),
    });

    page.drawText(`Explorer: ${data.blockchainVerification.explorerUrl}`, {
      x: 70,
      y: 175,
      size: 8,
      color: rgb(0.2, 0.4, 0.8),
    });
  }

  /**
   * Draw footer
   */
  private drawFooter(page: PDFPage, data: CertificateData): void {
    const { width } = page.getSize();

    // Issuer info
    page.drawText(`Issued by: ${data.issuerName}`, {
      x: 50,
      y: 40,
      size: 10,
      color: rgb(0, 0, 0),
    });

    page.drawText(`Email: ${data.issuerEmail}`, {
      x: 50,
      y: 25,
      size: 9,
      color: rgb(0.5, 0.5, 0.5),
    });

    // Date
    page.drawText(`Generated: ${new Date().toLocaleDateString()}`, {
      x: width - 200,
      y: 40,
      size: 10,
      color: rgb(0, 0, 0),
    });

    // Signature line
    page.drawLine({
      start: { x: width - 200, y: 60 },
      end: { x: width - 50, y: 60 },
      thickness: 1,
      color: rgb(0, 0, 0),
    });

    page.drawText('Authorized Signature', {
      x: width - 180,
      y: 65,
      size: 8,
      color: rgb(0.5, 0.5, 0.5),
    });
  }

  /**
   * Wrap text to fit width
   */
  private wrapText(text: string, maxWidth: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      if ((currentLine + word).length > maxWidth) {
        if (currentLine) {
          lines.push(currentLine);
        }
        currentLine = word;
      } else {
        currentLine += (currentLine ? ' ' : '') + word;
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    return lines;
  }
}

// ============================================================================
// Certificate Manager
// ============================================================================

export class CertificateManager {
  private signingService: CertificateSigningService;
  private certificateCache: Map<string, SignedCertificate> = new Map();

  constructor(
    privateKeyPath: string,
    publicKeyPath: string,
    issuerName: string,
    issuerEmail: string
  ) {
    this.signingService = new CertificateSigningService(
      privateKeyPath,
      publicKeyPath,
      issuerName,
      issuerEmail
    );
  }

  /**
   * Generate and sign certificate
   */
  async generateAndSignCertificate(
    data: CertificateData
  ): Promise<SignedCertificate> {
    try {
      const signedCertificate = await this.signingService.createSignedCertificate(data);

      // Cache certificate
      this.certificateCache.set(signedCertificate.certificateId, signedCertificate);

      return signedCertificate;
    } catch (error) {
      throw new Error(`Failed to generate and sign certificate: ${error}`);
    }
  }

  /**
   * Get cached certificate
   */
  getCachedCertificate(certificateId: string): SignedCertificate | undefined {
    return this.certificateCache.get(certificateId);
  }

  /**
   * Export certificate
   */
  async exportCertificate(
    signedCertificate: SignedCertificate,
    outputDir: string
  ): Promise<string> {
    try {
      const outputPath = path.join(outputDir, signedCertificate.certificateId);
      return await this.signingService.exportCertificate(signedCertificate, outputPath);
    } catch (error) {
      throw new Error(`Failed to export certificate: ${error}`);
    }
  }

  /**
   * Verify certificate
   */
  async verifyCertificate(
    pdfPath: string,
    metadataPath: string
  ): Promise<{
    isValid: boolean;
    certificateId: string;
    hash: string;
    message: string;
  }> {
    try {
      return await this.signingService.loadAndVerifyCertificate(pdfPath, metadataPath);
    } catch (error) {
      throw new Error(`Failed to verify certificate: ${error}`);
    }
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.certificateCache.clear();
  }
}

export default CertificateSigningService;
