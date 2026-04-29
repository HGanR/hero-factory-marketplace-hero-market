import crypto from "crypto";
import { sql } from "drizzle-orm";
import { ensureSiteBuilderRunLogTables, mysqlRows } from "@/lib/site-builder/db";

type Db = Awaited<ReturnType<typeof import("@/lib/db").getDb>>;

export async function insertSiteImportRun(
  db: Db,
  row: {
    siteId: string | null;
    versionId: string | null;
    userId: number;
    sourceUrl: string | null;
    fetchStatus: string;
    httpStatus: number | null;
    partial: boolean;
    homeBlockCount: number | null;
    reconstructionPath: string | null;
    notesJson: string | null;
    warningsJson: string | null;
    diffReportJson: string | null;
    errorMessage: string | null;
  },
): Promise<string> {
  await ensureSiteBuilderRunLogTables(db);
  const id = crypto.randomUUID();
  await db.execute(sql`
    INSERT INTO web3_site_import_runs (
      id, site_id, version_id, user_id, source_url, fetch_status, http_status, partial_import,
      home_block_count, reconstruction_path, notes_json, warnings_json, diff_report_json, error_message
    ) VALUES (
      ${id},
      ${row.siteId},
      ${row.versionId},
      ${row.userId},
      ${row.sourceUrl},
      ${row.fetchStatus},
      ${row.httpStatus},
      ${row.partial ? 1 : 0},
      ${row.homeBlockCount},
      ${row.reconstructionPath},
      ${row.notesJson},
      ${row.warningsJson},
      ${row.diffReportJson},
      ${row.errorMessage}
    )
  `);
  return id;
}

export async function listSiteImportRunsForSite(
  db: Db,
  siteId: string,
  limit: number,
): Promise<
  Array<{
    id: string;
    fetchStatus: string;
    sourceUrl: string | null;
    partial: boolean;
    homeBlockCount: number | null;
    createdAt: string | null;
    errorMessage: string | null;
  }>
> {
  await ensureSiteBuilderRunLogTables(db);
  const raw = await db.execute(sql`
    SELECT id, fetch_status, source_url, partial_import, home_block_count, created_at, error_message
    FROM web3_site_import_runs
    WHERE site_id = ${siteId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `);
  const rows = mysqlRows(raw);
  return rows.map((r) => ({
    id: String(r.id),
    fetchStatus: String(r.fetch_status),
    sourceUrl: r.source_url != null ? String(r.source_url) : null,
    partial: Boolean(Number(r.partial_import)),
    homeBlockCount: r.home_block_count != null ? Number(r.home_block_count) : null,
    createdAt: r.created_at != null ? String(r.created_at) : null,
    errorMessage: r.error_message != null ? String(r.error_message) : null,
  }));
}
