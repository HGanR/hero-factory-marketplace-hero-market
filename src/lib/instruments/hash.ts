// src/lib/instruments/hash.ts
import crypto from "crypto";

/**
 * Compute deterministic instrument hash for cross-ledger linkage
 * 
 * Hash includes only stable fields (not mutable metadata):
 * - trustId/entityId (context)
 * - instrumentType
 * - concreteId (reference to deed/resolution)
 * - createdAt (immutable timestamp)
 * 
 * Does NOT include:
 * - Status (mutable)
 * - executedAt/recordedAt (mutable)
 * - PII or full document bodies
 */
export function computeInstrumentHash(params: {
  trustId: string | null;
  entityId: string | null;
  instrumentType: string;
  concreteId: string;
  createdAt: Date | string;
}): string {
  // Enforce exactly one of trustId/entityId
  const hasTrust = !!params.trustId;
  const hasEntity = !!params.entityId;
  if (hasTrust === hasEntity) {
    throw new Error("Exactly one of trustId or entityId must be provided");
  }

  // Create canonical JSON string (sorted keys for determinism)
  const canonical = JSON.stringify({
    trustId: params.trustId || null,
    entityId: params.entityId || null,
    instrumentType: params.instrumentType,
    concreteId: params.concreteId,
    createdAt: typeof params.createdAt === "string" ? params.createdAt : params.createdAt.toISOString(),
  });

  // SHA-256 hash
  return crypto.createHash("sha256").update(canonical).digest("hex");
}

/**
 * Compute executed instrument hash (includes executed PDF hash)
 * 
 * This is the final hash computed at execution time, including:
 * - Base instrument hash (from creation)
 * - Executed PDF exhibit hash (if present)
 * - Execution timestamp
 * 
 * This hash represents the final, immutable state of the executed instrument.
 */
export function computeExecutedInstrumentHash(params: {
  baseInstrumentHash: string;
  executedPdfHash?: string | null;
  executedAt: Date | string;
}): string {
  const canonical = JSON.stringify({
    baseInstrumentHash: params.baseInstrumentHash,
    executedPdfHash: params.executedPdfHash || null,
    executedAt: typeof params.executedAt === "string" ? params.executedAt : params.executedAt.toISOString(),
  });

  return crypto.createHash("sha256").update(canonical).digest("hex");
}

/**
 * Compute witness hash for public notarization
 * 
 * Witness hash is a commitment to the executed instrument state.
 * Contains NO trust data, only a cryptographic commitment.
 * 
 * Uses the executed instrument hash (which includes PDF hash) for final verification.
 */
export function computeWitnessHash(params: {
  trustId: string | null;
  entityId: string | null;
  instrumentId: string;
  executedInstrumentHash: string; // Use executed hash (includes PDF)
  executedAt: Date | string;
}): string {
  const canonical = JSON.stringify({
    trustId: params.trustId || null,
    entityId: params.entityId || null,
    instrumentId: params.instrumentId,
    executedInstrumentHash: params.executedInstrumentHash,
    executedAt: typeof params.executedAt === "string" ? params.executedAt : params.executedAt.toISOString(),
  });

  return crypto.createHash("sha256").update(canonical).digest("hex");
}
