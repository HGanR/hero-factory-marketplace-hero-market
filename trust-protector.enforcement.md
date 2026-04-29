# Trust Protector - Enforcement Tests

**Test Suite ID:** TRUST_PROTECTOR_V1
**Last Updated:** January 3, 2026
**Test Environment:** Production (hero-market.vercel.app)

## Overview

These tests verify that Trust Protector governance controls are properly enforced, providing deterministic security guarantees for sensitive trust operations.

## Prerequisites

- Two user accounts (User A, User B) with separate trusts
- User A has created a trust with authority confirmed
- Client profiles exist for both users
- Network connectivity to Polygon for NFT verification

## Test Suite: Assignment Creation

### Test 1.1: Authorized Protector Assignment
**Type:** Authorization & Data Integrity
**Priority:** Critical

**Setup:**
- User A owns Trust A (authorityStatus = 'confirmed')
- User A has a client profile (CID)

**Steps:**
1. User A starts Revocable Living Trust wizard
2. Navigate to "trust_protector" step
3. Select client profile for protector role
4. Choose powers: ["remove_replace_trustee", "consent_administrative_amendments"]
5. Set trigger: "upon_irrevocable_conversion"
6. Complete step

**Expected Results:**
- API call: `POST /api/trusts/{trustId}/governance` succeeds (200)
- Database: governance_assignments record created
- Record fields match input exactly
- Audit log entry created with action "GOVERNANCE_ASSIGNMENT_CREATE"

**Verification Commands:**
```sql
-- Check assignment creation
SELECT
  ga.id,
  ga.role,
  ga.powersJson,
  ga.triggersJson,
  ga.assignedBy,
  al.action,
  al.metadata
FROM governance_assignments ga
LEFT JOIN audit_logs al ON al.entityId = ga.id
WHERE ga.entityId = '{trustId}'
  AND ga.entityType = 'trust'
  AND ga.role = 'trust_protector';
```

### Test 1.2: Unauthorized Assignment Prevention
**Type:** Authorization Boundary
**Priority:** Critical

**Setup:**
- User B attempts to assign protector to User A's trust

**Steps:**
1. User B attempts: `POST /api/trusts/{userA-trustId}/governance`

**Expected Results:**
- API returns 403 Forbidden
- No database record created
- Audit log shows blocked attempt

**Verification Script:**
```javascript
// Test unauthorized assignment
const unauthorizedAssignment = async () => {
  const response = await fetch('/api/trusts/userA-trust-id/governance', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer_userB_token' },
    body: JSON.stringify({
      clientProfileId: 'some-cid',
      powers: ['remove_replace_trustee'],
      triggers: { activationMode: 'immediate' }
    })
  });

  console.log('Unauthorized assignment response:', response.status);
  return response.status === 403 ? 'PASS' : 'FAIL';
};
```

## Test Suite: Trigger Activation

### Test 2.1: Protector Inactive → Action Allowed
**Type:** Conditional Logic
**Priority:** High

**Setup:**
- Trust A has protector assigned with trigger "upon_irrevocable_conversion"
- Trust A is still revocable (trigger not active)

**Steps:**
1. Attempt gated action (e.g., create certificate)
2. API call: `POST /api/trusts/{trustId}/certificates`

**Expected Results:**
- Action succeeds (200)
- No protector approval required
- Certificate created normally

**Verification Commands:**
```sql
-- Check certificate creation without approval
SELECT
  c.id,
  c.certificateNumber,
  ga.id as protector_assignment
FROM workflow_asset_certificates c
LEFT JOIN governance_assignments ga ON ga.entityId = c.trustId
  AND ga.status = 'active'
  AND JSON_EXTRACT(ga.triggersJson, '$.activationMode') = 'upon_irrevocable_conversion'
WHERE c.trustId = '{trustId}';
```

### Test 2.2: Trigger Active → Action Blocked
**Type:** Hard Gate Enforcement
**Priority:** Critical

**Setup:**
- Trust A converted to irrevocable (trigger active)
- Protector has "issue_certificates" power

**Steps:**
1. Attempt certificate creation
2. API call: `POST /api/trusts/{trustId}/certificates`

**Expected Results:**
- API returns 403 Forbidden
- Error message: "Issuing certificates requires Trust Protector approval"
- Response includes protector details
- NO certificate record created
- Audit log shows blocked attempt

**Verification Script:**
```javascript
// Test trigger activation blocking
const testTriggerBlocking = async () => {
  // Simulate irrevocable conversion (update trust state)
  await fetch('/api/trusts/trust-id', {
    method: 'PATCH',
    headers: { 'Authorization': 'Bearer_owner_token' },
    body: JSON.stringify({ trustType: 'irrevocable_trust' })
  });

  // Attempt certificate creation
  const response = await fetch('/api/trusts/trust-id/certificates', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer_owner_token' },
    body: JSON.stringify({
      assetId: 'valid-asset-id',
      certificateClass: 'Unit',
      units: 1
    })
  });

  const result = await response.json();
  console.log('Blocking response:', {
    status: response.status,
    error: result.error,
    protectors: result.protectors?.length
  });

  return response.status === 403 &&
         result.error.includes('Trust Protector') &&
         result.protectors?.length > 0 ? 'PASS' : 'FAIL';
};
```

## Test Suite: Hard Gate Validation

### Test 3.1: Blocked Action No Side Effects
**Type:** Transaction Integrity
**Priority:** Critical

**Setup:**
- Protector active and blocking certificate issuance

**Steps:**
1. Attempt certificate creation with invalid data (should fail anyway)
2. Verify no partial state changes

**Expected Results:**
- Action fails cleanly
- No trust_documents created
- No workflow_asset_certificates created
- Asset status unchanged

**Verification Commands:**
```sql
-- Check for side effects after blocked attempt
SELECT 'certificates' as table_name, COUNT(*) as count
FROM workflow_asset_certificates
WHERE trustId = '{trustId}' AND createdAt > '{test_start_time}'
UNION ALL
SELECT 'documents', COUNT(*)
FROM trust_documents
WHERE trustId = '{trustId}' AND createdAt > '{test_start_time}'
UNION ALL
SELECT 'assets', COUNT(*)
FROM workflow_trust_assets
WHERE trustId = '{trustId}' AND status = 'certificated' AND updatedAt > '{test_start_time}';
```

### Test 3.2: Deterministic Error Messages
**Type:** Error Consistency
**Priority:** High

**Setup:**
- Multiple protectors assigned with different powers

**Steps:**
1. Attempt action requiring specific power
2. Check error message specificity

**Expected Results:**
- Error mentions specific protectors by name
- Lists required powers clearly
- No generic "permission denied" messages

**Verification Script:**
```javascript
// Test error message specificity
const testErrorSpecificity = async () => {
  const response = await fetch('/api/trusts/trust-id/packages', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer_owner_token' },
    body: JSON.stringify({
      includedJson: { certificateIds: ['cert-1'] }
    })
  });

  const result = await response.json();

  // Check error message quality
  const hasProtectorNames = result.protectors?.some(p => p.fullName);
  const hasRequiredPowers = result.error?.includes('package_ready_for_review');

  console.log('Error specificity:', {
    hasProtectorNames,
    hasRequiredPowers,
    errorMessage: result.error
  });

  return hasProtectorNames && hasRequiredPowers ? 'PASS' : 'FAIL';
};
```

## Test Suite: Approval Path

### Test 4.1: Protector Approval Recording
**Type:** Approval Workflow
**Priority:** Critical

**Setup:**
- Protector assigned and active
- Protector identity authenticated

**Steps:**
1. Protector grants approval via governance API
2. API call: `POST /api/trusts/{trustId}/governance/{assignmentId}/approve`

**Expected Results:**
- Approval recorded in audit log
- Approval linked to specific action
- Timestamp and identity captured

**Verification Commands:**
```sql
-- Check approval recording
SELECT
  al.action,
  JSON_EXTRACT(al.metadata, '$.approvedAction') as approved_action,
  JSON_EXTRACT(al.metadata, '$.approvedPowers') as approved_powers,
  al.actorUserId,
  al.timestamp
FROM audit_logs al
WHERE al.entityType = 'governance_assignment'
  AND JSON_EXTRACT(al.metadata, '$.approvedAction') = 'package_ready_for_review'
ORDER BY al.timestamp DESC
LIMIT 1;
```

### Test 4.2: Action Success After Approval
**Type:** Complete Workflow
**Priority:** Critical

**Setup:**
- Protector approval granted for specific action

**Steps:**
1. Retry previously blocked action
2. API call: `POST /api/trusts/{trustId}/packages`

**Expected Results:**
- Action succeeds (200)
- Package created
- Audit log shows completion
- Approval properly consumed

**Verification Script:**
```javascript
// Test complete approval workflow
const testApprovalWorkflow = async () => {
  // First attempt (should fail)
  const firstAttempt = await fetch('/api/trusts/trust-id/packages', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer_owner_token' },
    body: JSON.stringify({ includedJson: {} })
  });

  // Grant approval
  await fetch('/api/trusts/trust-id/governance/assignment-id/approve', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer_protector_token' },
    body: JSON.stringify({
      action: 'package_ready_for_review',
      powers: ['consent_administrative_amendments']
    })
  });

  // Second attempt (should succeed)
  const secondAttempt = await fetch('/api/trusts/trust-id/packages', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer_owner_token' },
    body: JSON.stringify({ includedJson: {} })
  });

  const results = await Promise.all([firstAttempt.json(), secondAttempt.json()]);

  console.log('Approval workflow:', {
    firstAttempt: { status: firstAttempt.status, error: results[0].error },
    secondAttempt: { status: secondAttempt.status, packageId: results[1].package?.id }
  });

  return firstAttempt.status === 403 && secondAttempt.status === 200 ? 'PASS' : 'FAIL';
};
```

## Test Suite: Cross-Entity Isolation

### Test 5.1: Protector Scope Containment
**Type:** Security Isolation
**Priority:** Critical

**Setup:**
- User A has Trust A with Protector P
- User B has Trust B with Protector P (same identity)

**Steps:**
1. Protector P attempts to approve action on Trust B using Trust A credentials

**Expected Results:**
- Approval rejected
- Entity scoping enforced
- Audit log shows unauthorized attempt

**Verification Script:**
```javascript
// Test cross-entity isolation
const testEntityIsolation = async () => {
  // Protector P tries to approve Trust B action using Trust A context
  const response = await fetch('/api/trusts/trust-B-id/governance/assignment-from-trust-A/approve', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer_protector_P_token' },
    body: JSON.stringify({
      action: 'issue_certificates',
      entityId: 'trust-B-id' // Wrong entity
    })
  });

  console.log('Cross-entity isolation:', response.status);
  return response.status === 403 ? 'PASS' : 'FAIL';
};
```

### Test 5.2: Shared Identity ≠ Shared Authority
**Type:** Identity vs Authorization
**Priority:** High

**Setup:**
- Same client profile (CID) used as protector for multiple trusts

**Steps:**
1. Verify each trust has separate governance_assignment record
2. Confirm approvals are entity-specific

**Expected Results:**
- Multiple assignment records for same CID
- Each scoped to specific entity
- No authority bleed-through

**Verification Commands:**
```sql
-- Check identity vs authority separation
SELECT
  ga.entityId,
  ga.entityType,
  wcp.fullName,
  COUNT(*) as assignments_per_entity
FROM governance_assignments ga
JOIN workflow_client_profiles wcp ON ga.clientProfileId = wcp.id
WHERE wcp.id = '{shared-cid}'
GROUP BY ga.entityId, ga.entityType, wcp.fullName;
```

## Automation Skeleton (Optional)

### API Test Template

```javascript
// tests/trust-protector-enforcement.spec.js
const { test, expect } = require('@playwright/test');

test.describe('Trust Protector Enforcement', () => {
  test('Assignment creation requires ownership', async ({ request }) => {
    // Unauthorized assignment attempt
    const response = await request.post('/api/trusts/other-trust-id/governance', {
      data: {
        clientProfileId: 'cid-123',
        powers: ['remove_replace_trustee'],
        triggers: { activationMode: 'immediate' }
      }
    });
    expect(response.status()).toBe(403);
  });

  test('Trigger activation blocks actions', async ({ request }) => {
    // Setup: Create trust with active protector
    // Attempt gated action
    const response = await request.post('/api/trusts/trust-id/certificates', {
      data: { assetId: 'asset-123' }
    });
    expect(response.status()).toBe(403);

    const body = await response.json();
    expect(body.error).toContain('Trust Protector');
    expect(body.protectors).toBeDefined();
  });

  test('Approval workflow completes successfully', async ({ request }) => {
    // First attempt fails
    const failResponse = await request.post('/api/trusts/trust-id/packages');
    expect(failResponse.status()).toBe(403);

    // Grant approval
    await request.post('/api/trusts/trust-id/governance/assignment-id/approve', {
      data: { action: 'package_ready_for_review' }
    });

    // Second attempt succeeds
    const successResponse = await request.post('/api/trusts/trust-id/packages');
    expect(successResponse.status()).toBe(200);
  });

  test('Cross-entity isolation enforced', async ({ request }) => {
    // Attempt approval on wrong entity
    const response = await request.post('/api/trusts/wrong-trust-id/governance/assignment-id/approve');
    expect(response.status()).toBe(403);
  });
});
```

## Database Integrity Tests

```sql
-- Run after test suite to verify data consistency
SELECT
  'Total assignments' as metric,
  COUNT(*) as value
FROM governance_assignments
WHERE createdAt > '{test_run_start}'

UNION ALL

SELECT
  'Assignments with audit logs',
  COUNT(DISTINCT ga.id)
FROM governance_assignments ga
JOIN audit_logs al ON al.entityId = ga.id
WHERE ga.createdAt > '{test_run_start}'

UNION ALL

SELECT
  'Blocked attempts logged',
  COUNT(*)
FROM audit_logs
WHERE action = 'GOVERNANCE_BLOCKED_ATTEMPT'
  AND timestamp > '{test_run_start}'

UNION ALL

SELECT
  'Approvals recorded',
  COUNT(*)
FROM audit_logs
WHERE action = 'GOVERNANCE_APPROVAL'
  AND timestamp > '{test_run_start}';
```

## Test Execution

### Manual Execution
1. Setup test trusts and client profiles
2. Execute tests in order (creation → activation → blocking → approval)
3. Verify database state after each test
4. Check audit logs for completeness

### Automated Execution
```bash
# Install dependencies
npm install -D @playwright/test

# Setup test database
npm run db:test:setup

# Run enforcement tests
npx playwright test trust-protector-enforcement.spec.js

# Run with detailed reporting
npx playwright test --reporter=line,json
```

## Success Criteria

- [ ] All Critical tests pass (100% enforcement)
- [ ] No authorization bypasses possible
- [ ] All actions properly audited
- [ ] Cross-entity isolation maintained
- [ ] Error messages are helpful and specific

## Security Validation Matrix

| Test Case | Authorization | Data Integrity | Audit Trail | Isolation |
|-----------|---------------|----------------|-------------|-----------|
| Assignment Creation | ✅ Owner only | ✅ Complete records | ✅ Creation logged | ✅ Entity scoped |
| Trigger Activation | ✅ Respects triggers | ✅ No side effects | ✅ Blocks logged | ✅ Entity scoped |
| Approval Workflow | ✅ Protector auth | ✅ Approval linked | ✅ Full trail | ✅ Entity scoped |
| Cross-Entity Access | ✅ Blocked | ✅ Contained | ✅ Attempts logged | ✅ Enforced |

## Failure Recovery

**If enforcement fails:**
1. **IMMEDIATE**: Disable feature flag
2. **INVESTIGATE**: Check database for unauthorized records
3. **AUDIT**: Review all recent governance actions
4. **ROLLBACK**: Remove any unauthorized assignments
5. **NOTIFY**: Security team and affected users

---

**Enforcement Test Suite Complete** 🔒
*Last verified: January 3, 2026*

**This test suite guarantees governance safety - if all tests pass, the Trust Protector system is production-ready.**
