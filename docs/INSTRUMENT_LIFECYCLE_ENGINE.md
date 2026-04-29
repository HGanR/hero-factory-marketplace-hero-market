# Instrument Lifecycle Engine — Production Spec

**Purpose:** Add a tightly sequenced issuance-to-deposit pipeline to Trust Records without fragmenting the system. Trust Records remains the command center; this layer orchestrates authority, collateral, issuance, packaging, and deposit routing.

---

## 1. Architecture Overview

```
Trust Records (command center)
      │
      ├── Settings      → Authority & Issuer Profile
      ├── Assets        → Collateral Registry (with issuance metadata)
      ├── Issue         → Quick creator (certificate, bond, note)
      ├── Instruments   → NEW: Lifecycle management console
      ├── Certificates  → Registry (legacy)
      ├── Bonds         → Registry (legacy)
      ├── Governance    → Resolutions, Minutes
      └── Brokerage     → Deposit wizard (consumes SIGNED/PACKAGED instruments)
```

**Lifecycle flow:**
1. Verify authority
2. Classify instrument
3. Attach collateral
4. Approve by resolution
5. Issue instrument
6. Sign
7. Generate banker pack
8. Route to brokerage deposit or custody
9. Log lifecycle events (append-only)

---

## 2. Database Schema

### 2.1 New Tables (implemented)

| Table | Purpose |
|-------|---------|
| `trust_instruments` | Master record for all instrument types |
| `trust_collateral_pools` | Groups of assets backing instruments |
| `trust_collateral_pool_assets` | Join: pool ↔ asset |
| `trust_instrument_events` | Append-only event log |

### 2.2 `trust_instruments`

| Column | Type | Notes |
|--------|------|-------|
| id | varchar(36) PK | UUID |
| trustId | varchar(36) | Required |
| workspaceId | varchar(36) | Optional |
| instrumentKind | enum | CERTIFICATE, BOND, PROMISSORY_NOTE, SECURED_NOTE, PPM_SECURITY, OTHER |
| instrumentSubtype | varchar(80) | e.g. unitized_interest, senior_bond |
| status | enum | See lifecycle states below |
| serialNumber | varchar(80) | Human-readable |
| issuerName | varchar(255) | |
| governingLaw | varchar(100) | |
| faceValue | decimal(18,6) | |
| currency | varchar(10) | Default USD |
| issueDate | date | |
| maturityDate | date | |
| ppmDocumentId | varchar(36) | PPM reference |
| governingResolutionId | varchar(36) | FK to trust_resolutions |
| collateralPoolId | varchar(36) | FK to trust_collateral_pools |
| debtInstrumentId | varchar(36) | Legacy: trust_debt_instruments.id |
| certificateRefId | varchar(36) | Legacy: security_certificates.id or trust-records cert id |
| createdBy | varchar(36) | |
| signedAt | timestamp | |
| signedBy | varchar(255) | |
| createdAt, updatedAt | timestamp | |

**Lifecycle status enum:**
`DRAFT` → `AUTHORITY_REVIEW` → `COLLATERALIZED` → `GOVERNANCE_APPROVED` → `READY_TO_ISSUE` → `ISSUED` → `SIGNED` → `PACKAGED` → `DEPOSIT_INITIATED` → `DEPOSIT_COMPLETED` | `VOIDED` | `DEFAULTED` | `REDEEMED` | `MATURED`

### 2.3 `trust_collateral_pools`

| Column | Type | Notes |
|--------|------|-------|
| id | varchar(36) PK | |
| trustId | varchar(36) | |
| name | varchar(255) | |
| description | text | |
| coverageRatio | decimal(8,4) | e.g. 1.25 = 125% |
| haircutMethod | varchar(80) | |
| valuationDate | date | |
| totalEstimatedValue | decimal(18,2) | |
| createdAt, updatedAt | timestamp | |

### 2.4 `trust_collateral_pool_assets`

| Column | Type | Notes |
|--------|------|-------|
| id | varchar(36) PK | |
| poolId | varchar(36) | FK to trust_collateral_pools |
| assetId | varchar(36) | workflow_trust_assets.id or trust_assets.id |
| allocatedValue | decimal(18,2) | |
| lienPosition | int | |
| notes | text | |
| createdAt | timestamp | |

### 2.5 `trust_instrument_events`

| Column | Type | Notes |
|--------|------|-------|
| id | varchar(36) PK | |
| trustId | varchar(36) | |
| instrumentId | varchar(36) | |
| eventType | varchar(100) | See event types below |
| metadata | json | |
| actorRole | varchar(80) | trustee, manager, etc. |
| actorId | varchar(36) | |
| createdAt | timestamp | |

**Event types:**
`INSTRUMENT_CREATED`, `AUTHORITY_REVIEWED`, `COLLATERAL_ATTACHED`, `GOVERNANCE_APPROVED`, `ISSUED`, `SIGNED`, `PACK_GENERATED`, `DEPOSIT_INITIATED`, `DEPOSIT_COMPLETED`, `VOIDED`, `DEFAULTED`, `REDEEMED`, `MATURED`, `STATUS_CHANGED`

---

## 3. Future Schema Additions (Phase 2+)

### 3.1 Issuer Readiness (Settings tab)

**Table: `trust_issuer_profiles`** (not yet implemented)

| Column | Purpose |
|--------|---------|
| trustId | FK |
| governingLaw | |
| issuerDisplayName | |
| issuingCapacity | |
| hasIssuanceAuthority | boolean |
| hasPledgeAuthority | boolean |
| hasBorrowingAuthority | boolean |
| hasAgentAppointmentAuthority | boolean |
| bankerContactEmail | |
| bankerContactPhone | |

### 3.2 Asset Collateral Metadata (Assets tab)

**Table: `trust_asset_collateral_metadata`** (not yet implemented)

| Column | Purpose |
|--------|---------|
| assetId | workflow_trust_assets or trust_assets |
| eligibleAsCollateral | boolean |
| collateralClass | varchar |
| valuationDate | date |
| valuationSource | varchar |
| lienStatus | varchar |
| custodyEvidence | text |
| haircutPct | decimal |
| collateralNotes | text |

---

## 4. API Route Contracts

### 4.1 Instruments CRUD

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/trust-records/instruments?trustId=...&status=...&kind=...` | List instruments (filter by status, kind) |
| POST | `/api/trust-records/instruments/create` | Create draft instrument |
| GET | `/api/trust-records/instruments/[instrumentId]` | Get single instrument |
| PATCH | `/api/trust-records/instruments/[instrumentId]` | Update instrument (limited when not DRAFT) |
| POST | `/api/trust-records/instruments/[instrumentId]/issue` | Transition to ISSUED |
| POST | `/api/trust-records/instruments/[instrumentId]/sign` | Transition to SIGNED |
| POST | `/api/trust-records/instruments/[instrumentId]/generate-pack` | Generate banker pack, transition to PACKAGED |
| GET | `/api/trust-records/instruments/[instrumentId]/events` | List events for instrument |

### 4.2 Request/Response Shapes

**POST `/api/trust-records/instruments/create`**
```json
{
  "trustId": "uuid",
  "instrumentKind": "CERTIFICATE" | "BOND" | "PROMISSORY_NOTE" | "SECURED_NOTE" | "PPM_SECURITY" | "OTHER",
  "instrumentSubtype": "unitized_interest",
  "faceValue": 100000,
  "currency": "USD",
  "maturityDate": "2030-12-31",
  "governingResolutionId": "uuid",
  "collateralPoolId": "uuid",
  "ppmDocumentId": "uuid"
}
```
Response: `{ ok: true, instrument: { id, ... } }`

**POST `/api/trust-records/instruments/[instrumentId]/issue`**
```json
{
  "serialNumber": "CERT-2026-0001",
  "issuerName": "ABC Trust",
  "issueDate": "2026-03-12"
}
```
Response: `{ ok: true, instrument: { ... } }` + event `ISSUED` logged

**POST `/api/trust-records/instruments/[instrumentId]/sign`**
```json
{
  "signedBy": "Trustee Name"
}
```
Response: `{ ok: true, instrument: { ... } }` + event `SIGNED` logged

**POST `/api/trust-records/instruments/[instrumentId]/generate-pack`**
```json
{
  "includeTrusteeLetter": true,
  "includeCollateralSchedule": true,
  "includeInstrumentSummary": true,
  "includeBrokerageLetter": true
}
```
Response: `{ ok: true, packUrl: "/api/...", instrument: { ... } }` + event `PACK_GENERATED` logged

### 4.3 Collateral Pools

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/trust-records/collateral-pools?trustId=...` | List pools |
| POST | `/api/trust-records/collateral-pools` | Create pool |
| GET | `/api/trust-records/collateral-pools/[poolId]` | Get pool + assets |
| PATCH | `/api/trust-records/collateral-pools/[poolId]` | Update pool |
| POST | `/api/trust-records/collateral-pools/[poolId]/assets` | Add asset to pool |
| DELETE | `/api/trust-records/collateral-pools/[poolId]/assets/[assetId]` | Remove asset |

### 4.4 Banker Readiness

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/trust-records/instruments/[instrumentId]/readiness` | Compute banker readiness score |

**Response:**
```json
{
  "score": "NOT_READY" | "PARTIALLY_READY" | "READY_FOR_PRESENTATION",
  "checks": {
    "issuerProfileComplete": true,
    "authorityBasisLinked": true,
    "collateralAttached": true,
    "encumbrancesDisclosed": true,
    "valuationPresent": true,
    "governingResolutionLinked": true,
    "signatoryComplete": true,
    "bankerPackGenerated": false
  },
  "blockers": ["Missing valuation date for digital asset collateral"],
  "advisories": ["Consider adding trustee authorization letter"]
}
```

---

## 5. Eleanor Integration

**Route:** `POST /api/agent/eleanor/instrument-review`

**Input:**
```json
{
  "instrumentId": "uuid",
  "checkpoint": "before_issuance" | "before_packaging" | "before_deposit"
}
```

**Response:**
```json
{
  "instrumentKind": "Secured Note",
  "readinessFlags": [
    "Missing valuation date for digital asset collateral",
    "No trustee authorization letter generated",
    "Lien disclosure needed for vehicle equity asset"
  ],
  "recommendedDocuments": [
    "Trust Agreement excerpt",
    "Collateral Schedule",
    "Trustee Authorization Letter",
    "Instrument Summary Sheet"
  ],
  "questions": ["Has the trust agreement been amended to permit this issuance?"]
}
```

---

## 6. UI Map — Instruments Tab

### 6.1 Tab Placement

Add new tab **Instruments** to Trust Records `TabsList` (between Issue and Certificates or after Certificates).

### 6.2 Instruments Tab Sections

| Section | Content |
|--------|---------|
| **Drafts** | Instruments with status DRAFT, AUTHORITY_REVIEW, COLLATERALIZED |
| **Ready to Issue** | GOVERNANCE_APPROVED, READY_TO_ISSUE |
| **Awaiting Signature** | ISSUED |
| **Ready for Packaging** | SIGNED |
| **Ready for Deposit** | PACKAGED |
| **Deposit In Progress** | DEPOSIT_INITIATED |
| **Completed / Closed** | DEPOSIT_COMPLETED, MATURED, REDEEMED |
| **Voided / Defaulted** | VOIDED, DEFAULTED |
| **Lifecycle History** | Expandable event log per instrument |

### 6.3 Instrument Detail Page

**Route:** `/trust-records/[trustId]/instruments/[instrumentId]`

**Sections:**
- Header: serial number, kind, status, face value
- Banker Readiness score + checklist
- Collateral pool summary
- Governing resolution link
- Actions: Issue, Sign, Generate Pack, Start Deposit
- Event log
- Eleanor review panel (collapsible)

### 6.4 New Instrument Flow

**Route:** `/trust-records/[trustId]/instruments/new`

**Steps:**
1. Select instrument family (Trust Certificate, Bond, Promissory Note, Secured Note, PPM Security, Other)
2. Set terms (face value, currency, maturity, etc.)
3. Select or create collateral pool
4. Link governing resolution
5. Preview
6. Create draft

### 6.5 Issue Tab Changes

Keep Issue tab as **quick creator**. Add:
- Instrument family selector (Trust Certificate, Bond, Promissory Note, Secured Note, Private Placement Security, Other)
- Dynamic fields based on family
- "Create & manage in Instruments" link after creation

---

## 7. Brokerage Deposit Integration

The brokerage deposit wizard (`/trust-records/[trustId]/brokerage-deposit`) should:

1. **Accept only** instruments with status `SIGNED` or `PACKAGED`
2. Pull asset list from `trust_instruments` + `trust_collateral_pool_assets` when instrument is selected
3. Emit `DEPOSIT_INITIATED` and `DEPOSIT_COMPLETED` events to `trust_instrument_events`
4. Update instrument status to `DEPOSIT_INITIATED` / `DEPOSIT_COMPLETED` when appropriate

---

## 8. Backward Compatibility

| Existing Object | Mapping |
|-----------------|---------|
| Trust Certificate (trust-records store) | `trust_instruments.instrumentKind = CERTIFICATE`, `certificateRefId` = local id |
| Bond (trust_debt_instruments) | `trust_instruments.instrumentKind = BOND`, `debtInstrumentId` = trust_debt_instruments.id |
| Security Certificate (security_certificates) | `trust_instruments.instrumentKind = PPM_SECURITY`, `certificateRefId` = security_certificates.id |

Migration strategy: Create `trust_instruments` rows for existing bonds/certificates on first access or via a one-time migration script.

---

## 9. Implementation Phases

| Phase | Deliverables |
|-------|--------------|
| **Phase 1** | Schema (trust_instruments, trust_collateral_pools, trust_collateral_pool_assets, trust_instrument_events), migration, type exports |
| **Phase 2** | Collateral pools API, Instruments list API, Instruments tab (read-only) |
| **Phase 3** | Banker pack generator route, readiness endpoint |
| **Phase 4** | Brokerage deposit consumes issued instruments, status transitions |
| **Phase 5** | Promissory note / secured note issuance UI, Eleanor instrument-review |

---

## 10. File Map

| File | Purpose |
|------|---------|
| `src/lib/db/schema.ts` | trustInstruments, trustCollateralPools, trustCollateralPoolAssets, trustInstrumentEvents |
| `drizzle/0008_add_instrument_lifecycle_tables.sql` | Migration |
| `src/app/trust-records/[trustId]/instruments/page.tsx` | Instruments tab content (list by status) |
| `src/app/trust-records/[trustId]/instruments/[instrumentId]/page.tsx` | Instrument detail |
| `src/app/trust-records/[trustId]/instruments/new/page.tsx` | New instrument wizard |
| `src/app/api/trust-records/instruments/route.ts` | GET list, POST create |
| `src/app/api/trust-records/instruments/[instrumentId]/route.ts` | GET, PATCH |
| `src/app/api/trust-records/instruments/[instrumentId]/issue/route.ts` | POST issue |
| `src/app/api/trust-records/instruments/[instrumentId]/sign/route.ts` | POST sign |
| `src/app/api/trust-records/instruments/[instrumentId]/generate-pack/route.ts` | POST generate pack |
| `src/app/api/trust-records/instruments/[instrumentId]/events/route.ts` | GET events |
| `src/app/api/trust-records/instruments/[instrumentId]/readiness/route.ts` | GET readiness |
| `src/app/api/trust-records/collateral-pools/route.ts` | GET list, POST create |
| `src/app/api/trust-records/collateral-pools/[poolId]/route.ts` | GET, PATCH |
| `src/app/api/trust-records/collateral-pools/[poolId]/assets/route.ts` | POST add, DELETE remove |
| `src/app/api/agent/eleanor/instrument-review/route.ts` | POST Eleanor review |
