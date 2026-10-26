import test from 'node:test';
import assert from 'node:assert/strict';
import { getTableColumns } from 'drizzle-orm';
import { agentConversationSessions as shared } from '../../src/lib/db/schema';
import { agentConversationSessions as runtime } from '../../src/lib/db/schema.app-runtime';
import { agentConversationSessions as marketplace } from '../../src/lib/db/schema.marketplace-extensions';
test('shared agent memory export selects runtime schema and preserves direct schemas', () => {
  assert.equal(shared, runtime);
  assert.notEqual(shared, marketplace);
  assert.deepEqual(Object.keys(getTableColumns(shared)), ['sessionKey','agentId','userId','turnsJson','updatedAt']);
  assert.equal(getTableColumns(shared).sessionKey.primary, true);
  assert.equal(Reflect.get(getTableColumns(shared).updatedAt, "hasOnUpdateNow"), undefined);
  assert.equal(Reflect.get(getTableColumns(marketplace).updatedAt, "hasOnUpdateNow"), true);
});
