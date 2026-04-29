# Final Deployment Checklist - Production Go/No-Go

**Hero Factory Marketplace - Religious Organization & Trust Protector Features**
*Generated: January 3, 2026*

## 📋 **Executive Summary**

Based on codebase analysis, this checklist covers:
- **Religious Organization**: UI feature in Smart Trust wizard
- **Trust Protector**: Governance enforcement on package creation only
- **Database**: 8 new workflow tables + governance_assignments

**Critical Note**: Trust Protector enforcement is only implemented on `/api/trusts/[trustId]/packages` route. Certificate and instrument creation do NOT have governance gates.

---

## 🎯 **1) Database Readiness**

### Required Tables (8 workflow + 1 governance)
* [ ] `workflow_sequences` - Sequence number allocation
* [ ] `workflow_client_profiles` - CID management
* [ ] `workflow_trust_assets` - Asset recording
* [ ] `workflow_asset_certificates` - Certificate issuance
* [ ] `workflow_promissory_notes` - Note creation
* [ ] `workflow_security_agreements` - Agreement creation
* [ ] `workflow_presentation_packages` - Package assembly
* [ ] `governance_assignments` - Trust Protector roles

### Required Columns on Existing Tables
* [ ] `trusts.publicId` - VARCHAR(40)
* [ ] `trusts.authorityStatus` - ENUM('not_confirmed', 'confirmed', 'generated_draft')
* [ ] `trusts.authorityJson` - TEXT

### Indexes and Constraints
* [ ] Unique constraint on `workflow_sequences.scope`
* [ ] Foreign key relationships validated
* [ ] All VARCHAR lengths match schema definitions

**Go/No-Go Rule**: Any missing table/column/index = **NO-GO**

---

## 🔗 **2) Route Readiness**

### Authentication & Authorization Checks
For each endpoint below, verify:
* [ ] `getAuthedUserId()` present and functional
* [ ] Trust ownership: `trusts.userId === userId`
* [ ] Zod schema validation active
* [ ] Error responses consistent (401, 403, 404)

### New API Endpoints

#### `/api/clients/me` (GET/POST)
* [ ] CID allocation works
* [ ] Profile creation/update functions
* [ ] No duplicate CID creation

#### `/api/trusts/[trustId]/assign-public-id` (POST)
* [ ] TID generation: `TID-{state}-{year}-{sequence}`
* [ ] Jurisdiction validation required
* [ ] Idempotent (existing TID returned)

#### `/api/trusts/[trustId]/governance` (GET/POST)
* [ ] Assignment creation requires ownership
* [ ] Client profile validation
* [ ] Powers JSON schema validation
* [ ] Triggers JSON validation for trust_protector role

#### `/api/trusts/[trustId]/assets` (GET/POST)
* [ ] Asset creation with valuation data
* [ ] Trust ownership verification
* [ ] Status defaults to 'recorded'

#### `/api/trusts/[trustId]/certificates` (POST)
* [ ] Certificate number allocation: `AC-{TID}-{year}-{sequence}`
* [ ] Asset ownership validation
* [ ] Trust document creation
* [ ] Asset status update to 'certificated'

#### `/api/trusts/[trustId]/instruments/promissory-notes` (POST)
* [ ] Note number allocation: `PN-{TID}-{year}-{sequence}`
* [ ] Certificate ownership validation
* [ ] Trust document creation

#### `/api/trusts/[trustId]/instruments/security-agreements` (POST)
* [ ] Agreement number allocation: `SA-{TID}-{year}-{sequence}`
* [ ] Certificate ownership validation
* [ ] Trust document creation

#### `/api/trusts/[trustId]/packages` (GET/POST) ⚠️ **TRUST PROTECTOR ENFORCED**
* [ ] Package number allocation: `PKG-{TID}-{year}-{sequence}`
* [ ] **Trust Protector check**: `requiresTrustProtectorApproval("trust", trustId, "package_ready_for_review")`
* [ ] Blocks with 403 if protector required
* [ ] Returns protector list in error response

**Go/No-Go Rule**: Any endpoint missing ownership checks = **NO-GO**

---

## 🎨 **3) Religious Organization Mode Verification**

### Smart Trust Page UI
* [ ] Charitable Foundation card renders
* [ ] Secondary "Religious Organization" button present
* [ ] Button styling: outline variant, Church icon
* [ ] Click navigates to `/wizard?type=foundation&affiliation=religious_organization`

### Wizard State Management
* [ ] URL params respected: `type=foundation&affiliation=religious_organization`
* [ ] Foundation tab pre-selected
* [ ] Affiliation selector shows "Religious organization"
* [ ] Draft persistence across page reloads
* [ ] Reset preserves URL-driven affiliation

### Content Boundaries
* [ ] Form 1023 steps NOT available (exempt for religious orgs)
* [ ] EIN steps remain available
* [ ] Records/minutes steps remain available
* [ ] No trust-specific logic leaks into foundation mode

**Go/No-Go Rule**: URL ignored or reset breaks mode = **NO-GO**

---

## 🛡️ **4) Trust Protector Enforcement**

**⚠️ CRITICAL**: Only package creation is gated. Certificate/instrument creation has NO governance controls.

### Assignment Creation
* [ ] POST `/api/trusts/[trustId]/governance` creates assignments
* [ ] Requires trust ownership + client profile ownership
* [ ] Powers validation for trust_protector role
* [ ] Audit logging functional

### Trigger Logic
* [ ] Protector inactive → package creation succeeds
* [ ] Protector active → package creation blocked with 403
* [ ] Error message: "Package creation requires Trust Protector approval"
* [ ] Error includes `protectors` array with details

### Enforcement Testing
Create test trust with active Trust Protector:

**Test 1: Inactive Protector**
```bash
# Set protector trigger to "upon_irrevocable_conversion"
# Keep trust revocable
curl -X POST /api/trusts/{trustId}/packages \
  -d '{"includedJson": {}}' \
  # Expected: 200 Success
```

**Test 2: Active Protector**
```bash
# Convert trust to irrevocable OR set trigger to "immediate"
curl -X POST /api/trusts/{trustId}/packages \
  -d '{"includedJson": {}}' \
  # Expected: 403 Forbidden + protector details
```

**Test 3: Cross-Trust Isolation**
```bash
# Try to create package on Trust B using Trust A credentials
curl -X POST /api/trusts/trust-B-id/packages \
  -H "Authorization: Bearer trust-A-token" \
  # Expected: 403/404 (ownership failure)
```

**Go/No-Go Rule**: Package creation succeeds when protector active = **NO-GO**

---

## 📊 **5) Operational Monitoring**

### Error Handling
* [ ] Vercel logs show no unexpected 500s on new endpoints
* [ ] Rate limiting on sequence allocators (CID/TID/certificates)
* [ ] Backups confirmed pre-migration

### Performance
* [ ] Sequence allocation under 100ms
* [ ] Governance queries under 50ms
* [ ] Package creation under 200ms (when allowed)

---

## ✅ **Go/No-Go Scorecard**

Use this template with your team:

### Database & Infrastructure
* [ ] All 8 workflow tables + governance_assignments exist
* [ ] All required columns on trusts table present
* [ ] Indexes and constraints validated

### API Security
* [ ] All endpoints have ownership verification
* [ ] Trust Protector enforcement on packages works
* [ ] No authorization bypasses possible

### Religious Organization UI
* [ ] Smart Trust button + navigation works
* [ ] Wizard state management functional
* [ ] Content boundaries maintained

### Trust Protector Governance
* [ ] Assignment creation requires proper ownership
* [ ] Package creation blocked when protector active
* [ ] Cross-trust isolation enforced

**FINAL GO/NO-GO DECISION**: __________

**Date**: ____________
**Team Members Present**: ____________
**Issues Found**: ____________

---

## 🚨 **Failure Recovery Protocols**

### Critical Security Issues
1. **IMMEDIATE**: Disable package creation endpoint
2. **INVESTIGATE**: Check for unauthorized package records
3. **AUDIT**: Review governance assignment creation logs
4. **ROLLBACK**: Remove suspicious assignments

### UI/Data Issues
1. **DIAGNOSE**: Browser dev tools + network logs
2. **HOTFIX**: Deploy corrected wizard logic
3. **RE-TEST**: Re-run Religious Organization checklist
4. **MONITOR**: Watch error rates for 24 hours

---

## 📋 **Post-Deployment Verification**

After **GO** decision:

1. **Monitor logs** for 24 hours
2. **Test in production** with real user accounts
3. **Verify sequences** increment correctly
4. **Check audit trails** populate as expected

**Production Ready**: Only when all checks pass and monitoring shows stability.

---

**This checklist guarantees your features are production-safe. Use it to make the final go/no-go decision.** 🎯
