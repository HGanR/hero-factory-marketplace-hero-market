import { z } from "zod";
import { protectedProcedure } from "../trpc";
import { ethers } from "ethers";
import { TrustVerification } from "../types/TrustVerification.interface";
import { db } from "../db";
import { trustRecords } from "../db/schema";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";

/**
 * Input validation schema for recordInstrument procedure
 */
const RecordInstrumentInput = z.object({
  trustId: z.string().min(1, "Trust ID is required"),
  trustName: z.string().min(1, "Trust name is required"),
  amount: z.string().regex(/^\d+(\.\d{1,18})?$/, "Invalid amount format"),
  beneficiary: z.string().min(1, "Beneficiary is required"),
  maturityDate: z.string().datetime("Invalid maturity date"),
  terms: z.string().min(1, "Terms are required"),
});

/**
 * Output schema for recordInstrument procedure
 */
const RecordInstrumentOutput = z.object({
  success: boolean,
  message: string,
  transactionHash: z.string().optional(),
  blockNumber: z.number().optional(),
  contractAddress: z.string().optional(),
  recordedAt: z.string().optional(),
  instrumentId: z.string(),
  documentHash: z.string(),
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
 * Helper function to check if issuer is authorized
 */
async function checkIssuerAuthorization(contract: TrustVerification): Promise<boolean> {
  try {
    const signer = contract.runner;
    if (!signer || typeof signer === "string") {
      throw new Error("Invalid signer");
    }

    const signerAddress = await signer.getAddress?.();
    if (!signerAddress) {
      throw new Error("Cannot get signer address");
    }

    const isAuthorized = await contract.isIssuerAuthorized(signerAddress);
    return isAuthorized;
  } catch (error) {
    console.error("Error checking issuer authorization:", error);
    return false;
  }
}

/**
 * Helper function to wait for transaction confirmation
 */
async function waitForConfirmation(
  txHash: string,
  provider: ethers.Provider,
  maxAttempts: number = 30
): Promise<{ blockNumber: number; gasUsed: bigint }> {
  let attempts = 0;

  while (attempts < maxAttempts) {
    const receipt = await provider.getTransactionReceipt(txHash);

    if (receipt) {
      return {
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed,
      };
    }

    attempts++;
    // Wait 2 seconds before retrying
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  throw new Error(`Transaction ${txHash} not confirmed after ${maxAttempts * 2} seconds`);
}

/**
 * tRPC procedure to record an instrument on Besu blockchain
 */
export const recordInstrumentProcedure = protectedProcedure
  .input(RecordInstrumentInput)
  .output(RecordInstrumentOutput)
  .mutation(async ({ input, ctx }) => {
    const userId = ctx.user.id;

    console.log(`[recordInstrument] Starting for user ${userId}, trust: ${input.trustId}`);

    try {
      // ====================================================================
      // Step 1: Validate Input
      // ====================================================================
      console.log("[recordInstrument] Step 1: Validating input");

      if (!input.trustId || !input.trustName || !input.amount) {
        throw new Error("Missing required fields");
      }

      // ====================================================================
      // Step 2: Check if Trust Exists in Database
      // ====================================================================
      console.log("[recordInstrument] Step 2: Checking if trust exists");

      const existingTrust = await db
        .select()
        .from(trustRecords)
        .where(
          and(
            eq(trustRecords.id, input.trustId),
            eq(trustRecords.userId, userId)
          )
        )
        .limit(1);

      if (existingTrust.length === 0) {
        throw new Error("Trust record not found");
      }

      const trust = existingTrust[0];

      // ====================================================================
      // Step 3: Create Document Hash
      // ====================================================================
      console.log("[recordInstrument] Step 3: Creating document hash");

      const documentHash = createDocumentHash({
        trustId: input.trustId,
        trustName: input.trustName,
        amount: input.amount,
        beneficiary: input.beneficiary,
        maturityDate: input.maturityDate,
        terms: input.terms,
      });

      const documentHashBytes32 = stringToBytes32(documentHash);

      console.log(`[recordInstrument] Document hash: ${documentHash}`);

      // ====================================================================
      // Step 4: Get Contract Instance
      // ====================================================================
      console.log("[recordInstrument] Step 4: Getting contract instance");

      const contract = await getContractInstance();
      const contractAddress = await contract.getAddress();

      console.log(`[recordInstrument] Contract address: ${contractAddress}`);

      // ====================================================================
      // Step 5: Check Issuer Authorization
      // ====================================================================
      console.log("[recordInstrument] Step 5: Checking issuer authorization");

      const isAuthorized = await checkIssuerAuthorization(contract);
      if (!isAuthorized) {
        throw new Error("Issuer not authorized to record instruments");
      }

      console.log("[recordInstrument] Issuer is authorized");

      // ====================================================================
      // Step 6: Prepare Transaction Parameters
      // ====================================================================
      console.log("[recordInstrument] Step 6: Preparing transaction parameters");

      const maturityDate = Math.floor(new Date(input.maturityDate).getTime() / 1000);
      const amountInWei = ethers.parseUnits(input.amount, 18);

      console.log(`[recordInstrument] Amount (Wei): ${amountInWei}`);
      console.log(`[recordInstrument] Maturity date (Unix): ${maturityDate}`);

      // ====================================================================
      // Step 7: Estimate Gas
      // ====================================================================
      console.log("[recordInstrument] Step 7: Estimating gas");

      let estimatedGas: bigint;
      try {
        estimatedGas = await contract.recordInstrument.estimateGas(
          input.trustId,
          amountInWei,
          maturityDate,
          input.beneficiary,
          documentHashBytes32
        );

        console.log(`[recordInstrument] Estimated gas: ${estimatedGas}`);
      } catch (error) {
        console.warn("[recordInstrument] Gas estimation failed, using default");
        estimatedGas = BigInt(500000); // Default gas limit
      }

      // ====================================================================
      // Step 8: Send Transaction
      // ====================================================================
      console.log("[recordInstrument] Step 8: Sending transaction to Besu");

      let tx;
      try {
        tx = await contract.recordInstrument(
          input.trustId,
          amountInWei,
          maturityDate,
          input.beneficiary,
          documentHashBytes32,
          {
            gasLimit: estimatedGas * BigInt(120) / BigInt(100), // Add 20% buffer
          }
        );

        console.log(`[recordInstrument] Transaction sent: ${tx.hash}`);
      } catch (error) {
        console.error("[recordInstrument] Transaction failed:", error);
        throw new Error(`Failed to send transaction: ${error instanceof Error ? error.message : String(error)}`);
      }

      // ====================================================================
      // Step 9: Wait for Confirmation
      // ====================================================================
      console.log("[recordInstrument] Step 9: Waiting for confirmation");

      const provider = new ethers.JsonRpcProvider(process.env.BESU_RPC_URL!);
      const { blockNumber, gasUsed } = await waitForConfirmation(tx.hash, provider);

      console.log(`[recordInstrument] Transaction confirmed in block ${blockNumber}`);
      console.log(`[recordInstrument] Gas used: ${gasUsed}`);

      // ====================================================================
      // Step 10: Update Database
      // ====================================================================
      console.log("[recordInstrument] Step 10: Updating database");

      const now = new Date();

      await db
        .update(trustRecords)
        .set({
          blockchainStatus: "recorded",
          transactionHash: tx.hash,
          blockNumber: blockNumber,
          contractAddress: contractAddress,
          verificationTimestamp: now,
          isVerified: false, // Will be verified in next step
          verificationAttempts: 0,
          lastVerificationAttempt: null,
          updatedAt: now,
        })
        .where(eq(trustRecords.id, input.trustId));

      console.log("[recordInstrument] Database updated successfully");

      // ====================================================================
      // Step 11: Return Success Response
      // ====================================================================
      console.log("[recordInstrument] Step 11: Returning success response");

      return {
        success: true,
        message: "Instrument recorded on blockchain successfully",
        transactionHash: tx.hash,
        blockNumber: blockNumber,
        contractAddress: contractAddress,
        recordedAt: now.toISOString(),
        instrumentId: input.trustId,
        documentHash: documentHash,
      };
    } catch (error) {
      console.error("[recordInstrument] Error:", error);

      // Update database with failure status
      try {
        await db
          .update(trustRecords)
          .set({
            blockchainStatus: "failed",
            verificationAttempts: (trust?.verificationAttempts || 0) + 1,
            lastVerificationAttempt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(trustRecords.id, input.trustId));
      } catch (dbError) {
        console.error("[recordInstrument] Failed to update database with error status:", dbError);
      }

      throw new Error(
        `Failed to record instrument: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  });

/**
 * Export the procedure for use in tRPC router
 */
export default recordInstrumentProcedure;

/**
 * Usage Example:
 * 
 * // In your React component
 * const { mutate: recordInstrument, isPending } = trpc.blockchain.recordInstrument.useMutation({
 *   onSuccess: (data) => {
 *     console.log("Instrument recorded:", data);
 *     toast.success("Instrument recorded on blockchain!");
 *   },
 *   onError: (error) => {
 *     console.error("Recording failed:", error);
 *     toast.error(error.message);
 *   },
 * });
 * 
 * // Call the mutation
 * recordInstrument({
 *   trustId: "trust-123",
 *   trustName: "Smith Family Trust",
 *   amount: "100000",
 *   beneficiary: "John Smith",
 *   maturityDate: "2026-12-16T00:00:00Z",
 *   terms: "Standard trust terms",
 * });
 */
