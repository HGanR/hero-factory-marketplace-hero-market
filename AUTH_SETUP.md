# Authentication Setup Guide

This application supports two types of authentication:
1. **Regular User Login** - Users can create accounts and login to bypass wallet/token requirements
2. **Admin Login** - Master admin account with full access

## Environment Variables

You need to add the following environment variables to your `.env.local` file (or `.env` file):

### Required Variables

```bash
# Admin Credentials (Master Login)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_secure_password_here

# Optional: If you want different defaults
# ADMIN_USERNAME=your_admin_username
# ADMIN_PASSWORD=your_admin_password
```

### Where to Add These

1. **Local Development**: Add to `hero-market/.env.local` (create if it doesn't exist)
2. **Production (Vercel)**: See `VERCEL_ENV_SETUP.md` for detailed instructions
   - Go to Vercel Dashboard → Your Project → Settings → Environment Variables
   - Add `ADMIN_USERNAME` and `ADMIN_PASSWORD`
   - **IMPORTANT**: Redeploy after adding environment variables!

### Important Notes

- **Never commit `.env.local` to git** - it should be in `.gitignore`
- Use a **strong password** for `ADMIN_PASSWORD` in production
- The admin username is case-insensitive (will be converted to lowercase)
- Admin sessions last 30 days
- Regular user sessions also last 30 days

## How It Works

### Regular User Login
- Users can create accounts via the "Create Account" button
- After account creation, they can login with username/password
- Login bypasses all wallet connection and token holding requirements
- Users can navigate the entire site without wallet or token gates

### Admin Login
- Admin can login using the same login form
- Admin credentials are checked first before regular user lookup
- Admin has full access to all features
- Admin status is stored in the session

## Login Flow

1. User visits the site
2. After splash screen, they see:
   - **Login button** - to login with existing credentials
   - **Create Account button** - to create a new account
3. After successful login:
   - All wallet/token gates are bypassed
   - User can access dashboard and all pages
   - Session persists for 30 days

## API Endpoints

- `POST /api/auth/login` - Login (handles both regular and admin)
- `GET /api/auth/check-session` - Check regular user session
- `POST /api/auth/logout` - Logout regular user
- `GET /api/admin/check-session` - Check admin session
- `POST /api/admin/logout` - Logout admin

## Testing

To test the admin login:
1. Set `ADMIN_USERNAME` and `ADMIN_PASSWORD` in `.env.local`
2. Restart your dev server
3. Click "Login" on the homepage
4. Enter your admin credentials
5. You should have full access without wallet/token requirements

