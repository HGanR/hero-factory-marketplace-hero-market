import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

// Exact additive SQL approved by the owner; never accept SQL or account identities as input.
const expectedHash = 'cb6593b2594697d264399bf6631e2a036c79a3315450c52faa61b0d25daddda5';
export async function applyAdministratorProfileSchema(connection) {
  const sql = await readFile(new URL('../../../scripts/sql/mobile-administrator-profiles.sql', import.meta.url), 'utf8');
  if (createHash('sha256').update(sql).digest('hex') !== expectedHash) throw Object.assign(new Error(), {code:'APPROVED_SCHEMA_MISMATCH'});
  await connection.execute({sql, timeout:10000});
  const [rows] = await connection.execute({sql:'SELECT administrator_username, banner_data, avatar_data, skin, updated_at FROM mobile_administrator_profiles WHERE 1 = 0',timeout:10000});
  if (!Array.isArray(rows) || rows.length) throw Object.assign(new Error(), {code:'UNEXPECTED_SCHEMA_CHECK_ROWS'});
  const [indexes] = await connection.execute({sql:"SELECT COLUMN_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'mobile_administrator_profiles' AND INDEX_NAME = 'PRIMARY' ORDER BY SEQ_IN_INDEX",timeout:10000});
  if (indexes.length !== 1 || indexes[0].COLUMN_NAME !== 'administrator_username') throw Object.assign(new Error(), {code:'ADMINISTRATOR_PROFILE_KEY_MISMATCH'});
  console.log('Administrator profile schema ready: approved table and username primary key verified; zero profile/member rows read or written.');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!process.argv.includes('--apply-owner-approved-schema')) {
    console.log('Administrator profile schema application not requested.');
  } else {
    let connection;
    const watchdog = setTimeout(()=>{console.error('Administrator profile schema failed: TIMEOUT');process.exit(1);},20000);
    try {
      if (!process.env.DATABASE_URL?.trim()) throw Object.assign(new Error(), {code:'DATABASE_NOT_CONFIGURED'});
      const {default:mysql} = await import('mysql2/promise');
      const {mysql2ConnectionOptionsFromUrl} = await import('../shared/src/lib/db/mysql2-connection-options.ts');
      connection = await mysql.createConnection(mysql2ConnectionOptionsFromUrl(process.env.DATABASE_URL));
      await applyAdministratorProfileSchema(connection);
    } catch (error) {
      const code = typeof error?.code === 'string' && /^[A-Z0-9_]+$/.test(error.code) ? error.code : 'SCHEMA_APPLICATION_FAILED';
      console.error('Administrator profile schema failed: '+code); process.exitCode=1;
    } finally {if(connection)await connection.end().catch(()=>{});clearTimeout(watchdog);}
  }
}
