// src/lib/instruments/instrument-factory.ts
import { getDb } from "@/lib/db";
import { instruments, deeds, resolutions, exhibits } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { computeInstrumentHash, computeExecutedInstrumentHash } from "./hash";

export type InstrumentContext = {
  trustId: string | null;
  entityId: string | null;
};

/**
 * Validate that exactly one of trustId/entityId is provided
 */
function validateContext(ctx: InstrumentContext): void {
  const hasTrust = !!ctx.trustId;
  const hasEntity = !!ctx.entityId;
  if (hasTrust === hasEntity) {
    throw new Error("Exactly one of trustId or entityId must be provided");
  }
}

/**
 * Create an instrument record for a deed
 * 
 * This wraps an existing deed in the instrument abstraction.
 * The deed must already exist in the database.
 */
export async function createInstrumentForDeed(
  deedId: string,
  ctx: InstrumentContext
): Promise<string> {
  validateContext(ctx);

  const db = await getDb();

  // Fetch the deed to ensure it exists
  const deedRows = await db.select().from(deeds).where(eq(deeds.id, deedId)).limit(1);
  if (deedRows.length === 0) {
    throw new Error(`Deed ${deedId} not found`);
  }

  const deed = deedRows[0];

  // Verify context matches deed
  if (ctx.trustId && deed.trustId !== ctx.trustId) {
    throw new Error(`Deed trustId (${deed.trustId}) does not match context (${ctx.trustId})`);
  }
  if (ctx.entityId && deed.entityId !== ctx.entityId) {
    throw new Error(`Deed entityId (${deed.entityId}) does not match context (${ctx.entityId})`);
  }

  // Check if instrument already exists for this deed
  if (deed.instrumentId) {
    const existing = await db.select().from(instruments).where(eq(instruments.id, deed.instrumentId)).limit(1);
    if (existing.length > 0) {
      return existing[0].id; // Return existing instrument ID
    }
  }

  // Map deed status to instrument status
  const statusMap: Record<string, "draft" | "authorized" | "executed" | "recorded"> = {
    draft: "draft",
    pending: "draft",
    approved: "authorized",
    executed: "executed",
    recorded: "recorded",
    void: "draft", // Void deeds remain in draft status
  };
  const instrumentStatus = statusMap[deed.status] || "draft";

  // Create instrument record
  const instrumentId = uuidv4();
  const createdAt = deed.createdAt || new Date();
  const instrumentHash = computeInstrumentHash({
    trustId: ctx.trustId,
    entityId: ctx.entityId,
    instrumentType: "DEED",
    concreteId: deedId,
    createdAt,
  });

  await db.insert(instruments).values({
    id: instrumentId,
    trustId: ctx.trustId,
    entityId: ctx.entityId,
    instrumentType: "DEED",
    status: instrumentStatus,
    authorityResolutionId: deed.approvingResolutionId || null,
    concreteId: deedId,
    concreteType: "DEED",
    instrumentHash,
    executedAt: deed.status === "executed" || deed.status === "recorded" ? deed.updatedAt || null : null,
    recordedAt: deed.status === "recorded" ? deed.updatedAt || null : null,
    createdAt,
    updatedAt: deed.updatedAt || new Date(),
  });

  // Link instrument to deed
  await db.update(deeds).set({ instrumentId }).where(eq(deeds.id, deedId));

  return instrumentId;
}

/**
 * Create an instrument record for a resolution
 * 
 * This wraps an existing resolution in the instrument abstraction.
 */
export async function createInstrumentForResolution(
  resolutionId: string,
  ctx: InstrumentContext
): Promise<string> {
  validateContext(ctx);

  const db = await getDb();

  // Fetch the resolution to ensure it exists
  const resolutionRows = await db.select().from(resolutions).where(eq(resolutions.id, resolutionId)).limit(1);
  if (resolutionRows.length === 0) {
    throw new Error(`Resolution ${resolutionId} not found`);
  }

  const resolution = resolutionRows[0];

  // Check if instrument already exists for this resolution
  const existing = await db
    .select()
    .from(instruments)
    .where(and(
      eq(instruments.concreteId, resolutionId),
      eq(instruments.concreteType, "RESOLUTION")
    ))
    .limit(1);

  if (existing.length > 0) {
    return existing[0].id; // Return existing instrument ID
  }

  // Map resolution status to instrument status
  const statusMap: Record<string, "draft" | "authorized" | "executed"> = {
    draft: "draft",
    approved: "authorized",
    rejected: "draft",
  };
  const instrumentStatus = statusMap[resolution.status] || "draft";

  // Create instrument record
  const instrumentId = uuidv4();
  const createdAt = new Date(); // Resolutions table doesn't have createdAt, use current time
  const instrumentHash = computeInstrumentHash({
    trustId: ctx.trustId,
    entityId: ctx.entityId,
    instrumentType: "RESOLUTION",
    concreteId: resolutionId,
    createdAt,
  });

  await db.insert(instruments).values({
    id: instrumentId,
    trustId: ctx.trustId,
    entityId: ctx.entityId,
    instrumentType: "RESOLUTION",
    status: instrumentStatus,
    authorityResolutionId: null, // Resolutions are themselves authority
    concreteId: resolutionId,
    concreteType: "RESOLUTION",
    instrumentHash,
    createdAt,
    updatedAt: new Date(),
  });

  return instrumentId;
}

/**
 * Update instrument status when deed status changes
 * 
 * When a deed is executed, this also recomputes the instrument hash
 * to include the executed PDF hash for final verification.
 */
export async function updateInstrumentStatusForDeed(
  deedId: string,
  newDeedStatus: string
): Promise<void> {
  const db = await getDb();

  const deedRows = await db.select().from(deeds).where(eq(deeds.id, deedId)).limit(1);
  if (deedRows.length === 0 || !deedRows[0].instrumentId) {
    return; // No instrument linked, skip
  }

  const instrumentId = deedRows[0].instrumentId;
  const deed = deedRows[0];

  // Map deed status to instrument status
  const statusMap: Record<string, "draft" | "authorized" | "executed" | "recorded"> = {
    draft: "draft",
    pending: "draft",
    approved: "authorized",
    executed: "executed",
    recorded: "recorded",
    void: "draft",
  };
  const newInstrumentStatus = statusMap[newDeedStatus] || "draft";

  const updateData: Partial<typeof instruments.$inferInsert> = {
    status: newInstrumentStatus,
    updatedAt: new Date(),
  };

  // Set timestamps based on status
  const executedAt = newDeedStatus === "executed" || newDeedStatus === "recorded" 
    ? (deed.updatedAt || new Date())
    : null;
  
  if (executedAt) {
    updateData.executedAt = executedAt;
  }
  
  if (newDeedStatus === "recorded") {
    updateData.recordedAt = deed.updatedAt || new Date();
  }

  // If executing, recompute hash with executed PDF
  if (newDeedStatus === "executed" && deed.executedPdfExhibitId && executedAt) {
    // Fetch executed PDF exhibit to get its hash
    const exhibitRows = await db
      .select()
      .from(exhibits)
      .where(eq(exhibits.id, deed.executedPdfExhibitId))
      .limit(1);

    if (exhibitRows.length > 0) {
      const executedPdfHash = exhibitRows[0].hash;
      
      // Fetch current instrument to get base hash
      const instrumentRows = await db
        .select()
        .from(instruments)
        .where(eq(instruments.id, instrumentId))
        .limit(1);

      if (instrumentRows.length > 0) {
        const baseHash = instrumentRows[0].instrumentHash;
        const executedHash = computeExecutedInstrumentHash({
          baseInstrumentHash: baseHash,
          executedPdfHash,
          executedAt,
        });

        // Update instrument hash to executed hash
        updateData.instrumentHash = executedHash;
      }
    }
  }

  await db.update(instruments).set(updateData).where(eq(instruments.id, instrumentId));
}

/**
 * Check if instruments feature is enabled
 */
export function isInstrumentsEnabled(): boolean {
  return process.env.INSTRUMENTS_ENABLED !== "false"; // Default to enabled unless explicitly disabled
}
