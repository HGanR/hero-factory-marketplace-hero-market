# Local Development Setup - Admin Login

## Quick Fix for "Login failed. Please try again."

If you're getting login errors in local development (`npm run dev`), you need to add admin credentials to your `.env.local` file.

### Step 1: Open `.env.local`

The file is located at: `hero-market/.env.local`

### Step 2: Add These Lines

Add these two lines to the end of your `.env.local` file:

```bash
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
```

**Important:** 
- Change `admin123` to a secure password of your choice
- The password is **CASE SENSITIVE**
- Username is case-insensitive

### Step 3: Restart Dev Server

After adding the variables, **restart your dev server**:

1. Stop the current server (Ctrl+C)
2. Run `npm run dev` again

**Environment variables are only loaded when the server starts!**

### Step 4: Test Login

1. Go to `http://localhost:3000`
2. Click "Login" button
3. Enter:
   - Username: `admin`
   - Password: `admin123` (or whatever you set)
4. You should be redirected to `/administration1`

## Verify Environment Variables Are Loaded

Visit this URL in your browser while dev server is running:
```
http://localhost:3000/api/admin/test-env
```

This will show you:
- ✅ If `ADMIN_USERNAME` is set
- ✅ If `ADMIN_PASSWORD` is set
- ✅ What values are being used

## Troubleshooting

### Still getting "Login failed"?

1. **Check `.env.local` exists and has the variables**
   ```bash
   cat hero-market/.env.local | grep ADMIN
   ```
   Should show:
   ```
   ADMIN_USERNAME=admin
   ADMIN_PASSWORD=admin123
   ```

2. **Restart the dev server** - Variables only load on startup
   ```bash
   # Stop server (Ctrl+C)
   npm run dev
   ```

3. **Check the terminal/console** for error messages
   - Look for warnings about environment variables
   - Check for API errors

4. **Verify the password matches exactly** (case-sensitive)
   - If you set `ADMIN_PASSWORD=MyPass123`, you must type `MyPass123` exactly

5. **Check browser console** (F12) for network errors
   - Look at the `/api/auth/login` request
   - Check the response for error details

### Default Credentials

If you don't set environment variables, the system uses:
- Username: `admin` (default)
- Password: `admin123` (default)

**But these defaults only work if you haven't set the env vars!**

## Example `.env.local` File

```bash
# Other environment variables...
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Admin Credentials
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_secure_password_here
```

## Security Note

- `.env.local` is in `.gitignore` - it won't be committed to git
- Use a strong password for production
- Never share your `.env.local` file





