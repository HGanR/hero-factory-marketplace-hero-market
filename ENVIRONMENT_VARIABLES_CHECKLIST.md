# Environment Variables Checklist for Vercel

## ⚠️ CRITICAL: Add These in Vercel Dashboard

The 500 errors are happening because environment variables aren't set in Vercel!

### Steps to Add Environment Variables:

1. **Go to Vercel Dashboard:**
   - https://vercel.com/dashboard
   - Click on your project: `hero-market`

2. **Navigate to Settings:**
   - Click **Settings** tab
   - Click **Environment Variables** in the left sidebar

3. **Add These Variables (for Production environment):**

   | Variable Name | Value |
   |--------------|-------|
   | `DATABASE_URL` | `mysql://2PrXrw5SH4HNXii.root:oRmXP5c8CYkpIlIU@gateway01.us-east-1.prod.aws.tidbcloud.com:4000/test?ssl={"rejectUnauthorized":true}` |
   | `ADMIN_USERNAME` | `admin` |
   | `ADMIN_PASSWORD` | `HeroAdmin2024!` |
   | `JWT_SECRET` | `hQ2PNx+vOI123VUKW01NeLsvaXVrUG5MJyRXH98UxoI` |
   | `NEXT_PUBLIC_APP_NAME` | `Hero Market` |

4. **Important Settings:**
   - Select **Production** environment for all variables
   - You can also add to **Preview** and **Development** if you want
   - Click **Save** after adding each variable

5. **After Adding Variables:**
   - Vercel will automatically trigger a new deployment
   - Wait for the deployment to complete (1-2 minutes)
   - Test the app again

## 🔍 How to Verify Variables Are Set:

1. Go to: Settings → Environment Variables
2. You should see all 5 variables listed
3. Make sure they're enabled for **Production**

## 🚨 Common Issues:

- **500 errors**: Environment variables not set or incorrect
- **Database connection errors**: DATABASE_URL is wrong or missing
- **Admin login works but registration doesn't**: DATABASE_URL might be set but other vars missing

## ✅ After Adding Variables:

The app should work! Test:
- User registration
- Admin login
- User management

