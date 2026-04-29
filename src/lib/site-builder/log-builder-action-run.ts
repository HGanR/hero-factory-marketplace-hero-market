import crypto from "crypto";
import { sql } from "drizzle-orm";
import type { BuilderAction } from "@/lib/site-builder/builder-actions/action-schemas";
import type { BuilderActionResult } from "@/lib/site-builder/builder-actions/execute-builder-actions";
import { ensureSiteBuilderRunLogTables, mysqlRows } from "@/lib/site-builder/db";

type Db = Awaited<ReturnType<typeof import("@/lib/db").getDb>>;

function summarizeActions(actions: BuilderAction[]): unknown[] {
  return actions.map((a) => ({ action: a.action }));
}

export async function insertBuilderActionRun(
  db: Db,
  row: {
    siteId: string | null;
    versionId: string | null;
    userId: number;
    source: string;
    actions: BuilderAction[];
    results: BuilderActionResult[];
    status: "success" | "partial" | "failed";
    errorMessage?: string | null;
    schemaHashBefore?: string | null;
    schemaHashAfter?: string | null;
  },
): Promise<string> {
  await ensureSiteBuilderRunLogTables(db);
  const id = crypto.randomUUID();
  await db.execute(sql`
    INSERT INTO web3_site_action_runs (
      id, site_id, version_id, user_id, source, action_count, actions_json, results_json,
      status, error_message, schema_hash_before, schema_hash_after
    ) VALUES (
      ${id},
      ${row.siteId},
      ${row.versionId},
      ${row.userId},
      ${row.source},
      ${row.actions.length},
      ${JSON.stringify(summarizeActions(row.actions))},
      ${JSON.stringify(row.results.map((r) => ({ action: r.action, ok: r.ok, message: r.message })))},
      ${row.status},
      ${row.errorMessage ?? null},
      ${row.schemaHashBefore ?? null},
      ${row.schemaHashAfter ?? null}
    )
  `);
  return id;
}

export async function listBuilderActionRunsForSite(
  db: Db,
  siteId: string,
  limit: number,
): Promise<
  Array<{
    id: string;
    source: string;
    actionCount: number;
    status: string;
    createdAt: string | null;
    errorMessage: string | null;
  }>
> {
  await ensureSiteBuilderRunLogTables(db);
  const raw = await db.execute(sql`
    SELECT id, source, action_count, status, created_at, error_message
    FROM web3_site_action_runs
    WHERE site_id = ${siteId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `);
  const rows = mysqlRows(raw);
  return rows.map((r) => ({
    id: String(r.id),
    source: String(r.source),
    actionCount: Number(r.action_count),
    status: String(r.status),
    createdAt: r.created_at != null ? String(r.created_at) : null,
    errorMessage: r.error_message != null ? String(r.error_message) : null,
  }));
}
