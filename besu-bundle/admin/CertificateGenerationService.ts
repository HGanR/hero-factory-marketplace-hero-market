/**
 * Certificate Generation Service
 * 
 * Generates blockchain-verified certificates for trust records.
 * Supports PDF and JSON export formats.
 * Includes digital signing with RSA-SHA256.
 * 
 * File: server/services/certificate.ts
 */

import { PDFDocument, PDFPage, rgb, degrees } from 'pdf-lib';
import crypto from 'crypto';
import { db } from '../db';
import { TrustRecord } from '../types/trust';

// ============================================================================
// Type Definitions
// ============================================================================

export interface CertificateGenerationOptions {
  trustId: string;
  format: 'pdf' | 'json';
  includeSignature?: boolean;
  includeQRCode?: boolean;
  signerName?: string;
  signerTitle?: string;
}

export interface GeneratedCertificate {
  success: boolean;
  certificateId: string;
  trustId: string;
  format: 'pdf' | 'json';
  filename: string;
  contentType: string;
  data: Buffer | string;
  size: number;
  hash: string;
  signature?: {
    algorithm: string;
    signature: string;
    publicKey: string;
  };
  createdAt: Date;
  expiresAt?: Date;
}

export interface CertificateData {
  certificateId: string;
  trustId: string;
  trustName: string;
  amount: number;
  currency: string;
  beneficiary: string;
  maturityDate: Date;
  terms: string;
  issuerName: string;
  issuerAddress: string;
  blockchainStatus: string;
  transactionHash: string;
  blockNumber: number;
  contractAddress: string;
  verificationTimestamp: Date;
  isVerified: boolean;
  generatedAt: Date;
  expiresAt?: Date;
}

// ============================================================================
// Certificate Generation Service
// ============================================================================

export class CertificateGenerationService {
  private privateKey: crypto.KeyObject;
  private publicKey: crypto.KeyObject;

  constructor(privateKeyPath?: string, publicKeyPath?: string) {
    // Initialize RSA keys for signing
    if (privateKeyPath && publicKeyPath) {
      const fs = require('fs');
      const privateKeyPem = fs.readFileSync(privateKeyPath, 'utf-8');
      const publicKeyPem = fs.readFileSync(publicKeyPath, 'utf-8');

      this.privateKey = crypto.createPrivateKey(privateKeyPem);
      this.publicKey = crypto.createPublicKey(publicKeyPem);
    } else {
      // Generate temporary keys for demo
      const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: {
          type: 'spki',
          format: 'pem',
        },
        privateKeyEncoding: {
          type: 'pkcs8',
          format: 'pem',
        },
      });

      this.privateKey = crypto.createPrivateKey(privateKey);
      this.publicKey = crypto.createPublicKey(publicKey);
    }
  }

  /**
   * Generate certificate for a trust record
   */
  async generateCertificate(
    options: CertificateGenerationOptions
  ): Promise<GeneratedCertificate> {
    // Fetch trust record
    const trust = await db.trustRecord.findUnique({
      where: { id: options.trustId },
    });

    if (!trust) {
      throw new Error(`Trust record not found: ${options.trustId}`);
    }

    if (!trust.isVerified) {
      throw new Error(`Trust record not verified: ${options.trustId}`);
    }

    // Create certificate data
    const certificateData: CertificateData = {
      certificateId: `CERT-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      trustId: trust.id,
      trustName: trust.trustName,
      amount: trust.amount,
      currency: 'USD',
      beneficiary: trust.beneficiary,
      maturityDate: trust.maturityDate,
      terms: trust.terms,
      issuerName: process.env.ISSUER_NAME || 'TroothHurtz Legal Platform',
      issuerAddress: process.env.ISSUER_ADDRESS || 'TroothHurtz Inc.',
      blockchainStatus: trust.blockchainStatus,
      transactionHash: trust.transactionHash || '',
      blockNumber: trust.blockNumber || 0,
      contractAddress: trust.contractAddress || '',
      verificationTimestamp: trust.verificationTimestamp || new Date(),
      isVerified: trust.isVerified,
      generatedAt: new Date(),
    };

    // Generate certificate in requested format
    let result: GeneratedCertificate;

    if (options.format === 'pdf') {
      result = await this.generatePDFCertificate(
        certificateData,
        options.includeSignature || false,
        options.signerName,
        options.signerTitle
      );
    } else {
      result = await this.generateJSONCertificate(
        certificateData,
        options.includeSignature || false
      );
    }

    return result;
  }

  /**
   * Generate PDF certificate
   */
  private async generatePDFCertificate(
    data: CertificateData,
    includeSignature: boolean = false,
    signerName?: string,
    signerTitle?: string
  ): Promise<GeneratedCertificate> {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([612, 792]); // Letter size

    const { width, height } = page.getSize();

    // Colors
    const darkBlue = rgb(0.1, 0.3, 0.6);
    const lightBlue = rgb(0.8, 0.9, 0.98);
    const black = rgb(0, 0, 0);
    const gray = rgb(0.5, 0.5, 0.5);

    // Draw header background
    page.drawRectangle({
      x: 0,
      y: height - 120,
      width: width,
      height: 120,
      color: darkBlue,
    });

    // Draw title
    page.drawText('BLOCKCHAIN-VERIFIED CERTIFICATE', {
      x: 50,
      y: height - 60,
      size: 28,
      color: rgb(1, 1, 1),
      font: await pdfDoc.embedFont('Helvetica-Bold'),
    });

    // Draw certificate ID
    page.drawText(`Certificate ID: ${data.certificateId}`, {
      x: 50,
      y: height - 90,
      size: 10,
      color: rgb(0.8, 0.8, 0.8),
      font: await pdfDoc.embedFont('Helvetica'),
    });

    // Draw content section
    let yPosition = height - 180;

    // Trust Information
    page.drawText('TRUST INFORMATION', {
      x: 50,
      y: yPosition,
      size: 14,
      color: darkBlue,
      font: await pdfDoc.embedFont('Helvetica-Bold'),
    });

    yPosition -= 30;

    const trustInfo = [
      { label: 'Trust Name:', value: data.trustName },
      { label: 'Amount:', value: `$${data.amount.toLocaleString()}` },
      { label: 'Currency:', value: data.currency },
      { label: 'Beneficiary:', value: data.beneficiary },
      { label: 'Maturity Date:', value: data.maturityDate.toLocaleDateString() },
    ];

    for (const info of trustInfo) {
      page.drawText(info.label, {
        x: 50,
        y: yPosition,
        size: 11,
        color: black,
        font: await pdfDoc.embedFont('Helvetica-Bold'),
      });

      page.drawText(info.value, {
        x: 200,
        y: yPosition,
        size: 11,
        color: black,
        font: await pdfDoc.embedFont('Helvetica'),
      });

      yPosition -= 20;
    }

    // Blockchain Verification Section
    yPosition -= 10;

    page.drawText('BLOCKCHAIN VERIFICATION', {
      x: 50,
      y: yPosition,
      size: 14,
      color: darkBlue,
      font: await pdfDoc.embedFont('Helvetica-Bold'),
    });

    yPosition -= 30;

    const blockchainInfo = [
      { label: 'Status:', value: data.isVerified ? '✓ VERIFIED' : 'PENDING' },
      {
        label: 'Transaction Hash:',
        value: data.transactionHash.substring(0, 20) + '...',
      },
      { label: 'Block Number:', value: data.blockNumber.toString() },
      {
        label: 'Contract Address:',
        value: data.contractAddress.substring(0, 20) + '...',
      },
      {
        label: 'Verification Date:',
        value: data.verificationTimestamp.toLocaleDateString(),
      },
    ];

    for (const info of blockchainInfo) {
      page.drawText(info.label, {
        x: 50,
        y: yPosition,
        size: 10,
        color: black,
        font: await pdfDoc.embedFont('Helvetica-Bold'),
      });

      page.drawText(info.value, {
        x: 200,
        y: yPosition,
        size: 10,
        color: gray,
        font: await pdfDoc.embedFont('Helvetica'),
      });

      yPosition -= 18;
    }

    // Signature section
    if (includeSignature) {
      yPosition -= 20;

      page.drawLine({
        start: { x: 50, y: yPosition },
        end: { x: 300, y: yPosition },
        thickness: 1,
        color: gray,
      });

      yPosition -= 30;

      page.drawText('Authorized Signature', {
        x: 50,
        y: yPosition,
        size: 10,
        color: black,
        font: await pdfDoc.embedFont('Helvetica'),
      });

      if (signerName) {
        page.drawText(signerName, {
          x: 50,
          y: yPosition - 20,
          size: 11,
          color: black,
          font: await pdfDoc.embedFont('Helvetica-Bold'),
        });
      }

      if (signerTitle) {
        page.drawText(signerTitle, {
          x: 50,
          y: yPosition - 38,
          size: 10,
          color: gray,
          font: await pdfDoc.embedFont('Helvetica'),
        });
      }
    }

    // Footer
    page.drawText(
      `Generated: ${data.generatedAt.toISOString()} | Expires: ${data.expiresAt?.toISOString() || 'Never'}`,
      {
        x: 50,
        y: 30,
        size: 8,
        color: gray,
        font: await pdfDoc.embedFont('Helvetica'),
      }
    );

    // Save PDF
    const pdfBytes = await pdfDoc.save();
    const pdfBuffer = Buffer.from(pdfBytes);

    // Generate signature
    const signature = includeSignature
      ? this.signData(pdfBuffer)
      : undefined;

    // Calculate hash
    const hash = crypto
      .createHash('sha256')
      .update(pdfBuffer)
      .digest('hex');

    const filename = `certificate-${data.trustId}-${Date.now()}.pdf`;

    return {
      success: true,
      certificateId: data.certificateId,
      trustId: data.trustId,
      format: 'pdf',
      filename,
      contentType: 'application/pdf',
      data: pdfBuffer,
      size: pdfBuffer.length,
      hash,
      signature,
      createdAt: new Date(),
      expiresAt: data.expiresAt,
    };
  }

  /**
   * Generate JSON certificate
   */
  private async generateJSONCertificate(
    data: CertificateData,
    includeSignature: boolean = false
  ): Promise<GeneratedCertificate> {
    const jsonData = {
      certificateId: data.certificateId,
      trustId: data.trustId,
      trustName: data.trustName,
      amount: data.amount,
      currency: data.currency,
      beneficiary: data.beneficiary,
      maturityDate: data.maturityDate.toISOString(),
      terms: data.terms,
      issuerName: data.issuerName,
      issuerAddress: data.issuerAddress,
      blockchain: {
        status: data.blockchainStatus,
        isVerified: data.isVerified,
        transactionHash: data.transactionHash,
        blockNumber: data.blockNumber,
        contractAddress: data.contractAddress,
        verificationTimestamp: data.verificationTimestamp.toISOString(),
      },
      metadata: {
        generatedAt: data.generatedAt.toISOString(),
        expiresAt: data.expiresAt?.toISOString(),
      },
    };

    const jsonString = JSON.stringify(jsonData, null, 2);
    const jsonBuffer = Buffer.from(jsonString, 'utf-8');

    // Generate signature
    const signature = includeSignature
      ? this.signData(jsonBuffer)
      : undefined;

    // Calculate hash
    const hash = crypto
      .createHash('sha256')
      .update(jsonBuffer)
      .digest('hex');

    const filename = `certificate-${data.trustId}-${Date.now()}.json`;

    return {
      success: true,
      certificateId: data.certificateId,
      trustId: data.trustId,
      format: 'json',
      filename,
      contentType: 'application/json',
      data: jsonString,
      size: jsonBuffer.length,
      hash,
      signature,
      createdAt: new Date(),
      expiresAt: data.expiresAt,
    };
  }

  /**
   * Sign data with RSA-SHA256
   */
  private signData(data: Buffer): {
    algorithm: string;
    signature: string;
    publicKey: string;
  } {
    const sign = crypto.createSign('sha256');
    sign.update(data);
    const signature = sign.sign(this.privateKey, 'base64');

    const publicKeyPem = this.publicKey.export({ format: 'pem', type: 'spki' });

    return {
      algorithm: 'RSA-SHA256',
      signature,
      publicKey: publicKeyPem.toString(),
    };
  }

  /**
   * Verify certificate signature
   */
  static verifyCertificateSignature(
    data: Buffer,
    signature: string,
    publicKeyPem: string
  ): boolean {
    try {
      const publicKey = crypto.createPublicKey(publicKeyPem);
      const verify = crypto.createVerify('sha256');
      verify.update(data);
      return verify.verify(publicKey, signature, 'base64');
    } catch (error) {
      console.error('Signature verification failed:', error);
      return false;
    }
  }

  /**
   * Export certificate to file
   */
  async exportCertificate(
    certificate: GeneratedCertificate,
    outputPath: string
  ): Promise<void> {
    const fs = require('fs').promises;

    if (certificate.format === 'pdf') {
      await fs.writeFile(outputPath, certificate.data as Buffer);
    } else {
      await fs.writeFile(outputPath, certificate.data as string, 'utf-8');
    }
  }

  /**
   * Get certificate download URL
   */
  getCertificateDownloadUrl(certificateId: string): string {
    return `/api/certificates/${certificateId}/download`;
  }
}

// ============================================================================
// Export
// ============================================================================

export default CertificateGenerationService;
