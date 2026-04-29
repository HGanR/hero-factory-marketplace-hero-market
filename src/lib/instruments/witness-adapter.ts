// src/lib/instruments/witness-adapter.ts
import { getDb } from "@/lib/db";
import { instruments, publicWitnesses } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { computeWitnessHash } from "./hash";
import path from "path";
import { pathToFileURL } from "url";

export type WitnessNetwork = "ethereum" | "polygon" | "besu" | "other";

export interface WitnessNotarizationResult {
  witnessId: string;
  network: WitnessNetwork;
  txHash: string;
  blockNumber: number | null;
  witnessHash: string;
  notarizedAt: Date;
}

export interface WitnessConfig {
  network: WitnessNetwork;
  enabled: boolean;
  // Besu-specific config (if network is "besu")
  besuRpcUrl?: string;
  besuChainId?: number;
  besuNotaryAddress?: string;
  besuNotaryPrivateKey?: string;
  besuNotaryAbi?: any; // Contract ABI
}

/**
 * Get witness configuration from environment variables
 */
function getWitnessConfig(): WitnessConfig {
  const network = (process.env.WITNESS_NETWORK || "besu") as WitnessNetwork;
  const enabled = process.env.WITNESS_ENABLED !== "false"; // Default to enabled

  return {
    network,
    enabled,
    besuRpcUrl: process.env.BESU_RPC_URL,
    besuChainId: process.env.BESU_CHAIN_ID ? parseInt(process.env.BESU_CHAIN_ID) : undefined,
    besuNotaryAddress: process.env.BESU_NOTARY_ADDRESS,
    besuNotaryPrivateKey: process.env.BESU_NOTARY_PRIVATE_KEY,
    besuNotaryAbi: process.env.BESU_NOTARY_ABI ? JSON.parse(process.env.BESU_NOTARY_ABI) : undefined,
  };
}

/**
 * Notarize an instrument on the public witness ledger (hash-only)
 * 
 * This function:
 * 1. Computes a witness hash (commitment to instrument state)
 * 2. Publishes ONLY the hash to blockchain (no trust data)
 * 3. Stores the witness receipt back in the private ledger
 * 
 * @param instrumentId - The instrument ID to notarize
 * @returns Witness notarization result with tx hash and block number
 */
export async function notarizeInstrumentAsWitness(
  instrumentId: string
): Promise<WitnessNotarizationResult> {
  const config = getWitnessConfig();

  if (!config.enabled) {
    throw new Error("Witness notarization is disabled (WITNESS_ENABLED=false)");
  }

  const db = await getDb();

  // Fetch instrument
  const instrumentRows = await db.select().from(instruments).where(eq(instruments.id, instrumentId)).limit(1);
  if (instrumentRows.length === 0) {
    throw new Error(`Instrument ${instrumentId} not found`);
  }

  const instrument = instrumentRows[0];

  // Instrument must be executed before witnessing
  if (!instrument.executedAt) {
    throw new Error(`Instrument ${instrumentId} must be executed before witnessing`);
  }

  // Check if already witnessed
  const existingWitness = await db
    .select()
    .from(publicWitnesses)
    .where(eq(publicWitnesses.instrumentId, instrumentId))
    .limit(1);

  if (existingWitness.length > 0) {
    // Return existing witness record
    const witness = existingWitness[0];
    return {
      witnessId: witness.id,
      network: witness.network as WitnessNetwork,
      txHash: witness.txHash,
      blockNumber: witness.blockNumber || null,
      witnessHash: witness.witnessHash,
      notarizedAt: witness.notarizedAt,
    };
  }

  // Compute witness hash (commitment to executed instrument state)
  // Use instrumentHash which should be the executed hash (includes PDF) if executed
  const witnessHash = computeWitnessHash({
    trustId: instrument.trustId,
    entityId: instrument.entityId,
    instrumentId: instrument.id,
    executedInstrumentHash: instrument.instrumentHash, // This is the executed hash
    executedAt: instrument.executedAt,
  });

  // Notarize on blockchain (hash-only, no content)
  let txHash: string;
  let blockNumber: number | null = null;

  if (config.network === "besu" && config.besuRpcUrl && config.besuNotaryAddress && config.besuNotaryPrivateKey) {
    try {
      // Dynamically import BesuWeb3Service at runtime (avoid build-time resolution)
      const modulePath = path.join(process.cwd(), "besu-bundle", "admin", "BesuWeb3Service");
      // eslint-disable-next-line @typescript-eslint/no-implied-eval
      const dynamicImport = new Function("p", "return import(p)");
      const BesuModule = await dynamicImport(pathToFileURL(modulePath).href);
      const BesuService = BesuModule.default;
      
      // Initialize Besu service
      const besuService = new BesuService({
        rpcUrl: config.besuRpcUrl,
        chainId: config.besuChainId || 1337,
      });

      // Connect wallet
      await besuService.connectWallet(config.besuNotaryPrivateKey);

      // Notarize witness hash (not the full document)
      const witnessData = Buffer.from(witnessHash, "hex");
      const metadata = JSON.stringify({
        instrumentId,
        instrumentType: instrument.instrumentType,
        trustId: instrument.trustId || null,
        entityId: instrument.entityId || null,
      });

      const result = await besuService.notarizeDocument(
        config.besuNotaryAddress,
        witnessData,
        instrument.instrumentType,
        metadata,
        config.besuNotaryAbi || [] // Default to empty ABI if not provided
      );

      txHash = result.hash;
      blockNumber = result.blockNumber;
    } catch (error: any) {
      console.error("Besu notarization error:", error);
      // Fall back to mock mode if Besu is not available
      console.warn(
        `Besu notarization failed, falling back to mock witness record: ${error.message}`
      );
      txHash = `mock_${witnessHash.substring(0, 16)}`;
      blockNumber = null;
    }
  } else {
    // For other networks or if Besu config is missing, create a mock witness record
    // In production, you would implement Ethereum/Polygon notarization here
    console.warn(
      `Witness network ${config.network} not fully implemented or config missing. Creating witness record without blockchain tx.`
    );
    txHash = `mock_${witnessHash.substring(0, 16)}`; // Mock tx hash for development
    blockNumber = null;
  }

  // Store witness record in private ledger
  const witnessId = uuidv4();
  await db.insert(publicWitnesses).values({
    id: witnessId,
    instrumentId: instrument.id,
    network: config.network,
    txHash,
    blockNumber,
    witnessHash,
    notarizedAt: new Date(),
  });

  // Update instrument status to "witnessed" if not already
  if (instrument.status !== "witnessed" && instrument.status !== "settled") {
    await db
      .update(instruments)
      .set({
        status: "witnessed",
        witnessedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(instruments.id, instrumentId));
  }

  return {
    witnessId,
    network: config.network,
    txHash,
    blockNumber,
    witnessHash,
    notarizedAt: new Date(),
  };
}

/**
 * Verify a witness notarization by recomputing the witness hash
 * and comparing it to the stored witness hash
 */
export async function verifyWitnessNotarization(instrumentId: string): Promise<{
  valid: boolean;
  witnessHash: string;
  storedWitnessHash: string | null;
  match: boolean;
}> {
  const db = await getDb();

  // Fetch instrument
  const instrumentRows = await db.select().from(instruments).where(eq(instruments.id, instrumentId)).limit(1);
  if (instrumentRows.length === 0) {
    throw new Error(`Instrument ${instrumentId} not found`);
  }

  const instrument = instrumentRows[0];

  if (!instrument.executedAt) {
    return {
      valid: false,
      witnessHash: "",
      storedWitnessHash: null,
      match: false,
    };
  }

  // Recompute witness hash
  const recomputedHash = computeWitnessHash({
    trustId: instrument.trustId,
    entityId: instrument.entityId,
    instrumentId: instrument.id,
    executedInstrumentHash: instrument.instrumentHash, // This is the executed hash
    executedAt: instrument.executedAt,
  });

  // Fetch stored witness
  const witnessRows = await db
    .select()
    .from(publicWitnesses)
    .where(eq(publicWitnesses.instrumentId, instrumentId))
    .limit(1);

  if (witnessRows.length === 0) {
    return {
      valid: false,
      witnessHash: recomputedHash,
      storedWitnessHash: null,
      match: false,
    };
  }

  const witness = witnessRows[0];
  const match = witness.witnessHash === recomputedHash;

  return {
    valid: match,
    witnessHash: recomputedHash,
    storedWitnessHash: witness.witnessHash,
    match,
  };
}
