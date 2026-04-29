# Accounting ↔ Trust Records Bridge

**Economic ledger for instrument lifecycle**

## Model

- **Trust Records** = legal/asset state (entity, assets, instruments, governance, deposit events)
- **Accounting** = economic/tax state (cashflow, tax categories, imports, reporting)
- **Lifecycle Engine** = event bridge between both

## Event Types

When something happens in Trust Records, a normalized event is published to `accounting_event_inbox`:

| Event Type | Accounting Action |
|------------|-------------------|
| `INSTRUMENT_ISSUED` | Create financing profile, liability draft |
| `COLLATERAL_PLEDGED` | Create encumbrance record |
| `PROCEEDS_RECEIVED` | Suggested financing_inflow transaction |
| `INTEREST_PAID` | Suggested interest_expense transaction |
| `BROKER_FEE_INCURRED` / `FEE_EXPENSE` | Suggested fee_expense transaction |
| `INSTRUMENT_REDEEMED` / `INSTRUMENT_DEFAULTED` | Update financing profile, liability_reduction |

## API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/trust-records/events/publish` | POST | Publish event to inbox |
| `/api/trust-records/instruments/[instrumentId]/push-to-accounting` | POST | Push instrument + collateral to Accounting |
| `/api/accounting/sync/trust-records` | GET | List pending events, financing profiles, encumbrances |
| `/api/accounting/events/process` | POST | Process pending events → create profiles, encumbrances, suggested transactions |

## Transaction Classes

Beyond `income` and `expense`, Accounting supports:

- `financing_inflow` — proceeds received
- `financing_outflow` — principal repayment
- `liability_created` — instrument issued
- `liability_reduction` — redemption/default
- `interest_expense` — interest paid
- `fee_expense` — broker/custody/legal fees

## Cross-System IDs

Transactions and documents can be tagged with:

- `trustId`, `workspaceId`, `assetId`, `instrumentId`
- `collateralPoolId`, `governingResolutionId`, `brokerageAccountId`
- `sourceEventId` — links to `accounting_event_inbox.id`

## Database Tables

- **accounting_event_inbox** — bridge queue (Trust Records publishes, Accounting consumes)
- **accounting_financing_profiles** — instrument-linked liability/interest tracking
- **accounting_asset_encumbrances** — pledged collateral mirror

## UX Flow

1. **Trust Records** → After issuance or deposit, user clicks **Send to Accounting**
2. Events are published to the inbox
3. **Accounting** → **Capital & Instruments** tab shows sync queue
4. User clicks **Process All Pending** → financing profiles, encumbrances, and suggested transactions are created
5. Suggested transactions are added to localStorage; user can review/edit

## Phase 5 Additions

### Dashboard Metrics (Capital & Instruments)

When the user has instrument/financing data, the Dashboard shows:

- Outstanding Principal
- Encumbered Asset Value
- Financing Proceeds Received
- Interest Paid YTD
- Broker/Custody Fees YTD
- Upcoming Maturities (90 days)

### Document Import Tags

When importing documents, users can tag transactions with:

- **Instrument ID** — links to trust instrument
- **Asset ID** — links to trust asset
- **Brokerage Account ID** — links to brokerage account

Click **Link** on any transaction in the review step to set these.

### Banker Summary Report

**Accounting → Reporting → Banker Summary** (or `/accounting/reporting?tab=banker`)

Combines Trust Records + Accounting into a presentation packet:

- **From Trust Records:** Outstanding instruments, collateral schedule
- **From Accounting:** Cashflow summary, debt service snapshot, fee history, collateral coverage ratio

Print or export as JSON.

## Migration

Run the migration to create the bridge tables:

```bash
npx drizzle-kit push
# or apply manually: drizzle/0010_add_accounting_bridge_tables.sql
```
