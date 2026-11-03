/** Metadata-only diagnostic. Never invokes the revenue loop or an action executor. */
export const REQUIRED_COLUMNS: Record<string, readonly string[]> = {
  marketplace_users: ['id', 'username', 'isApproved', 'isActive'],
  entity_onboardings: ['id', 'userId', 'onboardingStatus', 'isRevoked'],
  platform_activity: ['id', 'userId', 'eventType', 'sourceModule', 'payload', 'trustId', 'createdAt'],
  executive_agent_memory_items: ['id', 'adminUserId', 'memoryType', 'subjectType', 'subjectId', 'title', 'summary', 'source', 'confidence', 'expiresAt', 'archivedAt', 'createdAt', 'updatedAt'],
  executive_agent_approvals: ['id', 'adminUserId', 'proposedAction', 'targetType', 'targetId', 'payloadJson', 'status', 'createdAt', 'executedAt'],
  executive_agent_audit_logs: ['id', 'adminUserId', 'prompt', 'toolName', 'actionType', 'targetType', 'targetId', 'inputJson', 'outputJson', 'approvalStatus', 'createdAt'],
};

const TABLES = Object.keys(REQUIRED_COLUMNS).map(name => `'${name}'`).join(', ');
// Fixed SQL only: no URL, body, identifier, or query parameter is interpolated.
export const READINESS_QUERIES = [
  "SELECT VERSION() AS version, DATABASE() AS databaseName, TIMESTAMPDIFF(SECOND, UTC_TIMESTAMP(), NOW()) AS utcOffsetSeconds",
  "SHOW SESSION VARIABLES WHERE Variable_name IN ('tidb_txn_mode','transaction_isolation','tx_isolation','autocommit','time_zone','sql_mode')",
  `SELECT TABLE_NAME, COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (${TABLES})`,
  `SELECT TABLE_NAME, COLUMN_NAME, SEQ_IN_INDEX FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND INDEX_NAME = 'PRIMARY' AND TABLE_NAME IN (${TABLES})`,
] as const;

type Row = Record<string, unknown>;
export type ReadinessConnection = { query: (sql: string) => Promise<unknown> };
const headers = { 'Cache-Control': 'private, no-store, max-age=0', 'Vary': 'Cookie' };
function response(body: unknown, status: number) {
  return Response.json(body, { status, headers });
}
function rows(result: unknown): Row[] {
  if (!Array.isArray(result) || !Array.isArray(result[0])) throw Error('Invalid database result');
  return result[0] as Row[];
}

export async function databaseReadinessResponse(deps: {
  authorize: () => Promise<number | null>;
  getConnection: () => Promise<ReadinessConnection>;
}): Promise<Response> {
  // Catch auth failures too; never include exceptions (which may contain credentials).
  let admin: number | null;
  try { admin = await deps.authorize(); }
  catch { return response({ error: 'AUTHENTICATION_UNAVAILABLE' }, 503); }
  if (admin == null) return response({ error: 'Unauthorized' }, 401);
  try {
    const connection = await deps.getConnection();
    // The same application connection is used for all four reads. No SET or writes.
    const info = rows(await connection.query(READINESS_QUERIES[0]))[0];
    if (!info || typeof info.version !== 'string' || !info.version) throw Error('Missing version');
    if (info.databaseName !== 'hero-market') {
      return response({ error: 'DATABASE_SELECTION_MISMATCH', expectedDatabase: 'hero-market' }, 409);
    }
    const settings = Object.fromEntries(rows(await connection.query(READINESS_QUERIES[1]))
      .map(row => [String(row.Variable_name), String(row.Value)]));
    const columns = rows(await connection.query(READINESS_QUERIES[2]));
    const primary = rows(await connection.query(READINESS_QUERIES[3]));
    const schema = Object.entries(REQUIRED_COLUMNS).map(([table, required]) => {
      const present = new Set(columns.filter(row => row.TABLE_NAME === table).map(row => row.COLUMN_NAME));
      const keys = primary.filter(row => row.TABLE_NAME === table);
      return {
        table,
        missingColumns: required.filter(column => !present.has(column)),
        idIsSolePrimaryKey: keys.length === 1 && keys[0].COLUMN_NAME === 'id',
      };
    });
    const isolation = settings.transaction_isolation ?? settings.tx_isolation ?? null;
    const strictMode = (settings.sql_mode ?? '').split(',').some(mode => ['STRICT_TRANS_TABLES', 'STRICT_ALL_TABLES'].includes(mode));
    const offset = info.utcOffsetSeconds;
    const checks = {
      utcClock: offset != null && Number(offset) === 0,
      pessimisticTransactions: settings.tidb_txn_mode === 'pessimistic',
      repeatableRead: isolation === 'REPEATABLE-READ',
      autocommit: settings.autocommit === 'ON',
      strictMode,
      requiredColumnsAndPrimaryKeys: schema.every(table => table.missingColumns.length === 0 && table.idIsSolePrimaryKey),
    };
    return response({
      ok: Object.values(checks).every(Boolean),
      scope: 'Application connection: session settings, required column names and primary keys only.',
      databaseVersion: info.version,
      database: 'hero-market',
      session: { ...Object.fromEntries(['tidb_txn_mode','transaction_isolation','tx_isolation','autocommit','time_zone','sql_mode'].filter(key => key in settings).map(key => [key, settings[key]])), utcOffsetSeconds: offset == null ? null : Number(offset) },
      checks, schema,
      readyForActivation: false,
      notVerified: ['Column types/defaults and secondary indexes', 'Driver date decoding', 'Live transaction locking/concurrency', 'Native Mac walkthrough', 'Membership collections'],
    }, 200);
  } catch {
    // Neither log nor echo SQL/driver/auth exceptions into this diagnostic response.
    return response({ error: 'DATABASE_READINESS_UNAVAILABLE' }, 503);
  }
}
