# Hero Market — Step-by-Step App Guide

**For:** Trust and estate consultants  
**Last updated:** February 2026  

---

## Overview

Hero Market helps consultants create and manage trust workspaces for clients. **Jarva** is your trust structuring aid—it prompts you to ask clients the right questions and guides you through the platform.

---

## Part 1: Getting Started

### Step 1: Access the app
1. Go to the Hero Market homepage.
2. **Register** (or **Login** if you have an account).
3. Use email/username and password to sign in.

### Step 2: Reach the main hub
- From the homepage, go to **Dashboard** or **Trust Records**.
- Use the dashboard links: Trust Records, Digital Asset Trust, Star Fleet, Community, etc.

---

## Part 2: Trust Structuring Flow (Consultant)

This is the primary workflow for creating a trust for a client.

### Step 3: Create a client
1. Go to **Clients** → **New Client** (`/clients/new`).
2. Enter:
   - First name, middle name, last name, suffix
   - Email (required)
   - Phone
   - Full address (line 1, line 2, city, state, postal code, country)
3. Save the client.
4. You are taken to the client profile with a **Client ID**.

### Step 4: Create a trust workspace
1. On the client profile (`/clients/[clientId]`), click **Create Trust**.
2. In the dialog:
   - Choose **Trust type** (Revocable Living Trust, Irrevocable Trust, Testamentary Trust, Special Purpose Trust).
   - Choose **State / jurisdiction**.
   - Set **Trust name** (e.g. auto-generated like "The [Client Name] Revocable Living Trust dated [Date]").
3. Click **Create**.
4. Grantor and trustee are **auto-filled from the client** (name and address).
5. You are redirected to the trust workspace (`/trusts/[trustId]`).

### Step 5: Open Trust Records
1. Go to **Trust Records** (`/trust-records`).
2. Use **Platform Binding** to set:
   - **Client ID** (from Step 3).
   - **Workspace ID** (trust ID from Step 4).
3. Select your workspace from the dropdown.
4. The workspace loads and applies auto-filled grantor/trustee data.

---

## Part 3: Using Trust Records with Jarva

### Step 6: Work through the tabs (Settings → Assets → Issue → Certificates)

**Settings (first)**
- Review and adjust:
  - Entity Type, Entity Name
  - Grantor name and address (pre-filled from client)
  - Trustee name and address (pre-filled for revocable living trusts)
- If needed, click **Fill from client** to refresh from the client record.
- Set Trust Category, Formation Mode, Governance Mode, seal, certificate prefix.
- Click **Save** to persist.

**Assets**
- Add trust property (res): cash, real estate, securities, etc.
- Enter name, type, description, and value.
- Assets must exist before issuing certificates.

**Issue**
- Select backing assets.
- Enter denomination and beneficial owner name.
- Issue the certificate.

**Certificates**
- View and manage issued certificates in the registry.

### Step 7: Use Jarva along the way
- Click the **"Your trust structuring aid"** bubble (bottom right) to open Jarva.
- Use prompts such as:
  - **"What are my next steps?"**
  - **"What should I ask my client?"**
  - **"Client interview checklist for trust formation"**
- Jarva answers based on the current tab (Settings, Assets, etc.).

---

## Part 4: Other Paths

### Smart Trust wizard
1. Go to **Smart Trust** (`/smart-trust`).
2. Bind a client and workspace (or create them).
3. Use the wizard to choose entity type, trust type, governing law, parties, and assets.
4. Sync the draft to Trust Records when ready.

### Ecclesiastical Trust
1. Go to **Ecclesiastical** (`/ecclesiastical`).
2. Follow the ecclesiastical trust formation flow.
3. Bind client and create workspace from there.

### App features (Contacts, Automations, Voice Agents)
1. Go to **App** → **Dashboard** (`/app/dashboard`).
2. Use:
   - Contacts
   - Pipelines
   - Conversations
   - Automations
   - Calendar
   - AI / Voice Agents

---

## Quick Reference: Trust Formation Order

| Order | Action | Where |
|-------|--------|-------|
| 1 | Create client | Clients → New Client |
| 2 | Create trust workspace from client | Client profile → Create Trust |
| 3 | Open Trust Records, bind client + workspace | Trust Records → Platform Binding |
| 4 | Complete Settings | Trust Records → Settings tab |
| 5 | Add assets | Trust Records → Assets tab |
| 6 | Issue certificates | Trust Records → Issue tab |
| 7 | Manage certificates | Trust Records → Certificates tab |

---

## Jarva Quick Prompts

| Prompt | Use when |
|--------|----------|
| What are my next steps? | You need step-by-step guidance |
| What should I ask my client? | You need client interview questions |
| Client interview checklist for trust formation | You want the full checklist |
| Fill grantor from client record | Client is bound and you want to populate grantor |
| How do I construct a trust on this platform? | You want an overview of the five trust elements |
| Naming convention help | You need trust naming guidance |

---

## Notes

- **Draft status:** Documents produced by the platform are drafts and need professional review before use.
- **Fill from client:** Requires a bound client in Platform Binding. Grantor and trustee are auto-filled on workspace creation; you can still run Fill from client to refresh.
- **Jarva:** Uses local knowledge only. No external LLM APIs are used.
