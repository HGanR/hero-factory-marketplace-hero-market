import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { and, asc, desc, eq, isNull, or } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { marketplaceUsers } from "@/lib/db/schema";
import {
  ptProperties,
  propertyTwinAssets,
  propertyTwinJobs,
  propertyTwinNodes,
} from "./schema";

/** @deprecated Use ptListPropertiesForUser — kept for scripts */
export async function ptListProperties() {
  const db = await getDb();
  return db.select().from(ptProperties).orderBy(desc(ptProperties.updatedAt));
}

export async function ptGetUserWallet(userId: number): Promise<string | null> {
  const db = await getDb();
  const rows = await db
    .select({ walletAddress: marketplaceUsers.walletAddress })
    .from(marketplaceUsers)
    .where(eq(marketplaceUsers.id, userId))
    .limit(1);
  return rows[0]?.walletAddress ?? null;
}

export async function ptCanAccessProperty(propertyId: number, userId: number): Promise<boolean> {
  const p = await ptGetProperty(propertyId);
  if (!p) return false;
  if (p.ownerUserId === userId) return true;
  if (p.ownerUserId == null && p.ownerWallet) {
    const w = await ptGetUserWallet(userId);
    if (!w) return false;
    return w.toLowerCase() === p.ownerWallet.toLowerCase();
  }
  return false;
}

export async function ptListPropertiesForUser(userId: number) {
  const db = await getDb();
  const wallet = await ptGetUserWallet(userId);
  const owned = eq(ptProperties.ownerUserId, userId);
  if (wallet) {
    const legacy = and(isNull(ptProperties.ownerUserId), eq(ptProperties.ownerWallet, wallet));
    return db
      .select()
      .from(ptProperties)
      .where(or(owned, legacy!))
      .orderBy(desc(ptProperties.updatedAt));
  }
  return db.select().from(ptProperties).where(owned).orderBy(desc(ptProperties.updatedAt));
}

export async function ptCanAccessJob(jobId: number, userId: number): Promise<boolean> {
  const job = await ptGetJob(jobId);
  if (!job) return false;
  return ptCanAccessProperty(job.propertyId, userId);
}

export async function ptCanAccessNode(nodeId: number, userId: number): Promise<boolean> {
  const n = await ptGetNode(nodeId);
  if (!n) return false;
  return ptCanAccessProperty(n.propertyId, userId);
}

export function ptGeneratePublicShareToken(): string {
  return randomBytes(32).toString("hex");
}

function ptShareTokensEqual(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, "utf8");
    const bb = Buffer.from(b, "utf8");
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

/** Validates opaque share token for read-only presentation (no session). */
export async function ptValidatePublicShare(propertyId: number, token: string | null): Promise<boolean> {
  if (!token || token.length < 32) return false;
  const p = await ptGetProperty(propertyId);
  if (!p?.publicShareToken) return false;
  return ptShareTokensEqual(p.publicShareToken, token);
}

export async function ptGetProperty(id: number) {
  const db = await getDb();
  const rows = await db.select().from(ptProperties).where(eq(ptProperties.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function ptCreateProperty(data: {
  name: string;
  slug?: string | null;
  description?: string | null;
  ownerWallet?: string | null;
  ownerUserId: number;
}) {
  const db = await getDb();
  const slug = data.slug?.trim() || `draft-${randomUUID()}`;
  await db.insert(ptProperties).values({
    name: data.name,
    slug,
    description: data.description ?? null,
    ownerWallet: data.ownerWallet ?? null,
    ownerUserId: data.ownerUserId,
  });
  const [row] = await db.select().from(ptProperties).where(eq(ptProperties.slug, slug)).limit(1);
  return row!;
}

export async function ptUpdateProperty(
  id: number,
  patch: Partial<{
    name: string;
    slug: string | null;
    description: string | null;
    ownerWallet: string | null;
    publicShareToken: string | null;
  }>
) {
  const db = await getDb();
  await db.update(ptProperties).set(patch as never).where(eq(ptProperties.id, id));
  return ptGetProperty(id);
}

export async function ptListAssets(propertyId: number) {
  const db = await getDb();
  return db
    .select()
    .from(propertyTwinAssets)
    .where(eq(propertyTwinAssets.propertyId, propertyId))
    .orderBy(desc(propertyTwinAssets.createdAt));
}

export async function ptCreateAsset(data: {
  propertyId: number;
  kind: (typeof propertyTwinAssets.$inferInsert)["kind"];
  url: string;
  mimeType?: string | null;
  originalFilename?: string | null;
  bytes?: number | null;
}) {
  const db = await getDb();
  await db.insert(propertyTwinAssets).values({
    propertyId: data.propertyId,
    kind: data.kind,
    url: data.url,
    mimeType: data.mimeType ?? null,
    originalFilename: data.originalFilename ?? null,
    bytes: data.bytes ?? null,
  });
  const [row] = await db
    .select()
    .from(propertyTwinAssets)
    .where(eq(propertyTwinAssets.propertyId, data.propertyId))
    .orderBy(desc(propertyTwinAssets.id))
    .limit(1);
  return row!;
}

export async function ptListJobs(propertyId: number) {
  const db = await getDb();
  return db
    .select()
    .from(propertyTwinJobs)
    .where(eq(propertyTwinJobs.propertyId, propertyId))
    .orderBy(desc(propertyTwinJobs.createdAt));
}

export async function ptGetJob(jobId: number) {
  const db = await getDb();
  const rows = await db.select().from(propertyTwinJobs).where(eq(propertyTwinJobs.id, jobId)).limit(1);
  return rows[0] ?? null;
}

export async function ptCreateJob(data: {
  propertyId: number;
  mode: (typeof propertyTwinJobs.$inferInsert)["mode"];
  status?: (typeof propertyTwinJobs.$inferInsert)["status"];
  inputAssetIds?: number[];
}) {
  const db = await getDb();
  await db.insert(propertyTwinJobs).values({
    propertyId: data.propertyId,
    mode: data.mode,
    status: data.status ?? "draft",
    progress: 0,
    inputAssetIds: data.inputAssetIds ?? [],
  });
  const [row] = await db
    .select()
    .from(propertyTwinJobs)
    .where(eq(propertyTwinJobs.propertyId, data.propertyId))
    .orderBy(desc(propertyTwinJobs.id))
    .limit(1);
  return row!;
}

export async function ptUpdateJob(
  jobId: number,
  patch: Partial<{
    status: (typeof propertyTwinJobs.$inferInsert)["status"];
    progress: number;
    errorMessage: string | null;
    outputUrl: string | null;
    inputAssetIds: number[];
    resultJson: (typeof propertyTwinJobs.$inferInsert)["resultJson"];
  }>
) {
  const db = await getDb();
  await db.update(propertyTwinJobs).set(patch as never).where(eq(propertyTwinJobs.id, jobId));
  return ptGetJob(jobId);
}

export async function ptListNodes(propertyId: number) {
  const db = await getDb();
  return db
    .select()
    .from(propertyTwinNodes)
    .where(eq(propertyTwinNodes.propertyId, propertyId))
    .orderBy(asc(propertyTwinNodes.zone), asc(propertyTwinNodes.sortOrder), asc(propertyTwinNodes.id));
}

export async function ptGetNode(nodeId: number) {
  const db = await getDb();
  const rows = await db.select().from(propertyTwinNodes).where(eq(propertyTwinNodes.id, nodeId)).limit(1);
  return rows[0] ?? null;
}

export async function ptCreateNode(data: {
  propertyId: number;
  zone: string;
  label: string;
  nodeType: string;
  sortOrder?: number;
  payload?: Record<string, unknown>;
  anchorX?: number | null;
  anchorY?: number | null;
  anchorZ?: number | null;
  estimatedCost?: number | null;
  estimatedValueLift?: number | null;
  roiPercent?: number | null;
}) {
  const db = await getDb();
  await db.insert(propertyTwinNodes).values({
    propertyId: data.propertyId,
    zone: data.zone,
    label: data.label,
    nodeType: data.nodeType,
    sortOrder: data.sortOrder ?? 0,
    payload: data.payload ?? null,
    anchorX: data.anchorX ?? null,
    anchorY: data.anchorY ?? null,
    anchorZ: data.anchorZ ?? null,
    estimatedCost: data.estimatedCost ?? null,
    estimatedValueLift: data.estimatedValueLift ?? null,
    roiPercent: data.roiPercent ?? null,
  });
  const [row] = await db
    .select()
    .from(propertyTwinNodes)
    .where(eq(propertyTwinNodes.propertyId, data.propertyId))
    .orderBy(desc(propertyTwinNodes.id))
    .limit(1);
  return row!;
}

export async function ptUpdateNode(
  nodeId: number,
  patch: Partial<{
    zone: string;
    label: string;
    nodeType: string;
    sortOrder: number;
    payload: Record<string, unknown> | null;
    anchorX: number | null;
    anchorY: number | null;
    anchorZ: number | null;
    estimatedCost: number | null;
    estimatedValueLift: number | null;
    roiPercent: number | null;
  }>
) {
  const db = await getDb();
  await db.update(propertyTwinNodes).set(patch as never).where(eq(propertyTwinNodes.id, nodeId));
  const rows = await db.select().from(propertyTwinNodes).where(eq(propertyTwinNodes.id, nodeId)).limit(1);
  return rows[0] ?? null;
}

export async function ptDeleteNode(nodeId: number) {
  const db = await getDb();
  await db.delete(propertyTwinNodes).where(eq(propertyTwinNodes.id, nodeId));
}
