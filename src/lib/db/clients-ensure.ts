import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";

let ensureClientColumnsPromise: Promise<void> | null = null;

export async function ensureClientsTitleColumn() {
  const db = await getDb();
  try {
    await db.execute(sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS title VARCHAR(80)`);
  } catch {
    /* column may already exist */
  }
}

/** Ensure columns for existing trust/entity (platform use for Meetings, Minutes, Resolutions as Witness). */
export async function ensureClientsExistingTrustColumns() {
  const db = await getDb();
  const alters: Array<() => Promise<unknown>> = [
    () => db.execute(sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS hasExistingTrust BOOLEAN NOT NULL DEFAULT FALSE`),
    () => db.execute(sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS existingEntityName VARCHAR(255)`),
    () => db.execute(sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS existingEntityPhone VARCHAR(50)`),
    () => db.execute(sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS existingEntityAddressLine1 VARCHAR(255)`),
    () => db.execute(sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS existingEntityAddressLine2 VARCHAR(255)`),
    () => db.execute(sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS existingEntityCity VARCHAR(120)`),
    () => db.execute(sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS existingEntityState VARCHAR(40)`),
    () => db.execute(sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS existingEntityPostalCode VARCHAR(20)`),
    () => db.execute(sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS existingEntityCountry VARCHAR(2)`),
  ];
  for (const alt of alters) {
    try {
      await alt();
    } catch {
      /* column may already exist */
    }
  }
}

export async function ensureClientsBrandingColumns() {
  const db = await getDb();
  const alters: Array<() => Promise<unknown>> = [
    () => db.execute(sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS logoUrl TEXT`),
    () => db.execute(sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS servicesJson TEXT`),
  ];
  for (const alt of alters) {
    try {
      await alt();
    } catch {
      /* column may already exist */
    }
  }
}

export async function ensureClientTableColumnsOnce() {
  if (!ensureClientColumnsPromise) {
    ensureClientColumnsPromise = (async () => {
      await ensureClientsTitleColumn();
      await ensureClientsExistingTrustColumns();
      await ensureClientsBrandingColumns();
    })().catch((err) => {
      ensureClientColumnsPromise = null;
      throw err;
    });
  }
  await ensureClientColumnsPromise;
}
