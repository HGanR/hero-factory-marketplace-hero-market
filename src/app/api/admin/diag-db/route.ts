import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STAGE_MS = 3000;

function raceTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    }),
  ]);
}

type Stage = { id: string; ms: number; ok: boolean; error?: string };

/**
 * DB pipeline probe: only `next/server` at top level. Each heavy step is dynamic-import + Promise.race.
 * `?probeDb=1` runs imports + getDb + SELECT 1; omit query param for a fast readiness JSON only.
 */
export async function GET(request: NextRequest) {
  const probeDb = request.nextUrl.searchParams.get("probeDb") === "1";
  const started = Date.now();
  const marker = "diag-db-v1-staged-imports";

  if (!probeDb) {
    return NextResponse.json({
      ok: true,
      marker,
      probeDb: false,
      timestamp: new Date().toISOString(),
      node: process.version,
      hint: "Add ?probeDb=1 to run import-drizzle → import-db → get-db → select-1",
    });
  }

  const stages: Stage[] = [];

  try {
    const t0 = Date.now();
    const drizzleMod = await raceTimeout(import("drizzle-orm"), STAGE_MS, "import-drizzle");
    const sql = drizzleMod.sql;
    if (typeof sql !== "function") {
      throw new Error("drizzle-orm: sql tag not found after import");
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

    return NextResponse.json({
      ok: true,
      marker,
      probeDb: true,
      stages,
      totalMs: Date.now() - started,
      node: process.version,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    const nextId =
      stages.length === 0
        ? "import-drizzle"
        : stages.length === 1
          ? "import-db"
          : stages.length === 2
            ? "get-db"
            : "select-1";
    if (!stages.some((s) => s.error)) {
      stages.push({ id: nextId, ms: 0, ok: false, error: err.slice(0, 400) });
    }
    return NextResponse.json(
      {
        ok: false,
        marker,
        probeDb: true,
        failedStage: stages.find((s) => s.error)?.id ?? nextId,
        stages,
        error: err.slice(0, 400),
        totalMs: Date.now() - started,
        node: process.version,
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
