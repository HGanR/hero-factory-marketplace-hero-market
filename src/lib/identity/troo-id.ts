/**
 * Troo ID — resolve or create platform identity for a user
 */
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { trooIdentities, trooWalletLinks } from "@/lib/db/schema.identity";
import crypto from "crypto";

function generateId(): string {
  return crypto.randomUUID();
}

function generateTrooId(): string {
  const suffix = crypto.randomBytes(8).toString("hex");
  return `troo_${suffix}`;
}

/**
 * Get or create Troo identity for a user. Returns trooId.
 */
export async function resolveTrooId(userId: number): Promise<string> {
  const db = await getDb();
  const [existing] = await db
    .select()
    .from(trooIdentities)
    .where(eq(trooIdentities.userId, userId))
    .limit(1);

  if (existing) return existing.trooId;

  const id = generateId();
  const trooId = generateTrooId();
  await db.insert(trooIdentities).values({
    id,
    trooId,
    userId,
  });
  return trooId;
}

/**
 * Get Troo identity by userId. Returns null if not found.
 */
export async function getTrooIdentity(userId: number): Promise<{
  id: string;
  trooId: string;
  userId: number;
} | null> {
  const db = await getDb();
  const [row] = await db
    .select()
    .from(trooIdentities)
    .where(eq(trooIdentities.userId, userId))
    .limit(1);
  return row ?? null;
}

/**
 * Get Troo identity by trooId. Returns null if not found.
 */
export async function getTrooIdentityByTrooId(trooId: string): Promise<{
  id: string;
  trooId: string;
  userId: number;
} | null> {
  const db = await getDb();
  const [row] = await db
    .select()
    .from(trooIdentities)
    .where(eq(trooIdentities.trooId, trooId))
    .limit(1);
  return row ?? null;
}
