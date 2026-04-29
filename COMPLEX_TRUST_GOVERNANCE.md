# Complex Trust Governance Enforcement

## Overview

This module implements strict governance enforcement for **Irrevocable Complex Trusts**, ensuring that all actions affecting trust assets, income, authority, or beneficiary interests require proper trustee resolutions.

## Key Features

### 1. Resolution Requirements Matrix

For Complex Trusts, the following actions **always require a trustee resolution**:

#### Asset-Related Actions
- Funding trust with any asset
- Real estate transfers (in or out)
- Sale/purchase of property
- Assignment of LLC membership interests
- Purchase/sale of securities (non-routine)
- Pledging assets as collateral
- Loans made by or taken by trust

#### Entity Control Actions (Trust-Owned LLCs/Corps)
- Trust becomes member/shareholder
- Appointment/removal of LLC manager
- Approval of LLC operating agreement
- Capital contributions to LLC
- Distributions from LLC to trust
- Sale of LLC interest
- Guarantee by trust for LLC

#### Income, Distributions & Accumulations
- Any discretionary distribution
- Accumulation of income
- Change in distribution policy
- Extraordinary beneficiary payment
- Withholding distributions

#### Governance & Authority Changes
- Trustee appointment/removal
- Co-trustee action rules
- Delegation of trustee powers
- Amendment (if permitted)
- Change of situs/jurisdiction
- Adoption of investment policy

#### Tax & Compliance Actions
- Tax classification acknowledgment
- Filing position acknowledgment
- Elections affecting trust taxation
- Engagement of tax professionals

### 2. Complex Trust-Specific Resolution Templates

Five specialized templates for Complex Trust governance:

1. **Discretionary Distribution Resolution**
   - For beneficiary distributions
   - Includes fiduciary duty acknowledgment

2. **Income Accumulation Acknowledgment**
   - For retaining income instead of distributing
   - Documents prudence determination

3. **LLC Manager Appointment**
   - For trust-owned LLCs
   - Subject to trustee oversight

4. **Capital Contribution**
   - For contributions to trust-owned entities
   - Requires best interests determination

5. **Annual Fiduciary Review**
   - Periodic governance acknowledgment
   - Documents fulfillment of obligations

### 3. UI Components

#### OwnedEntitiesCard
- Displays all entities owned by a Complex Trust
- Shows ownership percentage, role, managers
- Links to latest trustee approval resolution
- Status badges (Approved / Outdated / Missing)
- CTA to create resolution if missing

#### AuthorityBanner
- Displays on entity dashboards for trust-owned entities
- Shows authority source (which trust owns it)
- Links to latest trustee approval
- Status indicator
- CTA to create resolution if missing

#### GovernanceChain
- Visual representation of trust authority flow
- Shows: Trust → Resolution → Entity Action
- Displays status badges and dates
- Compelling for auditors and counsel

### 4. Action Flow Enforcement

**System checks before allowing actions:**
1. Is entity trust-owned?
2. Is Complex Trust mode enabled?
3. Is there an approved resolution authorizing this action?
4. Are the parent minutes approved/locked?

**If requirements not met:**
- Action is blocked
- User sees clear message
- CTA to "Create Trustee Resolution"

## Implementation Details

### Schema Changes

```typescript
// Added to trusts table:
trustMode: mysqlEnum("trustMode", ["standard", "private_safe", "complex"])
complexTrustMode: boolean("complexTrustMode").default(false)
```

### API Endpoints

- `POST /api/governance/complex-trust/check-requirement`
  - Checks if an action requires a resolution
  - Returns existing eligible resolutions if any

### Enforcement Logic

Located in:
- `/lib/governance/complex-trust-requirements.ts` - Requirement matrix
- `/lib/governance/action-enforcement.ts` - Action blocking logic
- `/lib/governance/resolution-templates.ts` - Complex Trust templates

## Usage

### Enabling Complex Trust Mode

1. Set `trustMode: "complex"` OR `complexTrustMode: true` on a trust
2. System automatically enforces resolution requirements
3. UI components show governance status

### Creating Resolutions

1. Navigate to Trust Records → Governance → Minutes & Resolutions
2. Select appropriate resolution type
3. Use Complex Trust templates when prompted
4. Submit for approval
5. Once approved/locked, actions are unblocked

### Viewing Governance Chain

1. Navigate to Trust Records → [Trust Name]
2. View "Governance Chain" component
3. See visual flow: Trust → Resolutions → Entity Actions

## Strategic Benefits

1. **Governance Discipline**: Trustees cannot act informally
2. **Audit Defense**: Complete paper trail for all actions
3. **Asset Protection**: Reduces failures from informal actions
4. **Differentiation**: Stricter than "trust document generators"
5. **Institutional Credibility**: Bank-ready and counsel-ready

## Next Steps (Optional Enhancements)

1. **Standing Resolutions**: Define scopes for recurring actions
2. **Governance Health Scoring**: Metrics for trust compliance
3. **Automated Reminders**: Alert when resolutions are outdated
4. **Bulk Resolution Creation**: For multiple entities
5. **Resolution Expiration**: Time-based validity rules
