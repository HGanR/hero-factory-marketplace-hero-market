# How to Update TiDB Password in .env.local

## Current Issue
The password `3nKcgeu00nKCsOmF` in your `.env.local` file doesn't match what TiDB Cloud expects.

## Steps to Fix

### 1. Get the Correct Password from TiDB Cloud

1. Go to: https://tidbcloud.com
2. Click **Clusters** → Select your cluster
3. Click **Connect** button
4. Look at the connection string shown - it will look like:
   ```
   mysql://2PrXrw5SH4HNXii.root:YOUR_PASSWORD_HERE@gateway01.us-east-1.prod.aws.tidbcloud.com:4000/test
   ```
5. Copy the password (the part between `:` and `@`)

### 2. Option A: Reset Password (Recommended if you don't know it)

1. In the Connect dialog, click **"Reset Password"** or **"Generate Password"**
2. Copy the new password immediately (you won't see it again!)
3. Use this new password in step 3

### 3. Update .env.local

**Option 1: Tell me the password and I'll update it for you**

Just provide the password and I'll update the file.

**Option 2: Update manually**

1. Open `/Users/apple/Desktop/hero-factory-marketplace/hero-market/.env.local` in Cursor
2. Find this line:
   ```
   DATABASE_URL=mysql://2PrXrw5SH4HNXii.root:3nKcgeu00nKCsOmF@gateway01.us-east-1.prod.aws.tidbcloud.com:4000/test?ssl={"rejectUnauthorized":true}
   ```
3. Replace `3nKcgeu00nKCsOmF` with your actual password from TiDB Cloud
4. Save the file

### 4. Test the Connection

After updating, run:
```bash
cd /Users/apple/Desktop/hero-factory-marketplace/hero-market
npm run db:push
```

## Important Notes

- **Password may contain special characters** - Make sure to copy it exactly
- **No extra spaces** - Don't add spaces before or after the password
- **Case sensitive** - Passwords are case-sensitive
- **URL encoding** - If your password has special characters like `@`, `:`, `/`, they might need URL encoding, but usually TiDB Cloud passwords don't have these

## Common Issues

- **Copy-paste errors**: Make sure you copied the entire password
- **Old password**: If you reset the password, make sure you're using the NEW one
- **Extra characters**: Check for leading/trailing spaces

