# Parent Company + C-Corp Wizard — Production Test Plan
## Deterministic Acceptance Tests (Prove Go/No-Go Claims)

**Test Environment**: Production database with migration applied
**Test User Setup**: Create test users UserA (id: 1001) and UserB (id: 1002)

---

## Test Suite A: Ownership Isolation & Affiliation Boundaries

### Test A1: Company Ownership Enforcement
**Objective**: Verify `company.userId === authedUserId` on all routes

**Steps**:
1. Authenticate as UserA
2. Create Company A1: `POST /api/companies` with `{"companyName": "TestCorp A", "formationState": "DE", ...}`
3. Verify response contains `company.id` and `company.publicCompanyId` (e.g., "COMP-DE-2026-0001")
4. Authenticate as UserB
5. Attempt `GET /api/companies/{A1.id}` (UserB accessing UserA's company)
6. Attempt `PATCH /api/companies/{A1.id}` with updates
7. Attempt `DELETE /api/companies/{A1.id}`

**Expected Results**:
- Steps 5-7: **HTTP 404** or **403** (ownership violation)
- UserA can read/update/delete their own company
- UserB cannot access UserA's company

**Verification Query**:
```sql
SELECT id, userId, companyName FROM companies WHERE id = '{A1.id}';
-- Should show userId = 1001, not accessible by UserB
```

### Test A2: Affiliation Cross-Owner Prevention
**Objective**: Verify affiliations cannot link entities from different owners

**Steps**:
1. Authenticate as UserA
2. Create Company A2: `POST /api/companies` (parent company)
3. Authenticate as UserB
4. Create Company B1: `POST /api/companies` (potential subsidiary)
5. Authenticate as UserA
6. Attempt to create affiliation: `POST /api/companies/{A2.id}/affiliations`
   ```json
   {
     "affiliationType": "parent_subsidiary",
     "subsidiaryCompanyId": "{B1.id}"
   }
   ```

**Expected Results**:
- **HTTP 404** or **403** (cannot link to UserB's company)
- No affiliation record created

**Verification Query**:
```sql
SELECT * FROM company_affiliations
WHERE parentCompanyId = '{A2.id}' AND subsidiaryCompanyId = '{B1.id}';
-- Should return 0 rows
```

### Test A3: Valid Affiliation Creation
**Objective**: Verify valid same-owner affiliations work

**Steps**:
1. Authenticate as UserA
2. Create Company A3: `POST /api/companies` (parent)
3. Create Company A4: `POST /api/companies` (subsidiary)
4. Create affiliation: `POST /api/companies/{A3.id}/affiliations`
   ```json
   {
     "affiliationType": "parent_subsidiary",
     "subsidiaryCompanyId": "{A4.id}",
     "ownershipPercentage": 100
   }
   ```

**Expected Results**:
- **HTTP 201** with affiliation details
- Affiliation record created with `userId = 1001`

**Verification Query**:
```sql
SELECT userId, affiliationType, parentCompanyId, subsidiaryCompanyId
FROM company_affiliations
WHERE parentCompanyId = '{A3.id}';
-- Should show 1 row with userId = 1001
```

---

## Test Suite B: Sequence Integrity & Uniqueness

### Test B1: Public ID Uniqueness Under Concurrency
**Objective**: Verify `publicCompanyId` remains unique under concurrent creation

**Steps**:
1. Simulate 5 concurrent company creations (use multiple browser tabs or curl commands)
2. All create companies in same state (e.g., "DE") with same user
3. Check all get unique `publicCompanyId` values

**Expected Results**:
- All companies created successfully
- Each has unique `publicCompanyId` (COMP-DE-2026-0001, 0002, 0003, etc.)
- No duplicate public IDs

**Verification Query**:
```sql
SELECT publicCompanyId, COUNT(*) as count
FROM companies
WHERE userId = 1001 AND formationState = 'DE'
GROUP BY publicCompanyId
HAVING count > 1;
-- Should return 0 rows (no duplicates)
```

### Test B2: Sequence Monotonicity
**Objective**: Verify sequences increase predictably

**Steps**:
1. Create 3 companies in sequence
2. Check `company_sequences` table

**Expected Results**:
- Sequence values increase: 1, 2, 3...
- No gaps or duplicates in sequence allocation

**Verification Query**:
```sql
SELECT scope, currentValue, updatedAt
FROM company_sequences
WHERE scope LIKE 'COMPANY:DE:%'
ORDER BY updatedAt DESC;
-- Should show predictable incrementing values
```

---

## Test Suite C: Idempotency & Status Workflow

### Test C1: Document Generation Idempotency
**Objective**: Verify duplicate "Generate outputs" calls don't create duplicates

**Steps**:
1. Authenticate as UserA
2. Create and complete a company draft
3. Call "Generate outputs" twice in rapid succession
4. Check document creation results

**Expected Results**:
- First call: **HTTP 201** with document details
- Second call: **HTTP 200** with message "Document already exists with identical content"
- No duplicate documents in database

**Verification Query**:
```sql
SELECT trustId, docType, version, COUNT(*) as count
FROM trustDocuments
WHERE trustId LIKE 'company-%'
GROUP BY trustId, docType, version
HAVING count > 1;
-- Should return 0 rows (no duplicates)
```

### Test C2: Execution Readiness Workflow
**Objective**: Verify status transitions and audit trails

**Steps**:
1. Create company (status = 'draft')
2. Update status to 'counsel_reviewed' with notes
3. Update status to 'board_adopted' with meeting details
4. Update status to 'execution_ready'

**Expected Results**:
- All status transitions succeed
- Invalid transitions are rejected (e.g., draft → execution_ready)
- Audit trail preserved in `draftJson.statusAudit`

**Verification Query**:
```sql
SELECT id, status, draftJson
FROM companies
WHERE id = '{company_id}';
-- Should show status = 'execution_ready'
-- draftJson should contain statusAudit array with all transitions
```

---

## Test Suite D: Integration & End-to-End

### Test D1: Complete Company Creation Flow
**Objective**: Verify full wizard integration

**Steps**:
1. Navigate to `/wizard?type=company`
2. Complete Structure Builder → Setup → Onboarding → All selected modules → Review
3. Generate outputs
4. Update execution status

**Expected Results**:
- Company created with `draftJson` containing full wizard state
- All API calls succeed with proper ownership checks
- Documents generated with draft/review watermarking

### Test D2: Affiliation Ecosystem Integration
**Objective**: Verify company-trust affiliations work

**Steps**:
1. Create a company
2. Create a trust (existing trust system)
3. Create affiliation between them
4. Verify both entities remain accessible only to owner

**Expected Results**:
- Affiliation created successfully
- Trust remains accessible only to its owner
- Company remains accessible only to its owner

---

## Automated Test Script (Optional)

```bash
#!/bin/bash
# Automated test runner for ownership isolation

echo "=== Parent Company Production Tests ==="

# Test A1: Ownership isolation
echo "Testing ownership isolation..."
curl -X POST -H "Authorization: Bearer $USER_A_TOKEN" \
  -d '{"companyName":"TestCorp A","formationState":"DE","companyKind":"operating_company","corpType":"c_corp","parentStructure":"parent_only"}' \
  http://localhost:3000/api/companies > company_a.json

COMPANY_A_ID=$(jq -r '.company.id' company_a.json)

# Try accessing with User B token
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $USER_B_TOKEN" \
  http://localhost:3000/api/companies/$COMPANY_A_ID)

if [ "$RESPONSE" -eq "404" ] || [ "$RESPONSE" -eq "403" ]; then
  echo "✅ Ownership isolation test PASSED"
else
  echo "❌ Ownership isolation test FAILED (got $RESPONSE)"
fi

echo "=== Tests Complete ==="
```

---

## Go/No-Go Decision Criteria

**GO** if ALL of the following pass:
- ✅ All ownership isolation tests pass (UserA cannot access UserB's companies)
- ✅ All affiliation boundary tests pass (cannot link cross-owner entities)
- ✅ All uniqueness tests pass (no duplicate publicIds or affiliations)
- ✅ All idempotency tests pass (duplicate calls don't create duplicates)
- ✅ All status workflow tests pass (valid transitions work, invalid ones fail)
- ✅ All integration tests pass (wizard flow completes successfully)

**NO-GO** if ANY test fails - indicates production readiness gaps that must be fixed before launch.

---

## Post-Production Monitoring Queries

```sql
-- Daily health check: ownership violations
SELECT COUNT(*) as ownership_violations
FROM company_affiliations ca
LEFT JOIN companies c1 ON ca.parentCompanyId = c1.id
LEFT JOIN companies c2 ON ca.subsidiaryCompanyId = c2.id
WHERE ca.userId != c1.userId
   OR (c2.id IS NOT NULL AND ca.userId != c2.userId);

-- Sequence health: gaps or duplicates
SELECT scope,
       COUNT(*) as expected_count,
       MAX(currentValue) - MIN(currentValue) + 1 as actual_range
FROM company_sequences
GROUP BY scope
HAVING expected_count != actual_range;

-- Status transition health
SELECT status, COUNT(*) as companies_in_status
FROM companies
GROUP BY status
ORDER BY status;
```








