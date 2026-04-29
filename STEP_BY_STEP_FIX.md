# 🚨 STEP-BY-STEP: Fix Database Connection Error

## The Error You're Seeing

"Database connection failed. Please check environment variables in Vercel Dashboard."

This means **DATABASE_URL is NOT set in Vercel**.

## ✅ SOLUTION: Add Environment Variables (5 minutes)

### Step 1: Open Vercel Dashboard
1. Go to: **https://vercel.com/dashboard**
2. Click on project: **hero-market**
3. Click **Settings** (top navigation)
4. Click **Environment Variables** (left sidebar)

### Step 2: Add DATABASE_URL (Most Important!)

1. Click **"Add New"** button
2. **Key/Name:** Type exactly: `DATABASE_URL`
3. **Value:** Copy and paste this EXACTLY:
   ```
   mysql://2PrXrw5SH4HNXii.root:oRmXP5c8CYkpIlIU@gateway01.us-east-1.prod.aws.tidbcloud.com:4000/test?ssl={"rejectUnauthorized":true}
   ```
4. **Environment:** Check the box for **Production** ✅
5. Click **Save**

### Step 3: Add Other Variables

Repeat for each variable below:

#### ADMIN_USERNAME
- **Key:** `ADMIN_USERNAME`
- **Value:** `admin`
- **Environment:** ✅ Production
- **Save**

#### ADMIN_PASSWORD
- **Key:** `ADMIN_PASSWORD`
- **Value:** `HeroAdmin2024!`
- **Environment:** ✅ Production
- **Save**

#### JWT_SECRET
- **Key:** `JWT_SECRET`
- **Value:** `hQ2PNx+vOI123VUKW01NeLsvaXVrUG5MJyRXH98UxoI`
- **Environment:** ✅ Production
- **Save**

#### NEXT_PUBLIC_APP_NAME
- **Key:** `NEXT_PUBLIC_APP_NAME`
- **Value:** `Hero Market`
- **Environment:** ✅ Production
- **Save**

### Step 4: Wait for Redeployment

After adding variables:
- Vercel will show "Redeploying..." notification
- Wait **2-3 minutes** for deployment to complete
- You'll see "Deployment successful" when done

### Step 5: Test Again

1. Go to your app: **https://hero-market-5g8ja9hb4-hganrs-projects.vercel.app**
2. Try registering a user
3. It should work now! ✅

## 🔍 How to Verify Variables Are Added

1. Go to: **Settings → Environment Variables**
2. You should see **5 variables** listed:
   - DATABASE_URL ✅
   - ADMIN_USERNAME ✅
   - ADMIN_PASSWORD ✅
   - JWT_SECRET ✅
   - NEXT_PUBLIC_APP_NAME ✅
3. Each should have **Production** checked ✅

## ⚠️ Common Mistakes

1. **Forgot to check "Production"** - Variables won't work if not enabled for Production
2. **Typo in variable name** - Must be exact: `DATABASE_URL` (not `DATABASE_URI` or `DB_URL`)
3. **Extra spaces** - Don't add spaces before/after the value
4. **Didn't wait for redeployment** - Wait 2-3 minutes after adding

## 🆘 Still Not Working?

If you still get errors after adding variables:

1. **Double-check variable names** - They must match exactly
2. **Verify Production is checked** - For ALL variables
3. **Wait longer** - Sometimes takes 3-5 minutes
4. **Check Vercel logs** - Go to Deployments → Click latest → View Function Logs

## 📝 Quick Checklist

- [ ] Opened Vercel Dashboard
- [ ] Went to Settings → Environment Variables
- [ ] Added DATABASE_URL with Production checked
- [ ] Added ADMIN_USERNAME with Production checked
- [ ] Added ADMIN_PASSWORD with Production checked
- [ ] Added JWT_SECRET with Production checked
- [ ] Added NEXT_PUBLIC_APP_NAME with Production checked
- [ ] Waited 2-3 minutes for redeployment
- [ ] Tested user registration

Once all checked, the app should work! 🎉

