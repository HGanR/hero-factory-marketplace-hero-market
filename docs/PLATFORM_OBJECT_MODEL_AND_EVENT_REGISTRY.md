# Canonical Platform Object Model & Event Registry

This document formalizes the hidden architecture pattern of the platform: an **event-driven programmable economic operating system**.

---

## 1. Architecture Overview

```
Core Platform (App Plane)
│
├ Trust Records
├ Accounting
├ Securities
├ CRM
├ Marketplace
├ Entity Builder
├ AI Agency
│
Event Plane
│
├ certificate_issued
├ instrument_issued
├ collateral_pledged
├ proceeds_received
├ entity_created
├ accounting_event_processed
│
Control Plane
│
├ Workflow Engine (internal automations)
├ Webhook Layer (external integrations)
├ Platform Activity Stream (observability)
```

---

## 2. Canonical Object Model

Every major object is addressable by a stable ID. Cross-system references use these IDs.

| Object | ID Format | Schema Location | Cross-Refs |
|--------|-----------|-----------------|------------|
| **Client / User** | `userId` (int) | `users` | - |
| **Workspace** | `workspaceId` (uuid) | `workspaces` | userId |
| **Trust** | `trustId` (uuid) | `trusts` | userId, workspaceId |
| **Asset** | `assetId` (uuid) | `workflowTrustAssets`, `trustCollateralPoolAssets` | trustId |
| **Instrument** | `instrumentId` (uuid) | `trustInstruments` | trustId, workspaceId |
| **Certificate** | `certificateId` (uuid) | `securityCertificates`, `workflowAssetCertificates` | trustId, offeringId |
| **Accounting Entry** | `transactionId` (uuid) | `transactions` | trustId, instrumentId, assetId |
| **Workflow** | `workflowId` (uuid) | `workflow_automations` | userId |
| **Webhook** | `webhookId` (uuid) | `developer_webhooks` | userId |
| **Agent** | `agentId` (uuid) | agent sessions | trustId |
| **Campaign** | `campaignId` (uuid) | campaigns | workspaceId |
| **Document** | `documentId` (uuid) | `trustDocuments` | trustId |

### ID Conventions

- **UUID v4** for all entity IDs (trusts, instruments, certificates, etc.)
- **Integer** for `userId` (legacy)
- **Cross-system tags** on transactions: `instrumentId`, `assetId`, `brokerageAccountId`, `sourceEventId`

---

## 3. Event Registry

### Lifecycle

```
Entity Created
    ↓
Assets Registered
    ↓
Instrument Issued
    ↓
Certificate Issued
    ↓
Proceeds Received
    ↓
Accounting Event Processed
```

### Events

| Event | Source Module | Workflow Trigger | Webhook |
|-------|---------------|-----------------|---------|
| `certificate_issued` | Securities | ✓ | ✓ |
| `instrument_issued` | Trust Records | ✓ | ✓ |
| `collateral_pledged` | Trust Records | ✓ | ✓ |
| `proceeds_received` | Trust Records / Accounting | ✓ | ✓ |
| `entity_created` | Entity Builder | ✓ | - |
| `accounting_event_processed` | Accounting Bridge | ✓ | ✓ |
| `world_draft_saved` | Worlds | ✓ | ✓ |
| `world_published` | Worlds | ✓ | ✓ |

### Accounting Bridge Event Types (mapped to above)

- `INSTRUMENT_ISSUED` → `instrument_issued`
- `COLLATERAL_PLEDGED` → `collateral_pledged`
- `PROCEEDS_RECEIVED` → `proceeds_received`
- `INTEREST_PAID`, `BROKER_FEE_INCURRED`, etc. → `accounting_event_processed`

---

## 4. Webhook Payload Schema

All webhooks receive:

```json
{
  "event": "certificate_issued",
  "payload": { ... },
  "timestamp": "2025-03-12T12:00:00.000Z",
  "deliveryId": "del_abc123"
}
```

**Headers:**

- `X-Webhook-Event` — event name
- `X-Webhook-Delivery-Id` — unique delivery ID
- `X-Webhook-Timestamp` — ISO 8601
- `X-Webhook-Signature` — `sha256=<hex>` (HMAC-SHA256 of raw body with secret)

**Signature verification:**

```ts
const sig = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
// Compare with X-Webhook-Signature header (strip "sha256=" prefix)
```

---

## 5. Workflow Actions

| Action | Description | Status |
|--------|-------------|--------|
| `create_accounting_entry` | Create suggested transaction | Placeholder |
| `send_notification` | Send notification (email, webhook) | Placeholder |
| `generate_resolution` | Generate trust resolution document | Placeholder |
| `publish_to_inbox` | Publish follow-up event to accounting inbox | Placeholder |

---

## 6. Platform Activity Stream

- **Table:** `platform_activity`
- **API:** `GET /api/platform/events?limit=50`
- **Page:** `/platform/events`

Each row: `id`, `userId`, `eventType`, `sourceModule`, `payload`, `trustId`, `createdAt`

---

## 7. Central Event Emission

All platform events flow through:

- `emitPlatformEvent(triggerEvent, payload, userId)` — direct events (certificate_issued, entity_created)
- `emitAccountingPlatformEvent(sourceEventType, payload, userId)` — from accounting inbox processing

Each emission:

1. Logs to `platform_activity`
2. Runs matching workflows
3. Delivers to subscribed webhooks

---

## 8. Routes Reference

| Route | Purpose |
|-------|---------|
| `/developers` | Developer Portal (API keys, webhooks, workflows) |
| `/developers/events` | Event Registry (schemas, examples, docs) |
| `/platform/events` | Platform Activity Stream |
| `/workflows` | Workflow Automations UI |
| `/platform-map` | Visual map of platform layers |

---

## 9. Business Graph (Target State)

```
Client
 ├─ Workspace
 ├─ Trust
 │   ├─ Assets
 │   ├─ Instruments
 │   ├─ Governance
 │   └─ Accounting
 ├─ AI Agents
 ├─ Campaigns
 ├─ Websites
 └─ Marketplace Activity
```

All objects share the same entity graph. All state changes emit events. Workflows and webhooks subscribe. Agents operate on the same state.

---

## 10. Moat

The platform's defensibility is not any single page, but:

- Shared object model across 65+ modules
- Event plane connecting all modules
- Workflow engine for internal automation
- Webhook layer for external integration
- AI agents operating on platform state

A competitor can copy individual tools. Much harder to copy the integrated event-driven architecture.
