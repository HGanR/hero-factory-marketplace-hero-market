# Deeds & Recording Module - Institutional Hardening

## ✅ Completed Hardening Controls

### 1. Monotonic State Transitions ✅
- **State Machine Guard**: Created `/lib/deeds/state-machine.ts`
- **Valid Transitions**:
  - `DRAFT → PENDING → APPROVED → EXECUTED → RECORDED → LOCKED`
  - Also allows: `APPROVED → LOCKED` (for locked approval packets without execution)
- **Enforcement**: All status transition endpoints validate using `validateDeedStatusTransition()`
- **Prevents**: Illegal jumps like `DRAFT → RECORDED`, `EXECUTED → APPROVED`, etc.

### 2. Execution Immutability After Recording ✅
- **Rule**: Once `status = RECORDED`, execution fields are read-only
- **Enforcement**:
  - `PATCH /api/assets/deeds/[deedId]` blocks execution edits when recorded
  - `POST /api/assets/deeds/[deedId]/mark-executed` blocks updates if already recorded
- **Exception**: Can still attach missing receipt exhibits

### 3. Executed Exhibit Required Before RECORDED ✅
- **Rule**: `mark-recorded` requires `executedPdfExhibitId` present
- **Enforcement**: `POST /api/assets/deeds/[deedId]/mark-recorded` validates before allowing transition
- **Error Code**: `MISSING_EXECUTED_EXHIBIT`

### 4. Recording Receipt Exhibit Linkage ✅
- **Field**: `deedRecordings.recordingReceiptExhibitId`
- **Usage**: Stores county receipt, recording confirmation, or stamped first page
- **UI**: Available in `mark-recorded` endpoint and deed detail page

### 5. Hash Strategy ✅
- **Final Hash Includes**:
  - Deed core fields (id, clientId, trustId/entityId, deedType, status, approval IDs)
  - Property snapshot (full property record)
  - Parties snapshot (all party records)
  - Execution snapshot (full execution record)
  - Recording snapshot (full recording record)
  - **Exhibit hashes** (not just IDs) - critical for integrity
  - Version identifiers (createdAt, updatedAt, lockedAt)
- **Location**: `POST /api/assets/deeds/[deedId]/lock` generates `finalHash`
- **Purpose**: Prevents "hash remains same but an exhibit changed" issues

### 6. Authority Summary Export ✅
- **Endpoint**: `POST /api/assets/deeds/[deedId]/authority-summary`
- **Script**: `scripts/generate_authority_summary_pdf.py`
- **Contents**:
  - Deed info (ID, type, status, final hash)
  - Approving resolution header (title, ID, type, effective date)
  - Minutes reference (title, ID, status, action date)
  - Property details
  - Execution checklist
  - Recording metadata
  - Exhibit list with hashes
  - Final hash section
- **Use Case**: Title companies and banks want this complete packet

## 🔧 Runtime Notes

### Python Execution (Critical)

**If deploying on serverless (Vercel, AWS Lambda, etc.)**:
- Python scripts (`generate_deed_pdf.py`, `generate_authority_summary_pdf.py`) will **fail** unless:
  - You use a container-based deployment (Docker)
  - You use a separate worker/API service that supports Python
  - You migrate PDF generation to a Node.js library (e.g., `pdfkit`, `pdfmake`, `puppeteer`)

**If deploying on container/worker (Railway, Render, Fly.io, etc.)**:
- Python execution is supported
- Ensure `python3` and `reportlab` are installed in the container

**Recommendation**:
- For production serverless: Consider migrating to Node.js PDF generation or use an external PDF service
- For production containers: Current Python approach is fine

## 📋 Audit Log Actions

All deed actions are logged:
- `CREATE_DEED`
- `CREATE_DEED_PROPERTY` / `UPDATE_DEED_PROPERTY`
- `UPDATE_DEED_PARTIES`
- `LINK_APPROVAL`
- `GENERATE_DRAFT_PDF`
- `MARK_DEED_APPROVED`
- `MARK_DEED_EXECUTED`
- `MARK_DEED_RECORDED`
- `LOCK_DEED`

## 🔒 Security Controls

1. **Context Isolation**: Deeds cannot link to resolutions from different trusts/entities
2. **Data Integrity**: "Exactly one of trustId/entityId" enforced everywhere
3. **Immutability**: Locked deeds with final hash provide audit trail
4. **State Machine**: Prevents illegal state transitions
5. **Execution Immutability**: Recorded deeds cannot have execution modified
6. **Exhibit Requirements**: Executed exhibit required before recording

## 📄 Next Steps (Optional Enhancements)

1. **State/County-Aware Execution Checklist**: Add witness requirements and acknowledgement blocks based on property jurisdiction
2. **Bulk Authority Summary Export**: Generate summaries for multiple deeds
3. **Recording Workflow Integration**: Direct integration with county recording systems (if available)
4. **E-Signature Integration**: Support for RON (Remote Online Notarization) workflows
