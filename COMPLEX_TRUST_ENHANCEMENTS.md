# Complex Trust High-Value Enhancements

## Overview

Three enhancements that elevate the platform from "excellent" to "best-in-class" for Complex Trust governance.

## 1. Governance Health Scoring ✅

### Purpose
Passive, read-only compliance indicator on Trust dashboard - a "compliance radar" without adding friction.

### Features
- **Health Score (0-100)**: Calculated based on governance compliance
- **Status Indicators**:
  - ✅ **Healthy** (90-100): All required governance actions current
  - ⚠️ **Warning** (70-89): Needs attention
  - ❌ **Critical** (<70): Action required

### Checks Performed
1. **Annual Trustee Review**: Must be completed within last 12 months
   - Checks for resolutions with "annual" or "fiduciary review" in title
   - Critical issue if missing or outdated

2. **Expired Resolutions**: Flags resolutions past expiration date
   - Critical issue if expired
   - Warning if expiring within 30 days

3. **Annual Reaffirmation**: Checks if standing resolutions requiring reaffirmation are current
   - Critical issue if overdue

### API Endpoint
- `GET /api/governance/complex-trust/health-score?trustId={trustId}`

### UI Component
- `<GovernanceHealthIndicator trustId={trustId} />`
- Displays on Trust dashboard
- Shows score, issues with action links, review dates

### Example Issues
- ❌ Missing annual trustee review
- ⚠️ Entity actions without recent trust approvals
- ⚠️ Income accumulated without acknowledgment resolution
- ❌ Resolution expired on [date]

## 2. Standing Resolution Scope Guardrails ✅

### Purpose
Enforces that standing resolutions in Complex Trusts are:
- **Narrower** in scope
- **Time-limited** (expiration dates)
- **Periodically reaffirmed** (annual requirements)

### Schema Additions
```typescript
maxDollarThreshold: decimal // Max amount per action
requiresAnnualReaffirmation: boolean
lastReaffirmedAt: date // Date of last reaffirmation
```

### Enforcement Rules

#### Monetary Thresholds
- Standing resolutions can set `maxDollarThreshold`
- Actions exceeding threshold are blocked
- Requires specific resolution for larger amounts

#### Expiration Dates
- All standing resolutions should have `expirationDate`
- System blocks use of expired resolutions
- Warns when expiration is within 30 days

#### Annual Reaffirmation
- Standing resolutions can require `requiresAnnualReaffirmation: true`
- Must be reaffirmed within 12 months of `lastReaffirmedAt`
- System blocks use if overdue

#### Blocked Actions
These actions **CAN NEVER** be covered by standing resolutions (must be specific):
- `APPOINT_TRUSTEE`
- `REMOVE_TRUSTEE`
- `AMEND_TRUST`
- `CHANGE_SITUS`
- `SALE_LLC_INTEREST`
- `GUARANTEE_FOR_LLC`
- `PLEDGE_ASSETS`
- `LOAN_TAKEN_BY_TRUST`

### Validation Function
- `validateStandingResolution(resolutionId, actionAmount?)`
- Returns: `{ valid, reason, requiresReaffirmation, daysUntilExpiration }`

### Usage
```typescript
const check = await validateStandingResolution(resolutionId, actionAmount);
if (!check.valid) {
  // Block action, show reason
}
```

## 3. Trustee Packet Export ✅

### Purpose
Institutional-grade export for banks, title companies, and counsel - what they actually ask for.

### Contents
1. **Trust Instrument Reference**
   - Trust name, ID, type
   - Jurisdiction, situs
   - Public ID

2. **Latest Annual Trustee Review**
   - Date
   - Resolution title
   - Status

3. **All Resolutions Affecting Selected Context**
   - Filtered by entityId (optional)
   - Filtered by assetId (optional)
   - Or all resolutions if no filter

4. **Governance Chain Visualization**
   - Trust → Resolution → Entity Action flow
   - Shows relationships

5. **Final Hashes**
   - Immutable record hashes
   - Audit trail integrity

### API Endpoint
- `POST /api/governance/complex-trust/trustee-packet`
- Body: `{ trustId, entityId?, assetId? }`
- Returns: `{ exhibitId, fileName, fileHash }`

### PDF Generation
- Python script: `scripts/generate_trustee_packet_pdf.py`
- Uses ReportLab
- Professional formatting
- Suitable for institutional submission

### Use Cases
- **Bank Account Opening**: Submit trustee packet showing authority
- **Title Company Requests**: Show governance chain for property transfers
- **Counsel Review**: Complete governance record for legal review
- **Audit Defense**: Comprehensive paper trail

## Implementation Status

### ✅ Completed
- Governance Health Scoring system
- Standing Resolution Guardrails
- Trustee Packet Export
- UI Components
- API Endpoints
- Schema Updates

### 🔄 Future Enhancements (Optional)
1. **Automated Reminders**: Email alerts for expiring resolutions
2. **Bulk Reaffirmation**: Reaffirm multiple resolutions at once
3. **Health Score History**: Track score over time
4. **Custom Health Rules**: Allow admins to define custom compliance rules
5. **Standing Resolution Templates**: Pre-configured standing resolution types

## Strategic Value

### Differentiation
- **Beyond Document Generation**: Active governance enforcement
- **Institutional Credibility**: Bank-ready and counsel-ready
- **Compliance Automation**: Reduces manual oversight burden
- **Audit Defense**: Complete, verifiable governance trail

### User Benefits
1. **Trustees**: Clear visibility into compliance status
2. **Banks**: Ready-to-submit governance packets
3. **Counsel**: Complete governance record for review
4. **Auditors**: Verifiable compliance indicators

## Technical Notes

### Health Scoring Algorithm
- Base score: 100
- Annual review missing: -30
- Expired resolution: -15 each
- Expiring resolution: -5 each
- Overdue reaffirmation: -20 each

### Standing Resolution Validation
- Checks: expiration, monetary threshold, reaffirmation status
- Blocks: expired, exceeded threshold, overdue reaffirmation
- Warns: expiring soon, reaffirmation due soon

### Trustee Packet Filtering
- Can filter by `entityId` for entity-specific packets
- Can filter by `assetId` for asset-specific packets
- If no filter, includes all resolutions

## Next Steps (User Requested)

If desired, can implement:
1. **Complex Trust Onboarding Checklist**: Step-by-step setup guide
2. **Standing Resolution Scope Definitions**: What actions can/cannot use standing resolutions
3. **Product Language**: Safe, clear articulation of capabilities without legal overreach
