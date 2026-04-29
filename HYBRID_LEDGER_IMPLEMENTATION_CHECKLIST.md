# Hybrid Ledger Implementation Checklist

**Status:** RFC Ratified | Implementation Phase: Incremental Tagging

This checklist maps directly to your codebase and provides step-by-step implementation guidance.

---

## Phase 1: Instrument Semantics Tagging (Incremental, Non-Breaking)

### Step 1.1: Create Instrument Abstraction Schema
**File:** `src/lib/db/schema.ts`

- [ ] Add `instruments` table definition
- [ ] Add `instrumentWitnesses` table definition  
- [ ] Add `instrumentAccountingEntries` table definition
- [ ] Create migration file: `drizzle/migrations/XXXX_add_instrument_abstraction.sql`

**Validation:**
```bash
npm run db:push  # Test schema changes
npm run db:generate  # Generate new migration
```

---

### Step 1.2: Create Instrument Factory Service
**File:** `src/lib/instruments/instrument-factory.ts` (NEW)

- [ ] Implement `createInstrumentFromDeed(deedId: string): Promise<string>`
- [ ] Implement `createInstrumentFromResolution(resolutionId: string): Promise<string>`
- [ ] Add instrument type mapping logic
- [ ] Add status synchronization (instrument status mirrors concrete entity status)

**Test Cases:**
- [ ] Create instrument from existing deed
- [ ] Create instrument from existing resolution
- [ ] Verify status sync when deed status changes

---

### Step 1.3: Tag Existing Deeds (Backfill Script)
**File:** `scripts/backfill-instruments-from-deeds.ts` (NEW)

- [ ] Query all existing deeds from `deeds` table
- [ ] For each deed, create corresponding `instruments` record
- [ ] Link `instruments.concreteId` → `deeds.id`
- [ ] Set `instruments.instrumentType = "DEED"`
- [ ] Copy status from deed to instrument
- [ ] Add dry-run mode (no writes, just logging)

**Execution:**
```bash
# Dry run first
tsx scripts/backfill-instruments-from-deeds.ts --dry-run

# Execute
tsx scripts/backfill-instruments-from-deeds.ts
```

---

### Step 1.4: Tag Existing Resolutions (Backfill Script)
**File:** `scripts/backfill-instruments-from-resolutions.ts` (NEW)

- [ ] Query all existing resolutions from `resolutions` table
- [ ] For each resolution, create corresponding `instruments` record
- [ ] Link `instruments.concreteId` → `resolutions.id`
- [ ] Set `instruments.instrumentType = "RESOLUTION"`
- [ ] Copy status from resolution to instrument
- [ ] Link to governing trust via `minutes.minuteBookId → minuteBooks.trustId`

**Execution:**
```bash
tsx scripts/backfill-instruments-from-resolutions.ts --dry-run
tsx scripts/backfill-instruments-from-resolutions.ts
```

---

### Step 1.5: Add Instrument Hooks to Deed Lifecycle
**File:** `src/app/api/assets/deeds/[deedId]/mark-executed/route.ts`

- [ ] After deed execution, ensure instrument record exists
- [ ] Update instrument status to match deed status
- [ ] Add audit log entry for instrument update

**File:** `src/app/api/assets/deeds/[deedId]/mark-recorded/route.ts`

- [ ] After deed recording, update instrument status
- [ ] Store `instrumentHash` in instrument record (for future witness linking)

---

### Step 1.6: Add Instrument Hooks to Resolution Lifecycle
**File:** `src/app/api/governance/resolutions/[resolutionId]/approve/route.ts`

- [ ] After resolution approval, ensure instrument record exists
- [ ] Update instrument status to "approved"
- [ ] Store resolution hash in instrument record

---

## Phase 2: Public Witness Adapter (Optional, Fail-Safe)

### Step 2.1: Create Witness Adapter Service
**File:** `src/lib/instruments/witness-adapter.ts` (NEW)

- [ ] Implement `notarizeInstrumentAsWitness()` function
- [ ] Create witness hash: `SHA256(trustId + instrumentId + instrumentHash + timestamp)`
- [ ] Integrate with `BesuWeb3Service.notarizeDocument()`
- [ ] Handle blockchain failures gracefully (log, don't throw)
- [ ] Store witness record in `instrumentWitnesses` table

**Configuration:**
- [ ] Add `WITNESS_ENABLED` environment variable (default: `false`)
- [ ] Add `WITNESS_NETWORK` environment variable (default: `besu`)
- [ ] Add `WITNESS_NOTARY_ADDRESS` environment variable

---

### Step 2.2: Integrate Witness Adapter into Deed Recording
**File:** `src/app/api/assets/deeds/[deedId]/mark-recorded/route.ts`

- [ ] After successful recording, check `WITNESS_ENABLED`
- [ ] If enabled, call `notarizeInstrumentAsWitness()` (async, non-blocking)
- [ ] Log witness result (success or failure)
- [ ] Don't fail deed recording if witness fails

**Implementation Pattern:**
```typescript
// After deed is recorded successfully
if (process.env.WITNESS_ENABLED === 'true') {
  // Fire and forget - don't block recording
  notarizeInstrumentAsWitness(instrumentId, 'DEED', instrumentHash, trustId)
    .then(result => {
      console.log(`Witness notarized: ${result.txHash}`);
    })
    .catch(err => {
      console.error(`Witness notarization failed (non-blocking):`, err);
    });
}
```

---

### Step 2.3: Integrate Witness Adapter into Resolution Approval
**File:** `src/app/api/governance/resolutions/[resolutionId]/approve/route.ts`

- [ ] After successful approval, check `WITNESS_ENABLED`
- [ ] If enabled, call `notarizeInstrumentAsWitness()` (async, non-blocking)
- [ ] Log witness result

---

### Step 2.4: Add Witness Status UI Indicators
**File:** `src/app/trust-records/[trustId]/assets/deeds/[deedId]/page.tsx`

- [ ] Query `instrumentWitnesses` table for deed's instrument
- [ ] Display witness status badge if witness record exists
- [ ] Show witness tx hash (truncated) with link to block explorer
- [ ] Show witness timestamp

**File:** `src/app/trust-records/[trustId]/governance/resolutions/[resolutionId]/page.tsx`

- [ ] Query `instrumentWitnesses` table for resolution's instrument
- [ ] Display witness status badge

---

## Phase 3: Accounting Integration

### Step 3.1: Create Accounting Integration Service
**File:** `src/lib/instruments/accounting-integration.ts` (NEW)

- [ ] Implement `createLienReceivable(instrumentId, amount, accrualDate)`
- [ ] Implement `createSettlementEquity(instrumentId, amount, settlementDate)`
- [ ] Implement `createFeeObligation(instrumentId, amount, dueDate)`
- [ ] Link entries to `instrumentAccountingEntries` table

---

### Step 3.2: Integrate Accounting into Deed Recording (Lien Detection)
**File:** `src/app/api/assets/deeds/[deedId]/mark-recorded/route.ts`

- [ ] Detect if deed is a lien (via `deedType` or metadata)
- [ ] If lien, extract lien amount from deed metadata
- [ ] Call `createLienReceivable()` to create accounting entry
- [ ] Link accounting entry to instrument

**Note:** This requires extending deed metadata to include lien amount. May need schema change or JSON field.

---

### Step 3.3: Add Accounting Reports with Instrument Backing
**File:** `src/app/api/accounting/instrument-entries/route.ts` (NEW)

- [ ] Query `instrumentAccountingEntries` joined with `instruments`
- [ ] Filter by trustId, date range, entry type
- [ ] Return instrument-backed accounting entries with instrument details

**File:** `src/components/InstrumentAccountingReport.tsx` (NEW)

- [ ] Display instrument-backed entries in table
- [ ] Show instrument type, title, status
- [ ] Show accounting entry details (amount, date, account type)
- [ ] Link to instrument detail page

---

## Phase 4: API Contracts

### Step 4.1: Instrument Query API
**File:** `src/app/api/instruments/route.ts` (NEW)

- [ ] `GET /api/instruments?trustId=xxx` - List instruments for a trust
- [ ] `GET /api/instruments/[instrumentId]` - Get instrument details
- [ ] Return instrument with concrete entity details (deed/resolution)
- [ ] Include witness status if available

---

### Step 4.2: Witness Notarization API
**File:** `src/app/api/instruments/[instrumentId]/witness/route.ts` (NEW)

- [ ] `POST /api/instruments/[instrumentId]/witness` - Manually trigger witness notarization
- [ ] Check `WITNESS_ENABLED` flag
- [ ] Call witness adapter
- [ ] Return witness result (tx hash, block number, timestamp)

**Authorization:**
- [ ] Require trust owner or trustee role
- [ ] Verify user has access to instrument's governing trust

---

### Step 4.3: Instrument Accounting API
**File:** `src/app/api/instruments/[instrumentId]/accounting/route.ts` (NEW)

- [ ] `GET /api/instruments/[instrumentId]/accounting` - Get accounting entries for instrument
- [ ] `POST /api/instruments/[instrumentId]/accounting` - Create accounting entry for instrument
- [ ] Validate entry type and amount
- [ ] Link to instrument

---

## Phase 5: Documentation & Whitepaper

### Step 5.1: Create Internal RFC Document
**File:** `docs/HYBRID_LEDGER_RFC.md` (NEW)

- [ ] Document authoritative ledger architecture
- [ ] Document public witness adapter design
- [ ] Document instrument abstraction model
- [ ] Document security posture and non-goals
- [ ] Include API contracts reference

---

### Step 5.2: Create Governance Whitepaper Section
**File:** `docs/GOVERNANCE_WHITEPAPER.md` (NEW)

- [ ] Reframe system as "private jurisdiction" (not "escaping" legal boundaries)
- [ ] Position as "instrument-based authority"
- [ ] Explain "public proof without public exposure"
- [ ] Suitable for investor/institutional/legal review

---

## Testing Checklist

### Unit Tests
- [ ] `src/lib/instruments/instrument-factory.test.ts` - Instrument creation
- [ ] `src/lib/instruments/witness-adapter.test.ts` - Witness notarization (mocked)
- [ ] `src/lib/instruments/accounting-integration.test.ts` - Accounting entry creation

### Integration Tests
- [ ] Deed → Instrument creation flow
- [ ] Resolution → Instrument creation flow
- [ ] Witness notarization flow (with test blockchain)
- [ ] Accounting entry creation flow

### Manual Testing
- [ ] Create new deed, verify instrument created
- [ ] Record deed, verify witness notarization (if enabled)
- [ ] Approve resolution, verify instrument updated
- [ ] View instrument accounting entries in UI

---

## Deployment Checklist

### Pre-Deployment
- [ ] Run backfill scripts in staging
- [ ] Verify instrument records created correctly
- [ ] Test witness adapter with test network
- [ ] Verify accounting entries linked correctly

### Deployment
- [ ] Deploy schema migrations
- [ ] Run backfill scripts in production (during maintenance window)
- [ ] Enable `WITNESS_ENABLED` flag (if ready)
- [ ] Monitor logs for witness notarization errors

### Post-Deployment
- [ ] Verify instrument counts match deed/resolution counts
- [ ] Check witness notarization success rate
- [ ] Verify accounting entries appear in reports
- [ ] Monitor performance (instrument queries should be fast with indexes)

---

## Rollback Plan

If issues arise:

1. **Schema Rollback:**
   - [ ] Create rollback migration to drop new tables
   - [ ] Keep existing deeds/resolutions untouched (no data loss)

2. **Feature Flags:**
   - [ ] Set `WITNESS_ENABLED=false` to disable witness
   - [ ] Instrument abstraction is additive (can coexist with old code)

3. **Data Preservation:**
   - [ ] All instrument data is derived from existing data
   - [ ] Can regenerate instruments from deeds/resolutions if needed

---

## Performance Considerations

- [ ] Add indexes on `instruments.concreteId` (for reverse lookups)
- [ ] Add indexes on `instruments.governingTrustId` (for trust queries)
- [ ] Add indexes on `instrumentWitnesses.instrumentId` (for witness lookups)
- [ ] Consider materialized view for instrument summaries if queries are slow

---

## Security Considerations

- [ ] Instrument creation requires same auth as deed/resolution creation
- [ ] Witness notarization requires trust owner/trustee role
- [ ] Accounting entries require trust owner/trustee role
- [ ] All instrument queries filter by `governingTrustId` + user access

---

**Last Updated:** [Current Date]  
**Status:** Ready for Phase 1 Implementation
