# Trust Taxonomy Specification (Canonical)

**Version:** 1.0.0
**Date:** January 2026
**Status:** Authoritative

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Canonical Definitions](#canonical-definitions)
3. [Trust Classification Schema](#trust-classification-schema)
4. [Entity Attachment Rules](#entity-attachment-rules)
5. [API Validation Reference](#api-validation-reference)
6. [Consultant Guidelines](#consultant-guidelines)
7. [Common Questions](#common-questions)

---

## Executive Summary

This specification defines the **canonical trust taxonomy** for the Hero Factory Marketplace platform. It establishes authoritative definitions, validation rules, and operational guidelines for trust classification and entity ownership.

### Key Principles

- **Express trusts are the platform default** - All trusts created through wizards are express by definition
- **Commercial activity requires explicit authorization** - No implicit commercial entity ownership
- **S Corporation ownership is IRS-guarded** - Requires qualifying trust structures and election confirmation
- **Complex governance enforces commercial trusts** - Commercial activity demands formal governance

---

## Canonical Definitions

### Trust Categories

| Category | Definition | Platform Usage |
|----------|------------|----------------|
| **Private** | Privately settled trust for asset holding and commercial activity | Most common - allows full entity ownership |
| **Charitable** | Trust for charitable purposes with tax-exempt status | Limited commercial activity |
| **Statutory** | Trust created by operation of law | Rare - typically court-ordered |

### Formation Modes

| Mode | Definition | Platform Default |
|------|------------|------------------|
| **Express** | Intentionally created by written instrument | ✅ **Default** |
| **Resulting** | Created by operation of law when primary purpose fails | Not supported |
| **Constructive** | Imposed by court to prevent unjust enrichment | Not supported |

### Governance Modes

| Mode | Definition | Commercial Trusts |
|------|------------|-------------------|
| **Simple** | Basic trustee authority | Not allowed |
| **Complex** | Strict resolution requirements and formal governance | **Required** |

---

## Trust Classification Schema

### Database Fields (Authoritative)

```typescript
interface TrustClassification {
  // Core Classification
  trustCategory: "private" | "charitable" | "statutory";
  formationMode: "express" | "resulting" | "constructive";

  // Capability Flags
  commercialEnabled: boolean;
  governanceMode: "simple" | "complex";

  // S Corp IRS Compliance Guards
  sCorpEligible: boolean;
  trustSubtype: "standard" | "grantor" | "QSST" | "ESBT";
  irsElectionConfirmed: boolean;
}
```

### Private Express Trust (Canonical Definition)

A **Private Express Trust** is defined as:

> A privately settled trust, intentionally created by written instrument, with formal governance controls and explicit authorization to own and operate commercial entities.

**Required Configuration:**
```typescript
{
  trustCategory: "private",
  formationMode: "express",
  commercialEnabled: true,
  governanceMode: "complex"
}
```

---

## Entity Attachment Rules

### C Corporation

**Status:** ✅ **Always Eligible**
**Requirements:** Commercial + Complex Governance
**Subsidiaries:** Unlimited allowed
**Trust Role:** Shareholder/Owner

### LLC

**Status:** ✅ **Always Eligible**
**Requirements:** Commercial + Complex Governance
**Subsidiaries:** Unlimited allowed
**Trust Role:** Member/Manager

### S Corporation

**Status:** ⚠️ **IRS-Guarded Conditional**
**Requirements:**
- S Corp Eligibility Flag: `true`
- Trust Subtype: `"grantor" | "QSST" | "ESBT"`
- IRS Election Confirmed: `true`
**Subsidiaries:** ❌ **Not Allowed** (preserves S status)
**Trust Role:** Qualified Shareholder

### LP/LLP

**Status:** ✅ **Always Eligible**
**Requirements:** Commercial + Complex Governance
**Subsidiaries:** Allowed
**Trust Role:** Limited/General Partner

---

## API Validation Reference

### Validation Endpoints

#### POST `/api/validate-entity-attachment`
Validates entity attachment for a specific trust.

**Request:**
```typescript
{
  trustId: string,
  entityType: "c_corporation" | "s_corporation" | "llc" | "lp" | "llp"
}
```

**Response:**
```typescript
{
  valid: boolean,
  entityType: string,
  trustId: string,
  trustClassification: TrustClassification,
  validation: {
    eligible: boolean,
    reason?: string,
    requirements?: string[],
    warnings?: string[]
  }
}
```

#### GET `/api/validate-entity-attachment?trustId={id}`
Returns all entity eligibility checks for a trust.

### Error Codes

| Code | Meaning | Resolution |
|------|---------|------------|
| `INVALID_ENTITY_ATTACHMENT` | Trust cannot own this entity type | Check trust configuration |
| `INVALID_TRUST_CONFIGURATION` | Trust setup violates rules | Enable required flags |
| `S_CORP_INELIGIBLE_TRUST` | Trust lacks S Corp qualifications | Set proper subtype + IRS confirmation |

---

## Consultant Guidelines

### Trust Setup Checklist

**For Private Express Trusts:**
- [ ] Set `trustCategory: "private"`
- [ ] Set `formationMode: "express"`
- [ ] Enable `commercialEnabled: true`
- [ ] Set `governanceMode: "complex"`

**For S Corporation Ownership:**
- [ ] Enable `sCorpEligible: true`
- [ ] Set `trustSubtype` to `"grantor"`, `"QSST"`, or `"ESBT"`
- [ ] Confirm `irsElectionConfirmed: true`
- [ ] Document IRS election details

### Client Communication

**✅ Recommended Language:**
- "This is a Private Express Trust designed for commercial entity ownership"
- "The trust is authorized to own and control operating companies"
- "S Corporation ownership requires specialized IRS-compliant trust structures"

**❌ Avoid:**
- "Express Trust Type Required by Law"
- "Special Trust for Commercial Activity"
- "Guaranteed Entity Ownership"

### Documentation Requirements

**Always document:**
- Trust classification rationale
- Entity ownership authorizations
- IRS compliance confirmations (for S Corps)
- Governance mode reasoning

---

## Common Questions

### Q: Can trust names include "Express"?

**A:** No. Trust names are free-form. Classification is structural, not nominative.

### Q: What's the difference between Simple and Complex governance?

**A:** Simple governance allows basic operations. Complex governance enforces strict resolution requirements and is required for commercial entity ownership.

### Q: Can a Private Express Trust own unlimited subsidiaries?

**A:** Yes, for C Corporations and LLCs. S Corporations cannot own subsidiaries while maintaining S status.

### Q: What if a client wants S Corp ownership but lacks IRS qualifications?

**A:** Block the attachment and recommend converting to C Corp or establishing proper trust structure.

### Q: Are charitable trusts allowed commercial activity?

**A:** Limited. Charitable trusts typically cannot engage in for-profit commercial activity.

---

## Implementation Notes

### Database Migration

When updating existing trusts:

1. Set default `formationMode: "express"` for all platform trusts
2. Set `governanceMode: "complex"` where `complexTrustMode: true`
3. Set `trustCategory: "private"` as default
4. Migrate legacy flags to new canonical schema

### API Integration

All entity creation/attachment endpoints should:

1. Call `/api/validate-entity-attachment` before processing
2. Return validation errors to client with actionable requirements
3. Log validation failures for compliance tracking

### UI Updates

Trust Records interface should:

1. Display canonical classification badges
2. Show entity eligibility status
3. Prevent invalid entity attachments at UI level
4. Provide clear guidance for configuration requirements

---

## Revision History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | Jan 2026 | Initial canonical specification |

---

*This specification is authoritative for the Hero Factory Marketplace platform. All trust classifications and entity attachments must comply with these rules.*