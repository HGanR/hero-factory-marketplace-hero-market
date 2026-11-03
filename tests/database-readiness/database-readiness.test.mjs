import assert from 'node:assert/strict';
import { test } from 'node:test';
import { databaseReadinessResponse, REQUIRED_COLUMNS, READINESS_QUERIES } from '../../src/lib/executive-agent/database-readiness.ts';

function fixture(overrides = {}) {
  const data = [
    [{ version: '8.0.11-TiDB-v8.5.3-serverless', databaseName: 'hero-market', utcOffsetSeconds: 0 }],
    Object.entries({ tidb_txn_mode: 'pessimistic', transaction_isolation: 'REPEATABLE-READ', autocommit: 'ON', time_zone: 'SYSTEM', sql_mode: 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES' }).map(([Variable_name, Value]) => ({ Variable_name, Value })),
    Object.entries(REQUIRED_COLUMNS).flatMap(([TABLE_NAME, columns]) => columns.map(COLUMN_NAME => ({ TABLE_NAME, COLUMN_NAME }))),
    Object.keys(REQUIRED_COLUMNS).map(TABLE_NAME => ({ TABLE_NAME, COLUMN_NAME: 'id', SEQ_IN_INDEX: 1 })),
  ];
  const queries = [];
  const deps = {
    authorize: async () => 7,
    getConnection: async () => ({ query: async sql => {
      queries.push(sql);
      return [data[READINESS_QUERIES.indexOf(sql)], []];
    } }),
    ...overrides,
  };
  return { data, queries, run: () => databaseReadinessResponse(deps) };
}

test('uses only fixed metadata queries on the same connection and never claims activation readiness', async () => {
  const f = fixture(); const response = await f.run(); const result = await response.json();
  assert.equal(response.status, 200); assert.equal(result.ok, true);
  assert.equal(result.readyForActivation, false); assert.equal(result.schema.length, 6);
  assert.deepEqual(f.queries, [...READINESS_QUERIES]);
  assert.ok(f.queries.every(sql => /^(SELECT|SHOW)\b/.test(sql)));
  assert.ok(!f.queries.some(sql => /FOR UPDATE|\b(INSERT|DELETE|ALTER|SET|CREATE|DROP)\b/.test(sql)));
  assert.match(response.headers.get('cache-control'), /no-store/);
  assert.equal(response.headers.get('vary'), 'Cookie');
});
test('unauthorized request never opens diagnostic connection', async () => {
  const f = fixture({ authorize: async () => null, getConnection: () => { throw Error('must not run'); } });
  const r = await f.run(); assert.equal(r.status, 401); assert.deepEqual(f.queries, []);
});
test('auth exception is redacted', async () => {
  const f = fixture({ authorize: async () => { throw Error('secret-cookie'); } });
  const r = await f.run(); assert.equal(r.status, 503); assert.ok(!(await r.text()).includes('secret-cookie'));
});
test('connection exception never leaks driver credentials', async () => {
  const f = fixture({ getConnection: async () => { throw Error('mysql://user:password@private-host'); } });
  const r = await f.run(); assert.equal(r.status, 503); assert.equal(await r.text(), '{"error":"DATABASE_READINESS_UNAVAILABLE"}');
});
test('wrong database fails before schema reads and never exposes its actual name', async () => {
  const f = fixture(); f.data[0][0].databaseName = 'private-other-database';
  const r = await f.run(); assert.equal(r.status, 409); assert.equal(f.queries.length, 1);
  assert.ok(!(await r.text()).includes('private-other-database'));
});
test('missing column and composite primary key are reported as failed checks', async () => {
  const f = fixture(); f.data[2] = f.data[2].filter(row => row.COLUMN_NAME !== 'archivedAt');
  f.data[3].push({ TABLE_NAME: 'executive_agent_memory_items', COLUMN_NAME: 'adminUserId', SEQ_IN_INDEX: 2 });
  const result = await (await f.run()).json(); assert.equal(result.ok, false);
  const memory = result.schema.find(row => row.table === 'executive_agent_memory_items');
  assert.deepEqual(memory.missingColumns, ['archivedAt']); assert.equal(memory.idIsSolePrimaryKey, false);
});
for (const [name, mutate, check] of [
  ['non-UTC clock', f => { f.data[0][0].utcOffsetSeconds = 3600; }, 'utcClock'],
  ['unknown clock', f => { f.data[0][0].utcOffsetSeconds = null; }, 'utcClock'],
  ['optimistic mode', f => { f.data[1].find(r => r.Variable_name === 'tidb_txn_mode').Value = 'optimistic'; }, 'pessimisticTransactions'],
  ['missing isolation', f => { f.data[1] = f.data[1].filter(r => r.Variable_name !== 'transaction_isolation'); }, 'repeatableRead'],
  ['non-strict SQL', f => { f.data[1].find(r => r.Variable_name === 'sql_mode').Value = ''; }, 'strictMode'],
]) test(name + ' cannot produce a passing diagnostic', async () => {
  const f = fixture(); mutate(f); const result = await (await f.run()).json();
  assert.equal(result.ok, false); assert.equal(result.checks[check], false);
});
test('unexpected server settings and member data are never returned', async () => {
  const f = fixture(); f.data[1].push({ Variable_name: 'password', Value: 'secret' });
  f.data[0][0].memberEmail = 'private@example.invalid';
  const body = await (await f.run()).text(); assert.ok(!body.includes('secret')); assert.ok(!body.includes('private@example.invalid'));
});

// Import the actual Next route; replace only auth/connection transports via Node hooks.
// Its production import paths must resolve through these adapters for the test to pass.
test('real GET route enforces existing executive auth before using the application connection', async () => {
  const { registerHooks } = await import('node:module');
  const coreUrl = new URL('../../src/lib/executive-agent/database-readiness.ts', import.meta.url).href;
  const moduleUrl = source => 'data:text/javascript,' + encodeURIComponent(source);
  const hooks = registerHooks({ resolve(specifier, context, next) {
    if (specifier === '@/lib/admin/get-executive-admin-user-id') return { url: moduleUrl('export const getExecutiveAdminUserId = req => globalThis.__readinessAuth(req);'), shortCircuit: true };
    if (specifier === '@/lib/db') return { url: moduleUrl('export const getConnection = () => globalThis.__readinessConnection();'), shortCircuit: true };
    if (specifier === '@/lib/executive-agent/database-readiness') return { url: coreUrl, shortCircuit: true };
    return next(specifier, context);
  } });
  try {
    const { GET, dynamic, runtime } = await import('../../src/app/api/admin/executive-agent/database-readiness/route.ts');
    assert.equal(dynamic, 'force-dynamic'); assert.equal(runtime, 'nodejs');
    const req = new Request('https://example.invalid/api/admin/executive-agent/database-readiness?sql=DROP');
    globalThis.__readinessAuth = seen => { assert.equal(seen, req); return null; };
    globalThis.__readinessConnection = () => { throw Error('Unauthorized connection access'); };
    assert.equal((await GET(req)).status, 401);
    const f = fixture(); let connections = 0;
    globalThis.__readinessAuth = () => 7;
    globalThis.__readinessConnection = async () => {
      connections++;
      return { query: async sql => { f.queries.push(sql); return [f.data[READINESS_QUERIES.indexOf(sql)], []]; } };
    };
    const response = await GET(req);
    assert.equal((await response.json()).ok, true); assert.equal(connections, 1);
    assert.deepEqual(f.queries, [...READINESS_QUERIES]);
  } finally {
    hooks.deregister(); delete globalThis.__readinessAuth; delete globalThis.__readinessConnection;
  }
});
