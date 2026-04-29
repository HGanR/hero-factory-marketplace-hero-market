import { z } from "zod";
import { protectedProcedure } from "../trpc";
import { ethers } from "ethers";
import { TrustVerification } from "../types/TrustVerification.interface";
import { db } from "../db";
import { trustRecords } from "../db/schema";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";

/**
 * Input validation schema for verifyTrust procedure
 */
const VerifyTrustInput = z.object({
  trustId: z.string().min(1, "Trust ID is required"),
});

/**
 * Verification result schema
 */
const VerificationResult = z.object({
  instrumentExists: z.boolean(),
  issuerAuthorized: z.boolean(),
  documentHashMatches: z.boolean(),
  verificationTimestamp: z.number(),
  verificationBlock: z.number(),
});

/**
 * Output schema for verifyTrust procedure
 */
const VerifyTrustOutput = z.object({
  success: z.boolean(),
  message: z.string(),
  trustId: z.string(),
  verificationDetails: VerificationResult.optional(),
  blockchainStatus: z.string(),
  transactionHash: z.string().optional(),
  blockNumber: z.number().optional(),
  contractAddress: z.string().optional(),
  verifiedAt: z.string().optional(),
  isVerified: z.boolean(),
});

/**
 * Helper function to create SHA256 hash of trust data
 */
function createDocumentHash(data: {
  trustId: string;
  trustName: string;
  amount: string;
  beneficiary: string;
  maturityDate: string;
  terms: string;
}): string {
  const dataString = JSON.stringify(data);
  return crypto.createHash("sha256").update(dataString).digest("hex");
}

/**
 * Helper function to convert hex string to bytes32
 */
function stringToBytes32(str: string): string {
  const hash = crypto.createHash("sha256").update(str).digest();
  return "0x" + hash.toString("hex");
}

/**
 * Helper function to get Besu contract instance
 */
async function getContractInstance(): Promise<TrustVerification> {
  const contractAddress = process.env.TRUST_CONTRACT_ADDRESS;
  if (!contractAddress) {
    throw new Error("TRUST_CONTRACT_ADDRESS not configured");
  }

  const rpcUrl = process.env.BESU_RPC_URL;
  if (!rpcUrl) {
    throw new Error("BESU_RPC_URL not configured");
  }

  const privateKey = process.env.ISSUER_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("ISSUER_PRIVATE_KEY not configured");
  }

  // Create provider
  const provider = new ethers.JsonRpcProvider(rpcUrl);

  // Create signer
  const signer = new ethers.Wallet(privateKey, provider);

  // Import ABI
  const abi = require("../abis/TrustVerification.abi.json");

  // Create contract instance
  const contract = new ethers.Contract(
    contractAddress,
    abi,
    signer
  ) as unknown as TrustVerification;

  return contract;
}

/**
 * Helper function to check Besu network connection
 */
async function checkNetworkConnection(provider: ethers.Provider): Promise<boolean> {
  try {
    const blockNumber = await provider.getBlockNumber();
    return blockNumber > 0;
  } catch (error) {
    console.error("Network connection check failed:", error);
    return false;
  }
}

/**
 * tRPC procedure to verify a trust record on Besu blockchain
 */
export const verifyTrustProcedure = protectedProcedure
  .input(VerifyTrustInput)
  .output(VerifyTrustOutput)
  .mutation(async ({ input, ctx }) => {
    const userId = ctx.user.id;

    console.log(`[verifyTrust] Starting for user ${userId}, trust: ${input.trustId}`);

    try {
      // ====================================================================
      // Step 1: Validate Input
      // ====================================================================
      console.log("[verifyTrust] Step 1: Validating input");

      if (!input.trustId) {
        throw new Error("Trust ID is required");
      }

      // ====================================================================
      // Step 2: Fetch Trust Record from Database
      // ====================================================================
      console.log("[verifyTrust] Step 2: Fetching trust record");

      const trustRecordResult = await db
        .select()
        .from(trustRecords)
        .where(
          and(
            eq(trustRecords.id, input.trustId),
            eq(trustRecords.userId, userId)
          )
        )
        .limit(1);

      if (trustRecordResult.length === 0) {
        throw new Error("Trust record not found");
      }

      const trust = trustRecordResult[0];

      console.log(`[verifyTrust] Trust found: ${trust.trustName}`);

      // ====================================================================
      // Step 3: Check if Already Recorded on Blockchain
      // ====================================================================
      console.log("[verifyTrust] Step 3: Checking blockchain status");

      if (trust.blockchainStatus === "not_recorded") {
        throw new Error("Trust has not been recorded on blockchain yet");
      }

      console.log(`[verifyTrust] Blockchain status: ${trust.blockchainStatus}`);

      // ====================================================================
      // Step 4: Check Besu Network Connection
      // ====================================================================
      console.log("[verifyTrust] Step 4: Checking Besu network connection");

      const rpcUrl = process.env.BESU_RPC_URL;
      if (!rpcUrl) {
        throw new Error("BESU_RPC_URL not configured");
      }

      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const isConnected = await checkNetworkConnection(provider);

      if (!isConnected) {
        throw new Error("Cannot connect to Besu network");
      }

      console.log("[verifyTrust] Besu network connected");

      // ====================================================================
      // Step 5: Get Contract Instance
      // ====================================================================
      console.log("[verifyTrust] Step 5: Getting contract instance");

      const contract = await getContractInstance();
      const contractAddress = await contract.getAddress();

      console.log(`[verifyTrust] Contract address: ${contractAddress}`);

      // ====================================================================
      // Step 6: Create Document Hash
      // ====================================================================
      console.log("[verifyTrust] Step 6: Creating document hash");

      const documentHash = createDocumentHash({
        trustId: trust.id,
        trustName: trust.trustName,
        amount: trust.amount.toString(),
        beneficiary: trust.beneficiary,
        maturityDate: trust.maturityDate.toISOString(),
        terms: trust.terms,
      });

      const documentHashBytes32 = stringToBytes32(documentHash);

      console.log(`[verifyTrust] Document hash: ${documentHash}`);

      // ====================================================================
      // Step 7: Call verifyInstrument on Smart Contract
      // ====================================================================
      console.log("[verifyTrust] Step 7: Calling verifyInstrument on smart contract");

      let verificationResult;
      try {
        const result = await contract.verifyInstrument(
          trust.id,
          documentHashBytes32
        );

        verificationResult = {
          instrumentExists: result[0],
          issuerAuthorized: result[1],
          documentHashMatches: result[2],
          verificationTimestamp: Number(result[3]),
          verificationBlock: Number(result[4]),
        };

        console.log("[verifyTrust] Verification result:", verificationResult);
      } catch (error) {
        console.error("[verifyTrust] Smart contract call failed:", error);
        throw new Error(`Smart contract verification failed: ${error instanceof Error ? error.message : String(error)}`);
      }

      // ====================================================================
      // Step 8: Analyze Verification Results
      // ====================================================================
      console.log("[verifyTrust] Step 8: Analyzing verification results");

      const allChecksPass =
        verificationResult.instrumentExists &&
        verificationResult.issuerAuthorized &&
        verificationResult.documentHashMatches;

      let verificationStatus = "failed";
      if (allChecksPass) {
        verificationStatus = "verified";
      } else if (verificationResult.instrumentExists) {
        verificationStatus = "partial";
      }

      console.log(`[verifyTrust] Verification status: ${verificationStatus}`);

      // ====================================================================
      // Step 9: Update Database with Verification Results
      // ====================================================================
      console.log("[verifyTrust] Step 9: Updating database");

      const now = new Date();

      await db
        .update(trustRecords)
        .set({
          blockchainStatus: verificationStatus,
          isVerified: allChecksPass,
          verificationTimestamp: now,
          verificationAttempts: (trust.verificationAttempts || 0) + 1,
          lastVerificationAttempt: now,
          updatedAt: now,
        })
        .where(eq(trustRecords.id, input.trustId));

      console.log("[verifyTrust] Database updated successfully");

      // ====================================================================
      // Step 10: Return Verification Result
      // ====================================================================
      console.log("[verifyTrust] Step 10: Returning verification result");

      const message = allChecksPass
        ? "Trust verified successfully on blockchain"
        : "Trust verification failed - some checks did not pass";

      return {
        success: allChecksPass,
        message,
        trustId: input.trustId,
        verificationDetails: verificationResult,
        blockchainStatus: verificationStatus,
        transactionHash: trust.transactionHash || undefined,
        blockNumber: trust.blockNumber || undefined,
        contractAddress: contractAddress,
        verifiedAt: now.toISOString(),
        isVerified: allChecksPass,
      };
    } catch (error) {
      console.error("[verifyTrust] Error:", error);

      // Update database with failure status
      try {
        const trustRecordResult = await db
          .select()
          .from(trustRecords)
          .where(
            and(
              eq(trustRecords.id, input.trustId),
              eq(trustRecords.userId, userId)
            )
          )
          .limit(1);

        if (trustRecordResult.length > 0) {
          const trust = trustRecordResult[0];
          await db
            .update(trustRecords)
            .set({
              blockchainStatus: "failed",
              verificationAttempts: (trust.verificationAttempts || 0) + 1,
              lastVerificationAttempt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(trustRecords.id, input.trustId));
        }
      } catch (dbError) {
        console.error("[verifyTrust] Failed to update database with error status:", dbError);
      }

      throw new Error(
        `Failed to verify trust: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  });

/**
 * Export the procedure for use in tRPC router
 */
export default verifyTrustProcedure;

/**
 * Usage Example:
 * 
 * // In your React component
 * const { mutate: verifyTrust, isPending } = trpc.blockchain.verifyTrust.useMutation({
 *   onSuccess: (data) => {
 *     console.log("Trust verified:", data);
 *     if (data.isVerified) {
 *       toast.success("Trust verified on blockchain!");
 *     } else {
 *       toast.warning("Trust verification failed");
 *     }
 *   },
 *   onError: (error) => {
 *     console.error("Verification failed:", error);
 *     toast.error(error.message);
 *   },
 * });
 * 
 * // Call the mutation
 * verifyTrust({
 *   trustId: "trust-123",
 * });
 * 
 * // Response example:
 * {
 *   success: true,
 *   message: "Trust verified successfully on blockchain",
 *   trustId: "trust-123",
 *   verificationDetails: {
 *     instrumentExists: true,
 *     issuerAuthorized: true,
 *     documentHashMatches: true,
 *     verificationTimestamp: 1702756800,
 *     verificationBlock: 12345
 *   },
 *   blockchainStatus: "verified",
 *   transactionHash: "0x...",
 *   blockNumber: 12340,
 *   contractAddress: "0x...",
 *   verifiedAt: "2025-12-16T17:30:00Z",
 *   isVerified: true
 * }
 */
