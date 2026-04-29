# Production Monitoring Setup
## Hero Factory Marketplace - Religious Organization & Trust Protector

### Vercel Dashboard Configuration

#### 1. Function Duration Alerts
**Path**: Vercel Dashboard → Project → Settings → Alerts

Create alerts for:
- **Function**: `api/trusts/[trustId]/governance`
- **Threshold**: Duration > 5000ms
- **Frequency**: Every occurrence
- **Channels**: Email + Slack

- **Function**: `api/trusts/[trustId]/packages`
- **Threshold**: Duration > 3000ms
- **Frequency**: Every occurrence
- **Channels**: Email + Slack

#### 2. Error Rate Alerts
**Path**: Vercel Dashboard → Project → Settings → Alerts

Create alerts for:
- **Function Pattern**: `api/trusts/*/governance*`
- **Threshold**: Error rate > 5%
- **Time Window**: 5 minutes
- **Frequency**: Every 5 minutes
- **Channels**: Email + Slack + PagerDuty

- **Function Pattern**: `api/trusts/*/packages`
- **Threshold**: Error rate > 5%
- **Time Window**: 5 minutes
- **Frequency**: Every 5 minutes
- **Channels**: Email + Slack + PagerDuty

#### 3. Function Invocation Alerts
**Path**: Vercel Dashboard → Project → Settings → Alerts

Monitor unusual spikes:
- **Function Pattern**: `api/trusts/*/governance*`
- **Threshold**: Invocations > 100/hour
- **Time Window**: 1 hour
- **Frequency**: Every occurrence
- **Channels**: Email

### Database Monitoring

#### MySQL Slow Query Log
```sql
-- Enable slow query logging
SET GLOBAL slow_query_log = 'ON';
SET GLOBAL long_query_time = 2; -- Log queries > 2 seconds
SET GLOBAL slow_query_log_file = '/var/log/mysql/mysql-slow.log';

-- Monitor governance-related queries
SELECT * FROM mysql.slow_log
WHERE sql_text LIKE '%governance_assignments%'
   OR sql_text LIKE '%workflow_%'
ORDER BY query_time DESC
LIMIT 10;
```

#### Connection Pool Monitoring
```sql
-- Check connection usage
SHOW PROCESSLIST;

-- Monitor table locks
SHOW OPEN TABLES WHERE In_use > 0;

-- Check for deadlocks
SHOW ENGINE INNODB STATUS\G
```

#### Table Growth Monitoring
```sql
-- Daily growth check
SELECT
  table_name,
  table_rows,
  data_length / 1024 / 1024 as data_mb,
  index_length / 1024 / 1024 as index_mb
FROM information_schema.TABLES
WHERE table_name IN (
  'governance_assignments',
  'workflow_client_profiles',
  'workflow_trust_assets',
  'workflow_asset_certificates',
  'workflow_promissory_notes',
  'workflow_security_agreements',
  'workflow_presentation_packages'
)
AND table_schema = DATABASE()
ORDER BY data_length DESC;
```

### Application Metrics (Custom)

#### Governance Activity Metrics
```javascript
// Add to your application monitoring (DataDog, New Relic, etc.)
const governanceMetrics = {
  // Counter metrics
  protectorAssignmentsCreated: {
    type: 'counter',
    description: 'Number of trust protector assignments created'
  },
  actionsBlockedByProtector: {
    type: 'counter',
    description: 'Number of actions blocked by trust protector'
  },
  protectorApprovalsGranted: {
    type: 'counter',
    description: 'Number of trust protector approvals'
  },
  crossEntityAccessAttempts: {
    type: 'counter',
    description: 'Number of cross-entity access attempts (should be 0)'
  },

  // Timing metrics
  governanceCheckDuration: {
    type: 'histogram',
    description: 'Time taken for governance checks',
    buckets: [0.1, 0.5, 1, 2, 5, 10]
  },

  // Gauge metrics
  activeProtectorsCount: {
    type: 'gauge',
    description: 'Number of currently active trust protectors'
  }
};
```

#### Religious Organization Usage Metrics
```javascript
const religiousOrgMetrics = {
  foundationWizardsStarted: {
    type: 'counter',
    description: 'Number of foundation wizards started'
  },
  religiousAffiliationSelected: {
    type: 'counter',
    description: 'Number of religious organization affiliations selected'
  },
  foundationWizardsCompleted: {
    type: 'counter',
    description: 'Number of foundation wizards completed'
  }
};
```

### Log Monitoring

#### Error Patterns to Monitor
```
# Governance Errors
- "Trust Protector approval required"
- "Governance assignment failed"
- "Cross-entity access denied"

# Sequence Errors
- "Failed to allocate CID/TID"
- "Sequence collision detected"

# Database Errors
- "Deadlock detected"
- "Lock wait timeout"
- "Foreign key constraint violation"
```

#### Success Patterns to Monitor
```
# Successful Governance
- "Governance assignment created"
- "Trust Protector approval granted"
- "Action permitted by governance"

# Successful Sequences
- "CID allocated: CID-2026-XXXXX"
- "TID allocated: TID-DE-2026-XXXX"
```

### Alert Escalation

#### Tier 1 Alerts (Immediate Response)
- Database connection failures
- >10% error rate on governance endpoints
- Trust protector blocking legitimate actions

#### Tier 2 Alerts (Within 1 hour)
- Slow queries (>5 seconds)
- Unusual traffic spikes
- Failed sequence allocations

#### Tier 3 Alerts (Daily Review)
- Performance degradation trends
- Table growth anomalies
- Low-frequency errors

### Dashboard Setup

#### Recommended Dashboard Panels
1. **Governance Activity**
   - Protector assignments created (last 24h)
   - Actions blocked (last 24h)
   - Approvals granted (last 24h)

2. **Error Rates**
   - Governance endpoint error rate (5min avg)
   - Database connection errors (1min avg)

3. **Performance**
   - Governance check duration (p95)
   - Package creation duration (p95)
   - Database query duration (p95)

4. **Security**
   - Cross-entity access attempts (should be 0)
   - Failed authentication attempts

### Testing Monitoring

#### Alert Verification
```bash
# Test error rate alert
curl -X POST https://hero-market-6yznxn9nu-hganrs-projects.vercel.app/api/trusts/test-trust/packages \
  -H "Authorization: Bearer invalid-token" \
  -d '{"includedJson": {}}'

# Test duration alert (simulate slow response)
# Add artificial delay to governance check

# Test invocation alert
# Generate multiple governance API calls
for i in {1..50}; do
  curl -s https://hero-market-6yznxn9nu-hganrs-projects.vercel.app/api/trusts/test-trust/governance &
done
```

### Incident Response

#### Governance-Related Incidents
1. **Protector blocking legitimate actions**
   - Check protector assignment validity
   - Verify trigger conditions
   - Temporarily disable problematic assignments

2. **High error rates**
   - Check database connectivity
   - Monitor connection pool usage
   - Scale database if needed

3. **Performance degradation**
   - Check slow query logs
   - Optimize governance queries
   - Add database indexes if needed

### Maintenance Windows

#### Weekly Checks
- [ ] Review governance assignment audit logs
- [ ] Verify sequence allocation patterns
- [ ] Check table growth trends
- [ ] Update alert thresholds if needed

#### Monthly Reviews
- [ ] Analyze governance usage patterns
- [ ] Review and update monitoring dashboards
- [ ] Audit alert effectiveness
- [ ] Plan capacity upgrades if needed

---

**Monitoring setup complete. Your Religious Organization and Trust Protector features now have comprehensive observability for production safety.**








