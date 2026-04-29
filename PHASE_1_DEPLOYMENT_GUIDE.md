# Phase 1 Deployment Guide

## Quick Start

### 1. Review Schema Changes

The following changes have been made to `src/lib/db/schema.ts`:

- ✅ Added `instruments` table
- ✅ Added `public_witnesses` table  
- ✅ Added `instrumentId` column to `deeds` table (nullable, optional)

### 2. Apply Schema Changes

```bash
cd hero-market
npm run db:push
```

**Important:** Review the preview that `drizzle-kit push` shows before confirming. It should show:
- Creating `instruments` table
- Creating `public_witnesses` table
- Adding `instrumentId` column to `deeds` table

### 3. Set Feature Flag (Optional)

By default, instruments are **enabled**. To disable:

```bash
# In .env.local or Vercel environment variables
INSTRUMENTS_ENABLED=false
```

### 4. Backfill Existing Deeds

```bash
# Dry run first (recommended)
tsx scripts/backfill-instruments-for-deeds.ts --dry-run

# Execute
tsx scripts/backfill-instruments-for-deeds.ts
```

### 5. Verify

1. Create a new deed → Check that instrument is created automatically
2. Execute a deed → Check that instrument status updates to `executed`
3. Record a deed → Check that instrument status updates to `recorded`
4. Test API: `GET /api/instruments?trustId=xxx`

---

## Rollback (If Needed)

### Fast Rollback (No DB Changes)

1. Set `INSTRUMENTS_ENABLED=false` in environment
2. Redeploy
3. Deed flows continue normally without instruments

### Hard Rollback (Requires DB Changes)

**Only if absolutely necessary:**

1. Revert code changes
2. Manually remove:
   - `instruments` table
   - `public_witnesses` table
   - `deeds.instrumentId` column

**Note:** Hard rollback is not recommended. The feature is designed to be non-breaking.

---

## Testing Checklist

- [ ] Schema changes applied successfully
- [ ] New deeds get instruments automatically
- [ ] Deed execution updates instrument status
- [ ] Deed recording updates instrument status
- [ ] Backfill script runs successfully
- [ ] API endpoints return correct data
- [ ] No errors in application logs

---

## Support

If you encounter issues:
1. Check `INSTRUMENTS_ENABLED` is not set to `false`
2. Verify schema changes were applied
3. Check application logs for errors
4. Ensure deed context (trustId/entityId) is valid
