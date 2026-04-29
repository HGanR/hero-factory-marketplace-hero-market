import { NextResponse } from "next/server";

import { getConnection } from "@/lib/db";
import { getAuthedUserId } from "@/lib/api/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Authenticated DB smoke test: confirms DATABASE_URL resolves, TiDB/MySQL answers,
 * migration tracker row count, and key `clients` columns exist.
 */
export async function GET() {
  const userId = await getAuthedUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json(
      { ok: false, error: "DATABASE_URL is not set" },
      { status: 503 },
    );
  }

  const started = Date.now();
  let conn: Awaited<ReturnType<typeof getConnection>> | null = null;
  try {
    conn = await getConnection();
    await conn.query("SELECT 1 AS ok");

    let migrationCount: number | null = null;
    try {
      const [rows] = await conn.query<Array<{ c: number | bigint }>>(
        "SELECT COUNT(*) AS c FROM drizzle_sql_migrations",
      );
      const raw = rows?.[0]?.c;
      migrationCount = raw != null ? Number(raw) : null;
    } catch {
      migrationCount = null;
    }

    let clientsColumnCheck: { column: string; present: boolean }[] = [];
    try {
      const [rows] = await conn.query<Array<{ name: string }>>(
        `SELECT COLUMN_NAME AS name
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'clients'
           AND COLUMN_NAME IN (
             'logoUrl','servicesJson','title','hasExistingTrust','existingEntityName'
           )`,
      );
      const names = new Set(rows.map((r) => String(r.name)));
      for (const column of ["logoUrl", "servicesJson", "title", "hasExistingTrust", "existingEntityName"]) {
        clientsColumnCheck.push({ column, present: names.has(column) });
      }
    } catch {
      clientsColumnCheck = [];
    }

    const numberedMigrationFilesHint =
      "Count drizzle/NNNN_*.sql files in the repo; `migrationCount` should match applied rows after `npm run db:migrate:all`.";

    return NextResponse.json({
      ok: true,
      pingMs: Date.now() - started,
      migrationTable: "drizzle_sql_migrations",
      migrationCount,
      clientsColumnCheck,
      note:
        "There was no 0114 in the repo until clients branding SQL was added. If you only saw 0113 applied, run migrate again to pick up 0114_clients_branding_columns.sql.",
      hint: migrationCount != null ? numberedMigrationFilesHint : "Run npm run db:migrate:all once to create the migration tracker.",
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        pingMs: Date.now() - started,
        error: e instanceof Error ? e.message : String(e),
      },
      { status: 500 },
    );
  }
}
