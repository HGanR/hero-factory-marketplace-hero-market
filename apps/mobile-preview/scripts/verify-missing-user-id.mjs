#!/usr/bin/env node
/**
 * Read-only proof that a user id is ABSENT from the isolated test
 * database, for the missing-user session check.
 *
 * Status: NOT RUN against any database. Review before first use.
 *
 * Why this exists: the profile route returns the same 403 for a
 * missing user as for an inactive/unapproved account, so the
 * missing-user check in check-preview-accounts.mjs can falsely pass
 * when its id actually belongs to a refused account. Guessing an id
 * (e.g. 999999999) does not establish absence. This script proves
 * absence with a single read-only SELECT before the checker runs.
 *
 * Read-only by construction: the only statement it issues is one
 * SELECT. It uses its own connection variable,
 * TEST_READONLY_DATABASE_URL, with the same confirmed-host/database
 * guards as the seed script, and the same TLS rule. The credential
 * must still be restricted at provisioning time (SELECT on
 * marketplace_users only); the script cannot create that restriction.
 * It prints the checked id and a row count of 0 — never row contents.
 *
 * Usage (from apps/mobile-preview, after `npm ci`):
 *   TEST_READONLY_DATABASE_URL='<read-only test-database URL>' \
 *   node scripts/verify-missing-user-id.mjs \
 *     --user-id <id> --confirmed-host <host> --confirmed-database <name>
 * Exit code 0: the id is absent (0 rows). Exit code 1: the id is
 * present, or any error occurred. Run this BEFORE check-preview-accounts.mjs
 * and pass --missing-user-verified only when it exits 0.
 */

import {
  confirmSeedTarget,
  parseSeedTarget,
} from './preview-test-helpers.mjs';

function fail(message, code = 2) {
  console.error(`verify-missing-user-id: ${message}`);
  process.exit(code);
}

function parseArgs(argv) {
  const args = { userId: null, confirmedHost: null, confirmedDatabase: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--user-id') args.userId = argv[++i];
    else if (argv[i] === '--confirmed-host') args.confirmedHost = argv[++i];
    else if (argv[i] === '--confirmed-database') args.confirmedDatabase = argv[++i];
    else fail(`unknown argument: ${argv[i]}\nUsage: node scripts/verify-missing-user-id.mjs --user-id <id> --confirmed-host <host> --confirmed-database <name>`);
  }
  if (args.userId === null) fail('--user-id is required.');
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const id = Number(args.userId);
  if (!Number.isSafeInteger(id) || id <= 0) fail('--user-id must be a positive integer.');

  // Guards run BEFORE any package import or connection.
  const rawUrl = process.env.TEST_READONLY_DATABASE_URL;
  if (!rawUrl?.trim()) fail('TEST_READONLY_DATABASE_URL is not set. Set it to a READ-ONLY credential for the ISOLATED test database (never a production URL).');
  let parsed;
  try {
    parsed = parseSeedTarget(rawUrl, process.env.TEST_DATABASE_SSL);
  } catch (error) {
    fail(error.message);
  }
  try {
    confirmSeedTarget(parsed, args.confirmedHost, args.confirmedDatabase);
  } catch (error) {
    fail(error.message, 3);
  }
  console.log(`Checking host=${parsed.host}:${parsed.port} database=${parsed.database} for user id=${id} (read-only; password never logged).`);

  const mysql = await import('mysql2/promise');
  const connection = await mysql.createConnection({
    host: parsed.host,
    port: parsed.port,
    user: parsed.user,
    password: decodeURIComponent(new URL(rawUrl.includes('://') ? rawUrl : `mysql://${rawUrl}`).password || ''),
    database: parsed.database,
    ssl: parsed.forceSsl ? { rejectUnauthorized: true } : undefined,
  });
  try {
    const [rows] = await connection.query(
      'SELECT `id` FROM `marketplace_users` WHERE `id` = ? LIMIT 1',
      [id],
    );
    if (rows.length > 0) {
      console.error(`verify-missing-user-id: id=${id} is PRESENT in ${parsed.database}. Do not use it as the missing-user id.`);
      process.exit(1);
    }
    console.log(`verify-missing-user-id: id=${id} is ABSENT from ${parsed.database} (0 rows). It may be used with --missing-user-verified.`);
  } finally {
    await connection.end().catch(() => {});
  }
}

main().catch((error) => {
  console.error(`verify-missing-user-id: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
