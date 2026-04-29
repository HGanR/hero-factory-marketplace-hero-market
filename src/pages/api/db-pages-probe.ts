import type { NextApiRequest, NextApiResponse } from "next";

const STAGE_MS = 3000;

function raceTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    }),
  ]);
}

/**
 * Pages Router Node: staged DB probe (same stages as App `diag-db`) to confirm `@/lib/db` works here.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const started = Date.now();
  const stages: { id: string; ms: number; ok: boolean; error?: string }[] = [];

  try {
    const t0 = Date.now();
    const drizzleMod = await raceTimeout(import("drizzle-orm"), STAGE_MS, "import-drizzle");
    const sql = drizzleMod.sql;
    if (typeof sql !== "function") {
      throw new Error("drizzle-orm: sql tag not found");
    }
    stages.push({ id: "import-drizzle", ms: Date.now() - t0, ok: true });

    const t1 = Date.now();
    const dbMod = await raceTimeout(import("@/lib/db"), STAGE_MS, "import-db");
    stages.push({ id: "import-db", ms: Date.now() - t1, ok: true });

    const t2 = Date.now();
    const db = await raceTimeout(dbMod.getDb(), STAGE_MS, "get-db");
    stages.push({ id: "get-db", ms: Date.now() - t2, ok: true });

    const t3 = Date.now();
    await raceTimeout(db.execute(sql`select 1 as ok`), STAGE_MS, "select-1");
    stages.push({ id: "select-1", ms: Date.now() - t3, ok: true });

    return res.status(200).json({
      ok: true,
      marker: "db-pages-probe-v1",
      runtime: "pages-node",
      node: process.version,
      stages,
      totalMs: Date.now() - started,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    const id =
      stages.length === 0
        ? "import-drizzle"
        : stages.length === 1
          ? "import-db"
          : stages.length === 2
            ? "get-db"
            : "select-1";
    if (!stages.some((s) => s.error)) {
      stages.push({ id, ms: 0, ok: false, error: err.slice(0, 400) });
    }
    return res.status(503).json({
      ok: false,
      marker: "db-pages-probe-v1",
      failedStage: stages.find((s) => s.error)?.id ?? id,
      stages,
      error: err.slice(0, 400),
      totalMs: Date.now() - started,
      node: process.version,
    });
  }
}
