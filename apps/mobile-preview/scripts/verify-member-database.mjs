import mysql from 'mysql2/promise';
import { mysql2ConnectionOptionsFromUrl } from '../shared/src/lib/db/mysql2-connection-options.ts';

// Explicitly enabled only on the owner-approved shared-login branch.
if (process.env.SMART_TRUST_MOBILE_VERIFY_ACCOUNT_DB !== 'true' && process.env.SMART_TRUST_MOBILE_TERMS_REQUIRED !== 'true' && process.env.SMART_TRUST_MOBILE_VERIFY_PROFILE_DB !== 'true') {
  console.log('Member database readiness: not requested for this build.');
} else {
  let connection;
  const watchdog = setTimeout(() => {
    console.error('Member database readiness failed: timeout.');
    process.exit(1);
  }, 20000);
  try {
    if (process.env.SMART_TRUST_MOBILE_TERMS_REQUIRED === 'true') {
      const {activeMemberTerms} = await import('../shared/src/lib/mobile/terms-document.ts');
      if (!activeMemberTerms()) throw Object.assign(new Error(), {code:'TERMS_DOCUMENT_NOT_PUBLISHED'});
    }
    if (!process.env.DATABASE_URL?.trim()) throw Object.assign(new Error(), {code:'DATABASE_NOT_CONFIGURED'});
    connection = await mysql.createConnection(mysql2ConnectionOptionsFromUrl(process.env.DATABASE_URL));
    // Validate the actual login/profile schema without returning any member data.
    const [rows] = await connection.execute({
      sql: 'SELECT id, username, email, passwordHash, isActive, isApproved, walletAddress, lastLogin FROM marketplace_users WHERE 1 = 0',
      timeout: 10000,
    });
    if (!Array.isArray(rows) || rows.length !== 0) throw Object.assign(new Error(), {code:'UNEXPECTED_READINESS_RESULT'});
    if (process.env.SMART_TRUST_MOBILE_TERMS_REQUIRED === 'true') {
      await connection.execute({sql:'SELECT terms_version, terms_sha256, title, content_html, archived_at FROM mobile_terms_documents WHERE 1 = 0',timeout:10000});
      await connection.execute({sql:'SELECT member_id, terms_version, terms_sha256, accepted_at FROM mobile_terms_acceptances WHERE 1 = 0',timeout:10000});
      console.log('Member terms readiness: published document and receipt schema verified; no acceptance created.');
    }
    if (process.env.SMART_TRUST_MOBILE_VERIFY_PROFILE_DB === 'true') {
      await connection.execute({sql:'SELECT member_id, skin, updated_at FROM mobile_member_appearance WHERE 1 = 0',timeout:10000});
      await connection.execute({sql:'SELECT member_id, banner_data, avatar_data, updated_at FROM mobile_member_profiles WHERE 1 = 0',timeout:10000});
      await connection.execute({sql:'SELECT userId, displayName, thumbnailUrl, isDefault, status, updatedAt FROM avatar_profiles WHERE 1 = 0',timeout:10000});
      await connection.execute({sql:'SELECT ownerId, id, name, visibility, status, updatedAt FROM worlds WHERE 1 = 0',timeout:10000});
      console.log('Member profile readiness: image, default-avatar and world columns verified; no member records read or changed.');
    }
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


