/**
 * Seed orchestration for the preview test database, separated from the
 * CLI so failure handling is injectable and testable without a live
 * database.
 *
 * This module NEVER calls process.exit and NEVER prints passwords. It
 * throws SeedRefusal (with an exit code) for refusals and rethrows
 * other errors unchanged. The caller maps errors to exit codes after
 * all cleanup has run.
 *
 * Failure-handling contract (the reason this module exists):
 * - Credentials are generated and SAVED (via store.save, flushed)
 *   BEFORE the transaction is attempted. A later failure therefore
 *   never loses the passwords.
 * - If the commit outcome is uncertain (commit throws) or any
 *   post-commit step fails, store.preserve() is called: recovery
 *   credentials are kept and the caller must warn loudly. The file is
 *   never deleted in that case.
 * - If failure happens before the commit is attempted (guards,
 *   pre-flights, generation, save, or a rolled-back transaction),
 *   store.discard() is called: nothing was committed, so the saved
 *   credentials are stale and the output is removed.
 * - The transaction is rolled back whenever it was begun and the
 *   commit did not succeed.
 *
 * The connection object needs only the mysql2/promise surface used
 * here: query(sql, params), beginTransaction, commit, rollback, end.
 * The queries issued are fixed strings (see below); test fakes can
 * dispatch on them. hashPassword is injected (production: bcrypt
 * hashSync with cost 10, the website's hashPassword). generatePassword
 * is injected for determinism in tests (production: random bytes).
 * store has save(credentials), discard(), preserve() — see the CLI
 * for the file/stdout implementations.
 */

import {
  SeedRefusal,
  diffColumns,
  generateTestPassword,
  grantsLookDangerous,
  unexpectedRowsMessage,
} from './preview-test-helpers.mjs';

const GRANTS_QUERY = 'SHOW GRANTS FOR CURRENT_USER()';
const COLUMNS_QUERY = 'SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?';
const EXISTING_QUERY = 'SELECT `email` FROM `marketplace_users`';
const DELETE_QUERY = 'DELETE FROM `marketplace_users` WHERE `email` IN (?)';
const INSERT_QUERY = 'INSERT INTO `marketplace_users` (`email`, `username`, `passwordHash`, `isActive`, `isApproved`, `walletAddress`, `hasTokenAccess`, `phone`, `smsConsent`, `revenueOsAccess`, `lastActiveTrustId`, `lastLogin`) VALUES (?, ?, ?, ?, ?, NULL, 0, NULL, 0, 1, NULL, NULL)';
const VERIFY_QUERY = 'SELECT `id`, `email`, `isActive`, `isApproved`, (`passwordHash` IS NOT NULL) AS `hasPassword` FROM `marketplace_users` WHERE `email` IN (?) ORDER BY `id`';

export async function seedAccounts({
  connection,
  hashPassword,
  schemaSql = null,
  database,
  accounts,
  expectedColumns,
  store,
  generatePassword = generateTestPassword,
  log = () => {},
}) {
  let txOpen = false;
  let commitAttempted = false;
  let saveAttempted = false;
  let storeSettled = false;

  const settleDiscard = async () => {
    if (!storeSettled) {
      storeSettled = true;
      await store.discard();
    }
  };
  const settlePreserve = async () => {
    if (!storeSettled) {
      storeSettled = true;
      await store.preserve();
    }
  };
  const rollbackQuietly = async () => {
    if (txOpen) {
      txOpen = false;
      try {
        await connection.rollback();
      } catch {
        // Rollback is best-effort; the original error is what matters.
      }
    }
  };

  try {
    // ---- Pre-flights: nothing mutated, nothing saved yet. ----
    let grantsText = '';
    try {
      const [grantRows] = await connection.query(GRANTS_QUERY);
      grantsText = grantRows.map((r) => Object.values(r)[0]).join('\n');
    } catch {
      log('Warning: could not read SHOW GRANTS; proceeding — the credential must still be the restricted test credential.');
    }
    if (grantsText && grantsLookDangerous(grantsText)) {
      throw new SeedRefusal('refusing: the seed credential holds dangerous grants. Use the restricted test credential from docs/mobile/PREVIEW-TEST-DATABASE.md.', 3);
    }

    if (schemaSql) {
      await connection.query(schemaSql);
      log('Applied test-schema.sql.');
    }

    const [columns] = await connection.query(COLUMNS_QUERY, [database, 'marketplace_users']);
    const { missing, extra } = diffColumns(columns.map((c) => c.COLUMN_NAME), expectedColumns);
    if (missing.length > 0) {
      throw new SeedRefusal(`pre-flight refused: marketplace_users is missing columns: ${missing.join(', ')}. Apply test-schema.sql to the correct database first.`, 3);
    }
    for (const c of extra) log(`Warning: unexpected extra column "${c}" — proceeding; login selects the whole row.`);

    const [existing] = await connection.query(EXISTING_QUERY);
    const syntheticEmails = new Set(accounts.map((a) => a.email));
    const unexpectedCount = existing.filter((r) => !syntheticEmails.has(r.email)).length;
    if (unexpectedCount > 0) throw new SeedRefusal(unexpectedRowsMessage(unexpectedCount), 3);

    // ---- Generate + SAVE credentials before attempting the commit. ----
    const credentials = accounts.map((a) => {
      const password = a.hasPassword ? generatePassword() : null;
      return {
        email: a.email,
        username: a.username,
        password,
        passwordHash: password === null ? null : hashPassword(password),
        isActive: a.isActive,
        isApproved: a.isApproved,
      };
    });
    saveAttempted = true;
    await store.save(credentials.map(({ email, username, password }) => ({ email, username, password })));

    // ---- Transaction. From here, commit outcome uncertainty preserves. ----
    await connection.beginTransaction();
    txOpen = true;
    try {
      const emails = accounts.map((a) => a.email);
      await connection.query(DELETE_QUERY, [emails]);
      for (const c of credentials) {
        await connection.query(INSERT_QUERY, [c.email, c.username, c.passwordHash, c.isActive ? 1 : 0, c.isApproved ? 1 : 0]);
      }
      commitAttempted = true;
      try {
        await connection.commit();
      } catch (error) {
        await rollbackQuietly();
        await settlePreserve();
        throw new SeedRefusal(`commit failed and its outcome is uncertain; recovery credentials were preserved — verify the database manually before retrying. (${error instanceof Error ? error.message : String(error)})`, 1);
      }
      txOpen = false;
    } catch (error) {
      if (error instanceof SeedRefusal) throw error;
      await rollbackQuietly();
      throw error;
    }

    // ---- Post-commit verification. Failure here preserves credentials. ----
    const [rows] = await connection.query(VERIFY_QUERY, [accounts.map((a) => a.email)]);
    if (rows.length !== accounts.length) {
      await settlePreserve();
      throw new SeedRefusal('verification failed: row count mismatch after seeding; recovery credentials were preserved — verify the database manually before retrying.', 1);
    }
    return { rows, credentials: credentials.map(({ email, username, password }) => ({ email, username, password })) };
  } catch (error) {
    if (!storeSettled && saveAttempted) {
      await rollbackQuietly();
      if (commitAttempted) await settlePreserve();
      else await settleDiscard();
    }
    throw error;
  }
}
