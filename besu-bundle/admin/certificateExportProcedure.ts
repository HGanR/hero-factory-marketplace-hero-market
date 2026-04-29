/**
 * Certificate Export Procedure
 * 
 * tRPC procedure for exporting blockchain-verified certificates as PDFs.
 * Handles PDF generation, digital signing, and secure delivery.
 */

import { protectedProcedure } from '@/server/_core/trpc';
import { z } from 'zod';
import { db } from '@/server/db';
import { trustRecords } from '@/server/db/schema';
import { eq } from 'drizzle-orm';
import { CertificateManager } from '@/services/CertificateSigningService';
import path from 'path';
import fs from 'fs/promises';

// ============================================================================
// Initialize Certificate Manager
// ============================================================================

const certificateManager = new CertificateManager(
  process.env.CERTIFICATE_PRIVATE_KEY_PATH || path.join(process.cwd(), 'keys/private.pem'),
  process.env.CERTIFICATE_PUBLIC_KEY_PATH || path.join(process.cwd(), 'keys/public.pem'),
  process.env.ISSUER_NAME || 'TroothHurtz Legal Platform',
  process.env.ISSUER_EMAIL || 'certificates@troothurtz.com'
);

// ============================================================================
// Export Certificate Procedure
// ============================================================================

export const exportCertificateProcedure = protectedProcedure
  .input(
    z.object({
      trustId: z.string(),
      format: z.enum(['pdf', 'json']).default('pdf'),
      includeSignature: z.boolean().default(true),
    })
  )
  .mutation(async ({ input, ctx }) => {
    try {
      // 1. Get trust record from database
      const trust = await db.query.trustRecords.findFirst({
        where: eq(trustRecords.id, input.trustId),
      });

      if (!trust) {
        throw new Error('Trust record not found');
      }

      // 2. Verify user owns this trust
      if (trust.userId !== ctx.user.id) {
        throw new Error('Unauthorized: You do not own this trust');
      }

      // 3. Verify trust is recorded on blockchain
      if (trust.blockchainStatus !== 'verified') {
        throw new Error(
          `Cannot export certificate: Trust status is ${trust.blockchainStatus}. Only verified trusts can be exported.`
        );
      }

      if (!trust.transactionHash) {
        throw new Error('Trust does not have a blockchain transaction hash');
      }

      // 4. Prepare certificate data
      const certificateData = {
        trustId: trust.id,
        trustName: trust.name,
        amount: trust.amount,
        beneficiary: trust.beneficiary,
        maturityDate: trust.maturityDate,
        terms: trust.terms,
        blockchainVerification: {
          transactionHash: trust.transactionHash,
          blockNumber: trust.blockNumber || 0,
          verificationTimestamp: trust.verificationTimestamp || new Date(),
          explorerUrl: `${process.env.BESU_EXPLORER_URL || 'http://localhost:4000'}/tx/${trust.transactionHash}`,
        },
        issuerName: process.env.ISSUER_NAME || 'TroothHurtz Legal Platform',
        issuerAddress: process.env.ISSUER_ADDRESS || '0x0000000000000000000000000000000000000000',
        issuerEmail: process.env.ISSUER_EMAIL || 'certificates@troothurtz.com',
      };

      // 5. Generate and sign certificate
      const signedCertificate = await certificateManager.generateAndSignCertificate(
        certificateData
      );

      // 6. Return based on format
      if (input.format === 'pdf') {
        return {
          success: true,
          format: 'pdf',
          certificateId: signedCertificate.certificateId,
          pdfBase64: signedCertificate.pdfBuffer.toString('base64'),
          filename: `${trust.name.replace(/\s+/g, '_')}_Certificate.pdf`,
          signature: input.includeSignature
            ? {
                signature: signedCertificate.signature.signature,
                algorithm: signedCertificate.signature.algorithm,
                timestamp: signedCertificate.signature.timestamp,
              }
            : undefined,
          metadata: {
            trustId: trust.id,
            trustName: trust.name,
            amount: trust.amount,
            transactionHash: trust.transactionHash,
            blockNumber: trust.blockNumber,
            verifiedAt: trust.verificationTimestamp,
          },
        };
      } else {
        // JSON format
        return {
          success: true,
          format: 'json',
          certificateId: signedCertificate.certificateId,
          certificate: {
            trustId: trust.id,
            trustName: trust.name,
            amount: trust.amount,
            beneficiary: trust.beneficiary,
            maturityDate: trust.maturityDate,
            terms: trust.terms,
            blockchainVerification: {
              transactionHash: trust.transactionHash,
              blockNumber: trust.blockNumber,
              verificationTimestamp: trust.verificationTimestamp,
              explorerUrl: certificateData.blockchainVerification.explorerUrl,
            },
            issuer: {
              name: certificateData.issuerName,
              email: certificateData.issuerEmail,
            },
            generatedAt: new Date(),
          },
          signature: input.includeSignature
            ? {
                signature: signedCertificate.signature.signature,
                algorithm: signedCertificate.signature.algorithm,
                timestamp: signedCertificate.signature.timestamp,
              }
            : undefined,
        };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to export certificate: ${message}`);
    }
  });

// ============================================================================
// Verify Certificate Procedure
// ============================================================================

export const verifyCertificateProcedure = protectedProcedure
  .input(
    z.object({
      certificateId: z.string(),
      pdfBase64: z.string().optional(),
      metadataJson: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    try {
      // If PDF and metadata provided, verify signature
      if (input.pdfBase64 && input.metadataJson) {
        // Create temporary files
        const tempDir = path.join(process.cwd(), 'temp');
        await fs.mkdir(tempDir, { recursive: true });

        const pdfPath = path.join(tempDir, `${input.certificateId}.pdf`);
        const metadataPath = path.join(tempDir, `${input.certificateId}.json`);

        try {
          // Write files
          const pdfBuffer = Buffer.from(input.pdfBase64, 'base64');
          await fs.writeFile(pdfPath, pdfBuffer);
          await fs.writeFile(metadataPath, input.metadataJson);

          // Verify certificate
          const verification = await certificateManager.verifyCertificate(
            pdfPath,
            metadataPath
          );

          return {
            success: true,
            isValid: verification.isValid,
            certificateId: verification.certificateId,
            hash: verification.hash,
            message: verification.message,
          };
        } finally {
          // Cleanup temporary files
          try {
            await fs.unlink(pdfPath);
            await fs.unlink(metadataPath);
          } catch (e) {
            // Ignore cleanup errors
          }
        }
      } else {
        // Return cached certificate info
        const cached = certificateManager.getCachedCertificate(input.certificateId);

        if (!cached) {
          throw new Error('Certificate not found in cache');
        }

        return {
          success: true,
          isValid: true,
          certificateId: input.certificateId,
          hash: cached.hash,
          message: 'Certificate found in cache',
          createdAt: cached.createdAt,
        };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to verify certificate: ${message}`);
    }
  });

// ============================================================================
// Get Certificate Metadata Procedure
// ============================================================================

export const getCertificateMetadataProcedure = protectedProcedure
  .input(
    z.object({
      trustId: z.string(),
    })
  )
  .query(async ({ input, ctx }) => {
    try {
      // Get trust record
      const trust = await db.query.trustRecords.findFirst({
        where: eq(trustRecords.id, input.trustId),
      });

      if (!trust) {
        throw new Error('Trust record not found');
      }

      // Verify user owns trust
      if (trust.userId !== ctx.user.id) {
        throw new Error('Unauthorized');
      }

      // Check if certificate can be exported
      const canExport = trust.blockchainStatus === 'verified' && trust.transactionHash;

      return {
        trustId: trust.id,
        trustName: trust.name,
        amount: trust.amount,
        beneficiary: trust.beneficiary,
        maturityDate: trust.maturityDate,
        blockchainStatus: trust.blockchainStatus,
        transactionHash: trust.transactionHash,
        blockNumber: trust.blockNumber,
        verificationTimestamp: trust.verificationTimestamp,
        canExport,
        exportUrl: canExport
          ? `${process.env.BESU_EXPLORER_URL || 'http://localhost:4000'}/tx/${trust.transactionHash}`
          : null,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to get certificate metadata: ${message}`);
    }
  });

// ============================================================================
// Batch Export Certificates Procedure
// ============================================================================

export const batchExportCertificatesProcedure = protectedProcedure
  .input(
    z.object({
      trustIds: z.array(z.string()),
      format: z.enum(['pdf', 'json']).default('pdf'),
    })
  )
  .mutation(async ({ input, ctx }) => {
    try {
      const results = [];
      const errors = [];

      for (const trustId of input.trustIds) {
        try {
          // Get trust record
          const trust = await db.query.trustRecords.findFirst({
            where: eq(trustRecords.id, trustId),
          });

          if (!trust) {
            errors.push({ trustId, error: 'Trust not found' });
            continue;
          }

          // Verify user owns trust
          if (trust.userId !== ctx.user.id) {
            errors.push({ trustId, error: 'Unauthorized' });
            continue;
          }

          // Check if certificate can be exported
          if (trust.blockchainStatus !== 'verified') {
            errors.push({
              trustId,
              error: `Cannot export: status is ${trust.blockchainStatus}`,
            });
            continue;
          }

          // Prepare certificate data
          const certificateData = {
            trustId: trust.id,
            trustName: trust.name,
            amount: trust.amount,
            beneficiary: trust.beneficiary,
            maturityDate: trust.maturityDate,
            terms: trust.terms,
            blockchainVerification: {
              transactionHash: trust.transactionHash || '',
              blockNumber: trust.blockNumber || 0,
              verificationTimestamp: trust.verificationTimestamp || new Date(),
              explorerUrl: `${process.env.BESU_EXPLORER_URL || 'http://localhost:4000'}/tx/${trust.transactionHash}`,
            },
            issuerName: process.env.ISSUER_NAME || 'TroothHurtz Legal Platform',
            issuerAddress: process.env.ISSUER_ADDRESS || '0x0000000000000000000000000000000000000000',
            issuerEmail: process.env.ISSUER_EMAIL || 'certificates@troothurtz.com',
          };

          // Generate certificate
          const signedCertificate = await certificateManager.generateAndSignCertificate(
            certificateData
          );

          results.push({
            trustId,
            certificateId: signedCertificate.certificateId,
            success: true,
            filename: `${trust.name.replace(/\s+/g, '_')}_Certificate.${input.format === 'pdf' ? 'pdf' : 'json'}`,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          errors.push({ trustId, error: message });
        }
      }

      return {
        success: true,
        total: input.trustIds.length,
        exported: results.length,
        failed: errors.length,
        results,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to batch export certificates: ${message}`);
    }
  });

// ============================================================================
// Export Procedures
// ============================================================================

export default {
  exportCertificate: exportCertificateProcedure,
  verifyCertificate: verifyCertificateProcedure,
  getCertificateMetadata: getCertificateMetadataProcedure,
  batchExportCertificates: batchExportCertificatesProcedure,
};
