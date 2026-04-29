import type { JobType } from "@/lib/jobs/types";
import { makeId, merchStore } from "@/lib/merch/mock-db";
import { getDb } from "@/lib/db";
import { merchJobs } from "@/lib/db/schema";
import { ensureMerchTables } from "@/lib/merch/db";

const nowIso = () => new Date().toISOString();

export async function enqueueJob(type: JobType, inputJson: Record<string, unknown>) {
  const id = makeId("job");
  const createdAt = nowIso();
  merchStore.jobs.unshift({
    id,
    type,
    status: "QUEUED",
    inputJson,
    createdAt,
    updatedAt: createdAt,
  });

  // Best-effort DB persistence for production environments.
  try {
    const db = await getDb();
    await ensureMerchTables(db);
    await db.insert(merchJobs).values({
      id,
      type,
      status: "QUEUED",
      inputJson,
    });
  } catch {
    // Intentionally non-fatal; in-memory mode can be inspected locally.
  }

  return id;
}

