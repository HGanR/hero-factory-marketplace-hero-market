# 🚨 URGENT: Fix 500 Errors - Add Environment Variables

## The Problem

You're getting **500 errors** because **environment variables are NOT set in Vercel**.

## ✅ Quick Fix (5 minutes)

### Step 1: Go to Vercel Dashboard
1. Open: https://vercel.com/dashboard
2. Click on project: **hero-market**
3. Click **Settings** tab
4. Click **Environment Variables** in left sidebar

### Step 2: Add These 5 Variables

Click **"Add New"** for each variable below. Make sure to select **Production** environment.

#### Variable 1: DATABASE_URL
- **Name:** `DATABASE_URL`
- **Value:** `mysql://2PrXrw5SH4HNXii.root:oRmXP5c8CYkpIlIU@gateway01.us-east-1.prod.aws.tidbcloud.com:4000/test?ssl={"rejectUnauthorized":true}`
- **Environment:** ✅ Production (check this box)
- Click **Save**

#### Variable 2: ADMIN_USERNAME
- **Name:** `ADMIN_USERNAME`
- **Value:** `admin`
- **Environment:** ✅ Production
- Click **Save**

#### Variable 3: ADMIN_PASSWORD
- **Name:** `ADMIN_PASSWORD`
- **Value:** `HeroAdmin2024!`
- **Environment:** ✅ Production
- Click **Save**

#### Variable 4: JWT_SECRET
- **Name:** `JWT_SECRET`
- **Value:** `hQ2PNx+vOI123VUKW01NeLsvaXVrUG5MJyRXH98UxoI`
- **Environment:** ✅ Production
- Click **Save**

#### Variable 5: NEXT_PUBLIC_APP_NAME
- **Name:** `NEXT_PUBLIC_APP_NAME`
- **Value:** `Hero Market`
- **Environment:** ✅ Production
- Click **Save**

### Step 3: Wait for Redeployment

After adding all variables:
- Vercel will automatically trigger a new deployment
- Wait 1-2 minutes for it to complete
- You'll see a notification when it's done

### Step 4: Test Again

1. Visit your app: https://hero-market-esz4387kn-hganrs-projects.vercel.app
2. Try registering a user
3. Check health endpoint: https://hero-market-esz4387kn-hganrs-projects.vercel.app/api/health

## 🔍 Verify Environment Variables Are Set

After adding variables, visit:
**https://hero-market-esz4387kn-hganrs-projects.vercel.app/api/health**

You should see:
```json
{
  "status": "healthy",
  "environmentVariables": {
    "DATABASE_URL": "✅ Set",
    "ADMIN_USERNAME": "✅ Set",
    "ADMIN_PASSWORD": "✅ Set",
    "JWT_SECRET": "✅ Set",
    "NEXT_PUBLIC_APP_NAME": "✅ Set"
  }
}
```

If you see ❌ Missing for any variable, that variable wasn't added correctly.

## ⚠️ Common Mistakes

1. **Forgot to check "Production"** - Variables must be enabled for Production
2. **Typo in variable name** - Must be exact: `DATABASE_URL` (not `DATABASE_URI`)
3. **Extra spaces** - Don't add spaces before/after the value
4. **Didn't wait for redeployment** - Wait 1-2 minutes after adding variables

## 📝 After Fixing

Once all variables are set:
- ✅ User registration will work
- ✅ Admin panel will load users
- ✅ All API endpoints will work
- ✅ No more 500 errors!

## 🆘 Still Having Issues?

If you still get errors after adding variables:
1. Check the health endpoint: `/api/health`
2. Verify all 5 variables show "✅ Set"
3. Wait 2-3 minutes for redeployment to complete
4. Clear browser cache and try again

