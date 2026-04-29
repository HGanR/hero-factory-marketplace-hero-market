# Developer Ecosystem Architecture

**Web3 Business Infrastructure OS — Platform → Ecosystem → Marketplace**

## Current State

- **Platform:** ~65 modules (Trust Records, Accounting, AI Agency, Oasis, Marketplace, etc.)
- **Gap:** No developer layer — only internal team creates modules
- **Target:** Platform + Developer Ecosystem + Marketplace (Shopify, Salesforce, WordPress model)

---

## Phase 1: Developer Platform Layer (5 Modules)

### 1. Developer Portal
**Route:** `/developers`

| Section | Purpose |
|---------|---------|
| Overview | Entry point, quick start |
| API Keys | Generate, rotate, revoke |
| Apps | Register OAuth apps, manage scopes |
| Webhooks | Configure event subscriptions |
| SDK Downloads | Plugin SDK, Agent SDK, API client |
| Marketplace Publishing | Submit apps/agents/plugins |
| Analytics | Usage, revenue, installs |

**Schema additions:**
- `developer_accounts` (userId, orgName, verified, createdAt)
- `api_keys` (developerId, keyHash, name, scopes, lastUsedAt)
- `developer_apps` (developerId, name, clientId, redirectUris, scopes)

---

### 2. Plugin / Extension SDK
**Routes:** `/plugins`, `/plugins/install`, `/plugins/publish`, `/plugins/[pluginId]`

**Manifest format:**
```json
{
  "name": "Trust Certificate Auto Generator",
  "version": "1.0",
  "permissions": ["trust_records", "documents"],
  "routes": ["/trust-records"],
  "webhooks": ["certificate_issued"],
  "entry": "https://cdn.example.com/plugin.js"
}
```

**Extension types:**
- Trust Records automation
- Accounting integrations
- Certificate generators
- AI workflow tools
- Oasis 3D assets
- CRM connectors

---

### 3. AI Agent SDK
**Route:** `/agents/developers`

**Capabilities:**
- Build AI assistants
- Train agents on workflows
- Connect agents to modules (entity_builder, trust_records, accounting)
- Publish agents to marketplace

**Agent definition:**
```json
{
  "agent_name": "Startup Advisor",
  "modules_access": ["entity_builder", "trust_records", "accounting"],
  "capabilities": ["business_formation", "financial_guidance", "document_generation"]
}
```

**Existing:** AI Agency + 67 agents — extend with developer-created agents.

---

### 4. Marketplace Publishing System
**Route:** `/marketplace/developers`

**Categories:**
- AI agents
- Plugins
- Site templates
- Oasis world assets
- Legal templates
- Automation workflows

**Revenue model:** Developer 80% / Platform 20%

---

### 5. Workflow Automation Engine
**Route:** `/workflows`

**Example:**
```json
{
  "trigger": "certificate_issued",
  "actions": [
    "create_accounting_entry",
    "send_client_notification",
    "generate_resolution"
  ]
}
```

**Triggers:** certificate_issued, entity_created, payment_received, etc.
**Actions:** create_accounting_entry, send_notification, generate_document, etc.

---

## Phase 2: Autonomous Business Engine

**Route:** `/business-engine`

**Combines:** Trust Records + AI Agents + AI Revenue OS

| Step | Module | Output |
|------|--------|--------|
| 1. Business Creation | Entity Builder, Trust Records | Entity structure, instruments, governance |
| 2. Infrastructure Setup | Accounting, CRM, Site Builder | Website, ledger, pipeline |
| 3. AI Business Agents | AI Agency | Sales, Marketing, Accounting, Operations agents |
| 4. Revenue System | Revenue OS | Revenue plan, campaigns, funnels |
| 5. Asset & Securities | Trust Records, Marketplace | NFTs, certificates, securities |
| 6. Governance | Trust Records | Minutes, resolutions |
| 7. Marketplace | NFT, Agent, Service marketplace | Revenue flow |

**Dashboard:** Create Business | Active Businesses | Revenue Dashboard | AI Agents | Automation Workflows

---

## Phase 3: UX Improvements

### 1. Guided Onboarding "Mission Path"
**Flow:** Create Account → Choose Goal → Follow Steps → Unlock Modules

**Goals:** Start Business | Launch AI Agent | Create Digital Asset | Issue Certificates | Build Website | Launch Campaign

**Example (Start Business):** Entity → Trust/Workspace → Assets → Accounting → Website → AI Agents

### 2. Role-Based Dashboards
| Role | Primary Modules |
|------|------------------|
| Entrepreneur | Business engine, Accounting, CRM, Site builder |
| Consultant | Client records, Trust Records, Compliance, Securities |
| Developer | Agents, APIs, Plugin tools, Marketplace publishing |

### 3. Platform Map
**Route:** `/platform-map`

**Visual hierarchy:**
```
Identity Layer (Wallet + Token Gate)
  → Workspace
    → Business Infrastructure (Trust Records, Accounting, Compliance)
    → Creation Tools (Site Builder, QR Maker, Seal Maker)
    → AI Layer (AI Agency, Revenue OS)
    → Marketplace (NFTs, Agents, Digital Assets)
    → 3D Ecosystem (Oasis World, NPC Agents)
```

Clickable nodes → open modules.

---

## Implementation Order

| Priority | Module | Effort | Status |
|----------|--------|--------|--------|
| 1 | Developer Portal (minimal) | 2–3 days | ✅ Done |
| 2 | Platform Map | 1 day | ✅ Done |
| 3 | Mission Path onboarding | 2–3 days | ✅ Done |
| 4 | API Keys + Webhooks | 2 days | Pending |
| 5 | Workflow Engine (core) | 3–4 days | Pending |
| 6 | Marketplace Publishing | 2–3 days | Pending |
| 7 | Plugin SDK | 4–5 days | Pending |
| 8 | Agent SDK (extend) | 2–3 days | Pending |
| 9 | Role-based dashboards | 2 days | Pending |
| 10 | Autonomous Business Engine | 5–7 days | Pending |

---

## Existing Primitives (Reuse)

- ✔ AI Agency (agents)
- ✔ Marketplace
- ✔ Entity builder
- ✔ Trust Records
- ✔ Accounting + Trust bridge
- ✔ Oasis 3D
- ✔ Token gating
- ✔ Client/Workspace model
