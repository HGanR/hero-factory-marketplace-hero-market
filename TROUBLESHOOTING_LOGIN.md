# Troubleshooting Admin Login

## Current Credentials (from .env.local)
- **Username**: `TROOTHHURTZ` (case-insensitive)
- **Password**: `#renleytaoD2026` (case-sensitive, exact match required)

## Step 1: Restart Dev Server
**IMPORTANT**: After any changes to `.env.local`, you MUST restart the dev server:

```bash
# Stop the server (Ctrl+C)
# Then restart:
npm run dev
```

## Step 2: Check Server Logs
When you try to login, check your terminal/console where `npm run dev` is running. You should see:

```
🔐 Admin login attempt: { ... }
🔐 Admin credential check: { ... }
```

These logs will show:
- What username/password you provided
- What the server is reading from environment variables
- Whether they match

## Step 3: Test Environment Variables
Visit this URL in your browser:
```
http://localhost:3000/api/admin/debug-credentials
```

This will show you:
- What username the server is reading
- What password the server is reading (length only, for security)
- Whether environment variables are loaded

## Step 4: Common Issues

### Issue: "Invalid username or password"
**Possible causes:**
1. **Dev server not restarted** → Restart `npm run dev`
2. **Wrong password case** → Password must be exactly: `#renleytaoD2026`
3. **Extra spaces** → Make sure no spaces before/after
4. **Special characters** → The `#` at the start is required

### Issue: Environment variables not loading
**Check:**
1. File is named exactly `.env.local` (not `.env.local.txt`)
2. File is in the `hero-market` directory (same as `package.json`)
3. No quotes around values in `.env.local`:
   ```
   ✅ Correct: ADMIN_USERNAME=TROOTHHURTZ
   ❌ Wrong: ADMIN_USERNAME="TROOTHHURTZ"
   ```

## Step 5: Verify What You're Entering

**Username**: Can be any case:
- `TROOTHHURTZ` ✅
- `troot hurtz` ✅
- `TrootHurtz` ✅

**Password**: Must be exact (case-sensitive):
- `#renleytaoD2026` ✅
- `#RenleytaoD2026` ❌ (wrong case)
- `renleytaoD2026` ❌ (missing #)
- `#renleytaod2026` ❌ (wrong case)

## Debug Steps

1. **Check terminal logs** when you click login
2. **Visit** `http://localhost:3000/api/admin/debug-credentials`
3. **Compare** what server sees vs what you entered
4. **Restart dev server** if environment variables don't match

## Expected Behavior

When credentials match:
- Server logs show `willAuthenticate: true`
- API returns `{ success: true, isAdmin: true }`
- Browser redirects to `/administration1`
- Admin panel loads





