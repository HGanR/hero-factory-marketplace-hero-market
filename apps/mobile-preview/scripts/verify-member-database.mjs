import mysql from 'mysql2/promise';
import { mysql2ConnectionOptionsFromUrl } from '../shared/src/lib/db/mysql2-connection-options.ts';

// Explicitly enabled only on the owner-approved shared-login branch.
if (process.env.SMART_TRUST_MOBILE_VERIFY_ACCOUNT_DB !== 'true') {
  console.log('Member database readiness: not requested for this build.');
} else {
  let connection;
  const watchdog = setTimeout(() => {
    console.error('Member database readiness failed: timeout.');
    process.exit(1);
  }, 20000);
  try {
    if (!process.env.DATABASE_URL?.trim()) throw Object.assign(new Error(), {code:'DATABASE_NOT_CONFIGURED'});
    connection = await mysql.createConnection(mysql2ConnectionOptionsFromUrl(process.env.DATABASE_URL));
    // Validate the actual login/profile schema without returning any member data.
    const [rows] = await connection.execute({
      sql: 'SELECT id, username, email, passwordHash, isActive, isApproved, walletAddress, lastLogin FROM marketplace_users WHERE 1 = 0',
      timeout: 10000,
    });
    if (!Array.isArray(rows) || rows.length !== 0) throw Object.assign(new Error(), {code:'UNEXPECTED_READINESS_RESULT'});
    console.log('Member database readiness: connection and login/profile columns verified; zero member rows returned; no writes performed.');
  } catch (error) {
    // Never log a connection string, credential, SQL error message or account data.
    const code = typeof error?.code === 'string' && /^[A-Z0-9_]{1,64}$/.test(error.code) ? error.code : 'CONNECTION_OR_SCHEMA_ERROR';
    console.error('Member database readiness failed: '+code);
    process.exitCode = 1;
  } finally {
    if (connection) await connection.end().catch(() => {});
    clearTimeout(watchdog);
  }
}
