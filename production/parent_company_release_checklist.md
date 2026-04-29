# Parent Company + C-Corp Wizard — Production Release Checklist

## Pre-Release Requirements ✅

### 1. Database Migration
- [ ] Run `migrations/parent_company_production_migration.sql` on production MySQL
- [ ] Verify tables created: `companies`, `company_affiliations`, `company_sequences`
- [ ] Confirm all foreign keys and unique constraints applied
- [ ] Run verification queries (expect 0 rows for duplicates)

### 2. Code Deployment
- [ ] Deploy to production environment
- [ ] Verify all API endpoints accessible:
  - `GET|POST /api/companies`
  - `GET|PATCH|DELETE /api/companies/[id]`
  - `GET|POST /api/companies/[id]/affiliations`
  - `POST /api/companies/[id]/documents` (placeholder)
  - `PATCH /api/companies/[id]/status`
- [ ] Confirm wizard UI accessible at `/wizard?type=company`

### 3. Deterministic Testing (Run All Tests)

#### Ownership Isolation Tests
- [ ] **Test A1**: UserA creates company, UserB cannot access (404/403)
- [ ] **Test A2**: Cannot create affiliations linking cross-owner entities
- [ ] **Test A3**: Valid same-owner affiliations work correctly

#### Sequence & Uniqueness Tests
- [ ] **Test B1**: Concurrent company creation produces unique `publicCompanyId`
- [ ] **Test B2**: Sequences increment monotonically without gaps

#### Idempotency & Workflow Tests
- [ ] **Test C1**: Duplicate "Generate outputs" calls don't create duplicates
- [ ] **Test C2**: Execution readiness workflow transitions work with audit trails

#### Integration Tests
- [ ] **Test D1**: Complete wizard flow from homepage to company creation
- [ ] **Test D2**: Company-trust affiliations integrate with existing trust system

## Go/No-Go Decision Gate

### ✅ GO Criteria (All Must Pass)
- [ ] Zero ownership violations (UserA cannot access UserB's companies/affiliations)
- [ ] Zero duplicate publicCompanyIds or affiliations in database
- [ ] Zero duplicate documents created under concurrent/idempotent calls
- [ ] All status transitions work with proper validation and audit trails
- [ ] Complete wizard flow works end-to-end without errors
- [ ] All verification queries return expected results (0 duplicate rows)

### ❌ NO-GO Criteria (Any Failure Blocks Release)
- [ ] Any ownership isolation test fails
- [ ] Any uniqueness constraint violated
- [ ] Any idempotency test creates duplicates
- [ ] Any status workflow validation fails
- [ ] Any integration test fails

## Post-Release Monitoring

### Daily Health Checks
```sql
-- Check for ownership violations
SELECT COUNT(*) as violations FROM company_affiliations ca
LEFT JOIN companies c1 ON ca.parentCompanyId = c1.id
LEFT JOIN companies c2 ON ca.subsidiaryCompanyId = c2.id
WHERE ca.userId != c1.userId OR (c2.id IS NOT NULL AND ca.userId != c2.userId);

-- Check for duplicates
SELECT publicCompanyId, COUNT(*) c FROM companies GROUP BY publicCompanyId HAVING c > 1;
```

### Key Metrics to Track
- [ ] Companies created per day
- [ ] Affiliations created per day
- [ ] Status transitions (draft → counsel_reviewed → board_adopted → execution_ready)
- [ ] Error rate on API endpoints
- [ ] User drop-off at each wizard step

### Alert Thresholds
- [ ] >0 ownership violations (immediate investigation)
- [ ] >0 duplicate publicCompanyIds (sequence bug)
- [ ] >5% API error rate (performance issue)
- [ ] >50% wizard completion drop-off (UX issue)

## Rollback Plan

If issues detected post-release:

1. **Immediate**: Disable company creation via feature flag
2. **Database**: No destructive changes needed (all operations are additive)
3. **Code**: Roll back to previous deployment
4. **Communication**: Notify affected users, offer manual company creation

## Success Criteria (Week 1)

- [ ] 100+ companies created without ownership violations
- [ ] 50+ affiliations created without boundary violations
- [ ] <1% API error rate
- [ ] >70% wizard completion rate
- [ ] Zero duplicate publicCompanyIds or affiliations

---

## Final Sign-Off

**Technical Lead**: ____________________ Date: __________
**Product Owner**: ____________________ Date: __________
**Security Review**: __________________ Date: __________

**Release Approved**: ☐ Yes ☐ No
**Comments**: ___________________________________________








