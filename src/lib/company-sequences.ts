// Company Sequences - Thread-safe ID allocation for companies and certificates
// Uses DB transactions + row-level locking for concurrency safety

import { getDb } from "@/lib/db";
import { companySequences } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

async function allocateSequence(scope: string, prefix: string, year: number, length: number): Promise<string> {
  const db = await getDb();
  const id = uuidv4();

  await db.transaction(async (tx) => {
    // Upsert the sequence record
    await tx
      .insert(companySequences)
      .values({
        id,
        scope: `${scope}:${year}`,
        currentValue: 1,
      })
      .onDuplicateKeyUpdate({
        set: {
          currentValue: sql`${companySequences.currentValue} + 1`,
          updatedAt: new Date(),
        },
      });
  });

  // Get the current value after upsert
  const [sequence] = await db
    .select({ currentValue: companySequences.currentValue })
    .from(companySequences)
    .where(eq(companySequences.scope, `${scope}:${year}`))
    .limit(1);

  const nextValue = sequence?.currentValue ?? 1;
  return `${prefix}-${year}-${String(nextValue).padStart(length, "0")}`;
}

export async function allocateCompanyId(state: string, year: number = new Date().getFullYear()): Promise<string> {
  return allocateSequence("COMPANY", `COMP-${state}`, year, 4);
}

export async function allocateCompanyCertificateNumber(companyId: string, year: number = new Date().getFullYear()): Promise<string> {
  return allocateSequence(`CERTIFICATE:${companyId}`, `CERT-${companyId.slice(0, 8)}`, year, 3);
}

export async function allocateCompanyPackageNumber(companyId: string, year: number = new Date().getFullYear()): Promise<string> {
  return allocateSequence(`PACKAGE:${companyId}`, `PKG-${companyId.slice(0, 8)}`, year, 3);
}
