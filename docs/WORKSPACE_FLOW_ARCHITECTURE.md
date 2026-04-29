# Workspace Flow Architecture

## Overview

When a **client record** is created, a **Trust Workspace** can be created. This creates a file/database for that workspace. Across the platform, when logged in and a **workspace is chosen**, all data should populate for the consultant from:
- Assets
- Certificates
- Trust data (Ecclesiastical, Irrevocable, Revocable, Private, etc.)

Whatever input is provided becomes part of that particular workspace.

---

## Workspace Binding

**Key:** `smart_trust_platform_binding_v1` (localStorage)

**Shape:** `{ trustId?, clientId? }`

**Used by:** Trust Records, Site Builder, Trademark Prep, Securities, Ecclesiastical, Smart Trust

When a workspace is "opened" (selected in Trust Records or similar), the binding is set. Other pages read it to scope their data and save operations.

---

## Feature Scoping

| Feature | Workspace-scoped? | Save target |
|--------|-------------------|-------------|
| Assets | ✓ | Workspace |
| Certificates | ✓ | Workspace |
| Trust data | ✓ | Workspace |
| **Site Builder** | ✓ | Should save to currently opened workspace |
| **QR Code Generator** | ✓ | Should have save option → currently opened workspace |
| **AI Agents** | ✓ | Save to currently opened workspace when created/saved |
| **Admin NPCs** | ✗ | Platform-wide, admin-only |
| **User NPCs** | ✗ | Per-user, NOT workspace-specific |

---

## AI Agents (Workspace-specific)

- **Current:** Agents are scoped by `userId` only. No `workspaceId` / `trustId`.
- **Required:** When a consultant creates or saves an agent, it saves to the **workspace that is presently opened**.
- **Flow:**
  1. Read `smart_trust_platform_binding_v1` for active `trustId` (= workspaceId)
  2. List agents: filter by `userId` AND `workspaceId` (or `trustId`)
  3. Create agent: include `workspaceId` from binding
  4. Save agent: remains in same workspace

**Schema change:** Add `workspaceId` (or `trustId`) to `ai_agents` table.

---

## NPCs: Admin vs User

### Admin NPCs (admin-only)

- **Jarva** – Trust & Family Office Advisor
- **Atlas** – World Guide
- **Nova** – World Owner / Avatar
- **Ava** – Executive Secretary
- **Alex** – Virtual Receptionist

**Location:** `/admin/npc`

**Access:** Admin only. Regular users should NOT see or access these.

### User NPCs (consultant-created)

- **Not workspace-specific.** NPCs are created by users for their practice.
- **Required:** A dedicated page for users to see and create **their own** NPCs.
- **Flow:** User creates NPC → stored per user. Shown on user NPC page. Not tied to a workspace.

**New page needed:** e.g. `/app/npcs` or `/app/my-npcs` – "My NPCs"

---

## app/agents Page

**Current:** Shows AI Agents (create, edit, deploy). Accessible to any logged-in user in the app.

**Intended separation:**

1. **AI Agents** (`/app/agents`) – Workspace-scoped. Shows agents for the **currently opened workspace**. When saved, saves to that workspace.
2. **Admin NPCs** – Only at `/admin/npc`. Admin-only. Not on `/app/agents`.
3. **User NPCs** – Separate page (e.g. `/app/npcs`). User-created NPCs. Not workspace-specific.

**Clarification:** The "admin NPC" access on app/agents – if it exists, it should be removed or restricted. Admin NPCs live at `/admin/npc` only.

---

## Save to Workspace

### Site Builder

- Already reads binding for `trustId`, `clientId`, `workspaceId`.
- **Verify:** Save/publish flow writes to the correct workspace.

### QR Code Generator

- **Add:** "Save to workspace" option.
- On save, associate the QR with the currently opened workspace (`trustId` from binding).
- May require new table or metadata to link QR outputs to workspaces.

---

## Implementation Checklist

- [x] Add `workspaceId` to `ai_agents` table
- [x] Agents page: read workspace binding, filter/list agents by workspace
- [x] Agents page: create/save agents with `workspaceId`
- [x] Restrict `/admin/npc` to admin-only (verify)
- [x] Create `/app/npcs` – user NPCs page (create, list, manage)
- [x] Site Builder: verify save targets workspace
- [x] QR Maker: add "Save to workspace" and wire to binding
