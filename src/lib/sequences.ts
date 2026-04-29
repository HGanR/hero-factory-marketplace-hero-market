// Sequence allocator for CID/TID/AC/PN/SA/PKG numbering
import crypto from "crypto";
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { workflowSequences } from "@/lib/db/schema";

export async function allocateSequence(scope: string): Promise<number> {
  const db = await getDb();

  // Use a transaction to ensure atomicity
  const result = await db.transaction(async (tx) => {
    // First, try to get existing sequence
    const existing = await tx
      .select()
      .from(workflowSequences)
      .where(eq(workflowSequences.scope, scope))
      .limit(1);

    if (existing.length > 0) {
      // Increment existing sequence
      const newValue = existing[0].currentValue + 1;
      await tx
        .update(workflowSequences)
        .set({
          currentValue: newValue,
          updatedAt: sql`NOW()`,
        })
        .where(eq(workflowSequences.scope, scope));

      return newValue;
    } else {
      // Create new sequence starting at 1
      const id = crypto.randomUUID();
      await tx.insert(workflowSequences).values({
        id,
        scope,
        currentValue: 1,
        updatedAt: sql`NOW()`,
      });

      return 1;
    }
  });

  return result;
}

// Helper functions for specific sequence types
export async function allocateClientId(year: number = new Date().getFullYear()): Promise<string> {
  const seq = await allocateSequence(`CLIENT:${year}`);
  return `CID-${year}-${seq.toString().padStart(5, '0')}`;
}

export async function allocateTrustId(state: string, year: number = new Date().getFullYear()): Promise<string> {
  const seq = await allocateSequence(`TRUST:${state}:${year}`);
  return `TID-${state}-${year}-${seq.toString().padStart(4, '0')}`;
}

export async function allocateCertificateNumber(trustId: string, year: number = new Date().getFullYear()): Promise<string> {
  const seq = await allocateSequence(`CERT:${trustId}:${year}`);
  // Get the trust's public ID to include in the certificate number
  // For now, we'll use a placeholder - you should look up the actual TID
  return `AC-${trustId.slice(0, 8)}-${year}-${seq.toString().padStart(4, '0')}`;
}

export async function allocateNoteNumber(trustId: string, year: number = new Date().getFullYear()): Promise<string> {
  const seq = await allocateSequence(`NOTE:${trustId}:${year}`);
  return `PN-${trustId.slice(0, 8)}-${year}-${seq.toString().padStart(4, '0')}`;
}

export async function allocateAgreementNumber(trustId: string, year: number = new Date().getFullYear()): Promise<string> {
  const seq = await allocateSequence(`AGREEMENT:${trustId}:${year}`);
  return `SA-${trustId.slice(0, 8)}-${year}-${seq.toString().padStart(4, '0')}`;
}

export async function allocatePackageNumber(trustId: string, year: number = new Date().getFullYear()): Promise<string> {
  const seq = await allocateSequence(`PACKAGE:${trustId}:${year}`);
  return `PKG-${trustId.slice(0, 8)}-${year}-${seq.toString().padStart(4, '0')}`;
}
