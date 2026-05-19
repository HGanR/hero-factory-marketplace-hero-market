import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildPendingClientsClaudeHandoff,
  toPublicPendingClientsHandoff,
} from "@/lib/executive-agent/pending-clients-handoff";
import type { PendingClientQueueItem } from "@/lib/executive-agent/pending-clients-handoff";

describe("buildPendingClientsClaudeHandoff", () => {
  it("builds summary line with service buckets", () => {
    const items: PendingClientQueueItem[] = [
      {
        id: "marketplace-1",
        marketplaceUserId: 1,
        crmClientId: "c-1",
        name: "John Smith",
        email: "john@example.com",
        username: "john",
        requestedService: "WEBSITE",
        requestedServices: ["WEBSITE"],
        status: "pending_approval",
        intakeType: "crm_intake",
        createdAt: "2026-05-18T14:22:00.000Z",
        notes: "Needs barber shop website with booking.",
        isActive: false,
      },
      {
        id: "marketplace-2",
        marketplaceUserId: 2,
        crmClientId: null,
        name: "jane",
        email: "jane@example.com",
        username: "jane",
        requestedService: null,
        requestedServices: [],
        status: "pending_approval",
        intakeType: "marketplace_signup",
        createdAt: "2026-05-17T10:00:00.000Z",
        notes: null,
        isActive: false,
      },
    ];
    const h = buildPendingClientsClaudeHandoff(items, { pendingAllTime: 3, pendingApprox30d: 2 });
    assert.equal(h.version, "1");
    assert.equal(h.counts.returned, 2);
    assert.match(h.summaryLine, /3 pending marketplace account/);
    assert.match(h.summaryLine, /WEBSITE|Website/i);
    assert.ok(h.suggestedPrompts.length >= 1);
    assert.equal(h.pendingClients.length, 2);
  });

  it("handles empty queue", () => {
    const h = buildPendingClientsClaudeHandoff([], { pendingAllTime: 0, pendingApprox30d: 0 });
    assert.match(h.summaryLine, /no marketplace accounts waiting/i);
  });

  it("public handoff omits pendingClients rows", () => {
    const items: PendingClientQueueItem[] = [
      {
        id: "marketplace-1",
        marketplaceUserId: 1,
        crmClientId: null,
        name: "Jane",
        email: "jane@example.com",
        username: "jane",
        requestedService: null,
        requestedServices: [],
        status: "pending_approval",
        intakeType: "marketplace_signup",
        createdAt: "2026-05-18T14:22:00.000Z",
        notes: null,
        isActive: false,
      },
    ];
    const full = buildPendingClientsClaudeHandoff(items, { pendingAllTime: 1, pendingApprox30d: 1 });
    const pub = toPublicPendingClientsHandoff(full);
    assert.equal("pendingClients" in pub, false);
    assert.equal(pub.summaryLine, full.summaryLine);
    assert.deepEqual(pub.counts, full.counts);
  });
});
