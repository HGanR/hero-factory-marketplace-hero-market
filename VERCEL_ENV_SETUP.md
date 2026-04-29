# Vercel Environment Variables Setup

## Required Environment Variables for Admin Access

You **MUST** add these environment variables in Vercel for admin login to work:

### Step 1: Go to Vercel Dashboard
1. Go to your project on [vercel.com](https://vercel.com)
2. Click on your project
3. Go to **Settings** → **Environment Variables**

### Step 2: Add Admin Credentials

Add these two environment variables:

```
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_secure_password_here
```

**Important:**
- Replace `your_secure_password_here` with a strong password
- The username is case-insensitive (will be converted to lowercase)
- The password is **CASE SENSITIVE** - must match exactly

### Step 3: Apply to All Environments

Make sure to add these to:
- ✅ **Production**
- ✅ **Preview** (optional, but recommended)
- ✅ **Development** (optional, but recommended)

### Step 4: Redeploy

After adding environment variables:
1. Go to **Deployments** tab
2. Click the **"..."** menu on the latest deployment
3. Click **"Redeploy"**

**OR** push a new commit to trigger a new deployment

## Local Development Setup

For local development, create a `.env.local` file in the `hero-market` directory:

```bash
# hero-market/.env.local
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_secure_password_here
```

Then restart your dev server:
```bash
npm run dev
```

## Testing Admin Login

1. Go to your site
2. Click the **"Login"** button in the top bar
3. Enter your admin credentials:
   - Username: `admin` (or whatever you set in ADMIN_USERNAME)
   - Password: Your ADMIN_PASSWORD value
4. You should be redirected to `/administration1`
5. The **"Admin Panel"** button should appear in the top bar

## Troubleshooting

### If login fails:
1. Check that environment variables are set in Vercel
2. Make sure you redeployed after adding variables
3. Check the password is case-sensitive and matches exactly
4. Check browser console for errors
5. Check Vercel function logs for errors

### To verify variables are loaded:
- Check Vercel function logs - you should see debug output showing the expected username/password (masked)
- The login API will log what it's comparing (see `/api/admin/login.ts`)

## Security Notes

- **Never commit** `.env.local` to git
- Use a **strong, unique password** for production
- Consider changing the admin username from "admin" to something less obvious
- The password is stored in plain text in the environment variable (not hashed) - this is intentional for admin access, but keep the environment variable secure





