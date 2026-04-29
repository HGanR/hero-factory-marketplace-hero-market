# Due Diligence — Security Findings

**Context:** Third-party valuation, Trust sale, investor pitch, acquisition readiness.

---

## Revised Finding 1: Historical Credential Material in Repository Documentation

**Severity:** High (security hygiene / diligence concern)  
**Not:** Critical operational exposure (unless values are confirmed active)

**Location:**  
`ENVIRONMENT_VARIABLES_CHECKLIST.md`, `VERCEL_DEPLOYMENT.md`, `STEP_BY_STEP_FIX.md`, `URGENT_FIX.md`, `UPDATE_PASSWORD_INSTRUCTIONS.md`, `ADMIN_LOGIN_FLOW.md`, `LOGIN_FLOW_VERIFICATION.md`, `LOCAL_DEV_SETUP.md`, `AUTH_SETUP.md`, `VERCEL_ENV_SETUP.md`, and other deployment/setup docs.

**Impact:**  
No evidence yet that these are active production secrets. However, their presence indicates prior secret handling in version-controlled files. This is a **security hygiene and due-diligence concern** because it suggests:

- Secrets were previously stored in versioned files
- Rotation discipline may be unclear
- There may be other undiscovered leaks in git history

**Recommended response:**  
Confirm all such values are inactive, rotated, removed from tracked files, and not recoverable through accessible git history.

**Remediation status:**  
- [x] All credential-like values removed from tracked documentation  
- [x] Placeholders only (e.g. `YOUR_PASSWORD`, `your_admin_username`)  
- [ ] Rotation confirmed for any values that may have been used  
- [ ] Git history scrubbed if necessary (BFG Repo-Cleaner or equivalent)

---

## Distinction: Active vs. Historical

| Scenario | Severity | Action |
|----------|----------|--------|
| Values are **active** in production | Critical | Immediate rotation, remove from repo |
| Values are **obsolete** (rotated, never used in prod) | High (hygiene) | Remove from files, document rotation |
| Only **placeholder patterns** (e.g. `YOUR_PASSWORD`) | Low | Acceptable; no real secrets |

---

## Cleanup Checklist (Pre-Diligence)

1. Remove all old credential-like values from `ENVIRONMENT_VARIABLES_CHECKLIST.md`, deployment docs, and any markdown/setup files.
2. Rotate anything that may have been used before, if not already rotated.
3. Search the repo for secret patterns: `JWT_SECRET`, `DATABASE_URL`, `ADMIN_`, `API_KEY`, `SECRET`, `PASSWORD`, `TOKEN`.
4. Check git history; diligence can include commit history, not just current files.
5. Target statement for auditors/buyers/investors:

   > "No active credentials are stored in the repository. Any legacy values found in documentation are obsolete, have been rotated, and are being removed from tracked files."
