import type { MemberTermsDocument } from './terms-document';

export interface TermsReceipt { id: string; version: string; sha256: string; acceptedAt: string }
export interface TermsDatabase {
  execute(sql: string, params: Array<string | number>): Promise<[unknown, unknown]>;
}
export class TermsEligibilityError extends Error {}
function receipt(rows: unknown): TermsReceipt | null {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const row = rows[0] as Record<string, unknown>;
  if (!row || !/^[1-9][0-9]*$/.test(String(row.id)) || typeof row.version !== 'string' || typeof row.sha256 !== 'string' || typeof row.acceptedAt !== 'string') throw new Error('Invalid acceptance receipt');
  return {id: String(row.id), version: row.version, sha256: row.sha256, acceptedAt: row.acceptedAt};
}
export async function findTermsReceipt(db: TermsDatabase, memberId: number, terms: MemberTermsDocument): Promise<TermsReceipt | null> {
  const [rows] = await db.execute(
    `SELECT CAST(a.id AS CHAR) AS id, a.terms_version AS version, a.terms_sha256 AS sha256,
      DATE_FORMAT(a.accepted_at, '%Y-%m-%dT%H:%i:%s.%fZ') AS acceptedAt
     FROM mobile_terms_acceptances a JOIN marketplace_users u ON u.id = a.member_id
     JOIN mobile_terms_documents d ON d.terms_version = a.terms_version AND d.terms_sha256 = a.terms_sha256
     WHERE a.member_id = ? AND a.terms_version = ? AND a.terms_sha256 = ?
       AND u.isActive = 1 AND u.isApproved = 1 LIMIT 1`,
    [memberId, terms.version, terms.sha256],
  );
  return receipt(rows);
}
export function isTermsAcceptance(value: unknown, terms: MemberTermsDocument): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const input = value as Record<string, unknown>;
  return Object.keys(input).every(key => ['accepted','version','sha256'].includes(key))
    && input.accepted === true && input.version === terms.version && input.sha256 === terms.sha256;
}
export async function recordTermsAcceptance(db: TermsDatabase, memberId: number, terms: MemberTermsDocument): Promise<TermsReceipt> {
  // Retain the exact accepted copy independently of future source-code changes.
  await db.execute(
    `INSERT INTO mobile_terms_documents (terms_version, terms_sha256, title, content_html, archived_at)
     VALUES (?, ?, ?, ?, UTC_TIMESTAMP(3))
     ON DUPLICATE KEY UPDATE terms_sha256 = mobile_terms_documents.terms_sha256`,
    [terms.version, terms.sha256, terms.title, terms.html],
  );
  // One atomic statement: validate current eligibility and preserve the first server timestamp on retries.
  await db.execute(
    `INSERT INTO mobile_terms_acceptances (member_id, terms_version, terms_sha256, accepted_at)
     SELECT id, ?, ?, UTC_TIMESTAMP(3) FROM marketplace_users
     WHERE id = ? AND isActive = 1 AND isApproved = 1
       AND passwordHash IS NOT NULL AND passwordHash <> ''
     ON DUPLICATE KEY UPDATE member_id = mobile_terms_acceptances.member_id`,
    [terms.version, terms.sha256, memberId],
  );
  const result = await findTermsReceipt(db, memberId, terms);
  if (!result) throw new TermsEligibilityError('Eligible acceptance could not be recorded');
  return result;
}
