import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { merchJobs, merchRenders } from "@/lib/db/schema";
import { ensureMerchTables } from "@/lib/merch/db";
import { makeId } from "@/lib/merch/mock-db";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export type WorkerDbJob = {
  id: string;
  type: "RENDER" | "INPAINT" | "EXPORT_ZIP" | "EXPORT_PDF";
  status: "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED";
  input: Record<string, unknown>;
};

export async function pullNextJob(): Promise<WorkerDbJob | null> {
  const db = await getDb();
  await ensureMerchTables(db);
  const [job] = await db
    .select()
    .from(merchJobs)
    .where(eq(merchJobs.status, "QUEUED"))
    .orderBy(asc(merchJobs.createdAt))
    .limit(1);

  if (!job) return null;

  await db
    .update(merchJobs)
    .set({ status: "RUNNING", error: null })
    .where(and(eq(merchJobs.id, job.id), eq(merchJobs.status, "QUEUED")));

  const [claimed] = await db.select().from(merchJobs).where(eq(merchJobs.id, job.id)).limit(1);
  if (!claimed || claimed.status !== "RUNNING") return null;

  const input =
    claimed.inputJson && typeof claimed.inputJson === "object"
      ? (claimed.inputJson as Record<string, unknown>)
      : {};
  return {
    id: claimed.id,
    type: claimed.type as WorkerDbJob["type"],
    status: claimed.status as WorkerDbJob["status"],
    input,
  };
}

export async function finishJob(jobId: string, output: Record<string, unknown>) {
  const db = await getDb();
  await ensureMerchTables(db);
  await db
    .update(merchJobs)
    .set({
      status: "SUCCEEDED",
      outputJson: output,
      error: null,
    })
    .where(eq(merchJobs.id, jobId));
}

export async function failJob(jobId: string, errorMessage: string) {
  const db = await getDb();
  await ensureMerchTables(db);
  await db
    .update(merchJobs)
    .set({
      status: "FAILED",
      error: errorMessage,
    })
    .where(eq(merchJobs.id, jobId));
}

export async function saveRender(params: {
  versionId: string;
  kind: "MOCKUP_FRONT" | "MOCKUP_BACK" | "FLAT" | "LIFESTYLE";
  width: number;
  height: number;
  url: string;
  metadata?: Record<string, unknown>;
}) {
  const db = await getDb();
  await ensureMerchTables(db);
  await db.insert(merchRenders).values({
    id: makeId("render"),
    versionId: params.versionId,
    kind: params.kind,
    width: params.width,
    height: params.height,
    url: params.url,
    metadataJson: params.metadata || {},
  });
}

export async function pollNextJob(intervalMs = 1500) {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const job = await pullNextJob();
    if (job) return job;
    await sleep(intervalMs);
  }
}

