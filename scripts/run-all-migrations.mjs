#!/usr/bin/env node
/**
 * Apply numbered SQL migrations under drizzle/ in order, with tracking in drizzle_sql_migrations.
 *
 * Includes only files matching: ^\d{4}_.+\.sql$ (e.g. 0031_revenue_os_live_modules.sql).
 * Unnumbered files (ret_sessions.sql, wreck_room_tables.sql, add-marketplace-phone.sql, …)
 * are not auto-applied — run them manually or via npm run db:migrate -- drizzle/<file>.sql
 *
 * Usage:
 *   node scripts/run-all-migrations.mjs
 *   node scripts/run-all-migrations.mjs --dry-run
 *   node scripts/run-all-migrations.mjs --mark-file drizzle/0031_revenue_os_live_modules.sql
 *   node scripts/run-all-migrations.mjs --mark-all
 *   node scripts/run-all-migrations.mjs --status
 *   node scripts/run-all-migrations.mjs --status --strict   (exit 1 if any pending or mismatch)
 *
 * Requires: DATABASE_URL in .env or .env.local (same as scripts/run-migration.mjs; TiDB SSL).
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });

import { createHash } from "crypto";
import { readdirSync, readFileSync } from "fs";
import { join, resolve } from "path";
import { createConnection } from "mysql2/promise";

const DRIZZLE_DIR = resolve(process.cwd(), "drizzle");
const NUMBERED_SQL = /^\d{4}_.+\.sql$/;
const MIGRATION_TABLE = "`drizzle_sql_migrations`";

function parseArgs(argv) {
  const dryRun = argv.includes("--dry-run");
  const markAll = argv.includes("--mark-all");
  const status = argv.includes("--status");
  const strict = argv.includes("--strict");
  const markIdx = argv.indexOf("--mark-file");
  const markFile = markIdx >= 0 && argv[markIdx + 1] ? resolve(process.cwd(), argv[markIdx + 1]) : null;
  return { dryRun, markAll, markFile, status, strict };
}

function getConnectionConfig() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set. Add it to .env or .env.local");
    process.exit(1);
  }
  const baseUrl = url.trim().replace(/^["']|["']$/g, "").split("?")[0];
  const parsed = new URL(baseUrl);
  return {
    host: parsed.hostname,
    port: parsed.port ? parseInt(parsed.port, 10) : 4000,
    user: parsed.username ? decodeURIComponent(parsed.username) : undefined,
    password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
    database: parsed.pathname?.replace(/^\//, "") || "hero-market",
    ssl: { rejectUnauthorized: false },
    multipleStatements: true,
  };
}

function listNumberedMigrationFiles() {
  const names = readdirSync(DRIZZLE_DIR).filter((n) => NUMBERED_SQL.test(n));
  names.sort((a, b) => {
    const na = parseInt(a.slice(0, 4), 10);
    const nb = parseInt(b.slice(0, 4), 10);
    if (na !== nb) return na - nb;
    return a.localeCompare(b);
  });
  return names.map((n) => join(DRIZZLE_DIR, n));
}

function cleanMigrationSql(sql) {
  // Drizzle emits `--> statement-breakpoint` on its own line OR inline after `;` (e.g. `...;--> statement-breakpoint`).
  // Inline `--` is NOT a valid MySQL/TiDB line comment (needs `-- ` with a space), so `;-->` breaks parsing.
  return sql
    .replace(/-->\s*statement-breakpoint/g, "")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
}

/** Schema may already exist from db:push or manual apply — treat as applied when safe. */
function isIdempotentDdlError(err) {
  const msg = String(err?.message ?? err ?? "").toLowerCase();
  const code = err?.errno ?? err?.code;
  if (code === 1060 || msg.includes("duplicate column")) return true;
  if (code === 1061 || msg.includes("duplicate key name")) return true;
  if (code === 1050 || msg.includes("already exists")) return true;
  return false;
}

function sha256(content) {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

async function ensureMigrationTable(conn) {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS ${MIGRATION_TABLE} (
      \`filename\` VARCHAR(512) NOT NULL PRIMARY KEY,
      \`checksum_sha256\` CHAR(64) NOT NULL,
      \`applied_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

async function getAppliedRows(conn) {
  const [rows] = await conn.query(
    `SELECT filename, checksum_sha256 FROM ${MIGRATION_TABLE}`
  );
  const map = new Map();
  for (const r of rows) {
    map.set(r.filename, r.checksum_sha256);
  }
  return map;
}

/** @returns {Promise<Map<string, { checksum: string, appliedAt: Date | string | null }>>} */
async function getAppliedRowsDetailed(conn) {
  const [rows] = await conn.query(
    `SELECT filename, checksum_sha256, applied_at FROM ${MIGRATION_TABLE}`
  );
  const map = new Map();
  for (const r of rows) {
    map.set(r.filename, { checksum: r.checksum_sha256, appliedAt: r.applied_at });
  }
  return map;
}

/** Relative path drizzle/NNNN_name.sql for storage key */
function migrationKey(absPath) {
  return `drizzle/${absPath.split(/[/\\]/).pop()}`;
}

async function runStatus(conn, files, strict) {
  const detailed = await getAppliedRowsDetailed(conn);
  const knownKeys = new Set(files.map((abs) => migrationKey(abs)));

  let pending = 0;
  let mismatch = 0;
  const rows = [];

  for (const abs of files) {
    const key = migrationKey(abs);
    const raw = readFileSync(abs, "utf8");
    const sum = sha256(raw);
    const rec = detailed.get(key);
    let state;
    if (!rec) {
      state = "PENDING";
      pending += 1;
    } else if (rec.checksum !== sum) {
      state = "MISMATCH";
      mismatch += 1;
    } else {
      state = "APPLIED";
    }
    rows.push({
      state,
      key,
      fileSha: sum,
      storedSha: rec ? rec.checksum : null,
      appliedAt: rec ? rec.appliedAt : null,
    });
  }

  const orphans = [];
  for (const [filename, rec] of detailed) {
    if (!knownKeys.has(filename)) {
      orphans.push({ filename, ...rec });
    }
  }

  const wState = 7;
  const wKey = Math.max(12, ...rows.map((r) => r.key.length), 20);
  console.log(
    `${"STATE".padEnd(wState)}  ${"FILENAME".padEnd(wKey)}  FILE_SHA256 (first 12)  STORED_SHA256 (first 12)  APPLIED_AT`
  );
  console.log("-".repeat(Math.min(120, wState + wKey + 80)));
  for (const r of rows) {
    const f = `${r.fileSha.slice(0, 12)}…`;
    const s = r.storedSha ? `${r.storedSha.slice(0, 12)}…` : "—";
    const at = r.appliedAt != null ? String(r.appliedAt) : "—";
    console.log(`${r.state.padEnd(wState)}  ${r.key.padEnd(wKey)}  ${f}  ${s}  ${at}`);
  }

  if (orphans.length > 0) {
    console.log("\nTracker rows not matching any current drizzle/NNNN_*.sql file (orphans):");
    for (const o of orphans) {
      console.log(`  ORPHAN  ${o.filename}  checksum=${o.checksum.slice(0, 12)}…  applied_at=${o.appliedAt}`);
    }
  }

  console.log(
    `\nSummary: ${rows.filter((r) => r.state === "APPLIED").length} applied, ${pending} pending, ${mismatch} mismatch` +
      (orphans.length ? `, ${orphans.length} orphan tracker row(s)` : "")
  );
  console.log(
    "Note: partial multi-statement failures are not detected here; fix DB and re-run or use --mark-file when sure."
  );

  if (strict && (pending > 0 || mismatch > 0)) {
    process.exit(1);
  }
}

async function main() {
  const { dryRun, markAll, markFile, status, strict } = parseArgs(process.argv.slice(2));
  const config = getConnectionConfig();
  const files = listNumberedMigrationFiles();

  if (files.length === 0) {
    console.error("No numbered migration files found in drizzle/");
    process.exit(1);
  }

  const conn = await createConnection(config);
  try {
    await ensureMigrationTable(conn);

    if (status) {
      await runStatus(conn, files, strict);
      return;
    }

    if (markFile) {
      const raw = readFileSync(markFile, "utf8");
      const key = migrationKey(markFile);
      const sum = sha256(raw);
      await conn.query(
        `INSERT INTO ${MIGRATION_TABLE} (\`filename\`, \`checksum_sha256\`) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE \`checksum_sha256\` = VALUES(\`checksum_sha256\`), \`applied_at\` = CURRENT_TIMESTAMP`,
        [key, sum]
      );
      console.log(`Marked as applied: ${key} (${sum.slice(0, 12)}…)`);
      return;
    }

    if (markAll) {
      for (const abs of files) {
        const raw = readFileSync(abs, "utf8");
        const key = migrationKey(abs);
        const sum = sha256(raw);
        await conn.query(
          `INSERT INTO ${MIGRATION_TABLE} (\`filename\`, \`checksum_sha256\`) VALUES (?, ?)
           ON DUPLICATE KEY UPDATE \`checksum_sha256\` = VALUES(\`checksum_sha256\`), \`applied_at\` = CURRENT_TIMESTAMP`,
          [key, sum]
        );
        console.log(`Marked: ${key}`);
      }
      console.log(`--mark-all complete (${files.length} files).`);
      return;
    }

    const applied = await getAppliedRows(conn);

    for (const abs of files) {
      const key = migrationKey(abs);
      const raw = readFileSync(abs, "utf8");
      const sum = sha256(raw);
      const prev = applied.get(key);

      if (prev === sum) {
        console.log(`Skip (already applied, same checksum): ${key}`);
        continue;
      }
      if (prev != null && prev !== sum) {
        console.error(
          `Migration file changed after apply: ${key}\n` +
            `  stored checksum: ${prev}\n` +
            `  file checksum:   ${sum}\n` +
            `Restore the file from version control or fix the database before continuing.`
        );
        process.exit(1);
      }

      const sql = cleanMigrationSql(raw);
      if (!sql) {
        console.warn(`Empty after cleanup, skipping: ${key}`);
        continue;
      }

      if (dryRun) {
        console.log(`Would apply: ${key}`);
        continue;
      }

      console.log(`Applying: ${key}`);
      try {
        await conn.query(sql);
      } catch (err) {
        if (!isIdempotentDdlError(err)) throw err;
        console.warn(`OK (already applied in DB, marking tracked): ${key} — ${err.message}`);
      }

      await conn.query(
        `INSERT INTO ${MIGRATION_TABLE} (\`filename\`, \`checksum_sha256\`) VALUES (?, ?)`,
        [key, sum]
      );
      applied.set(key, sum);
      console.log(`OK: ${key}`);
    }

    if (dryRun) {
      console.log("(dry-run: no changes written)");
    } else {
      console.log("All pending migrations applied.");
    }
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error("run-all-migrations failed:", err.message);
  process.exit(1);
});
