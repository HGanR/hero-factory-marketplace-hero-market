# Deployment Checklist for Hero Market

## ✅ Pre-Deployment Steps

### 1. Update `.env.local` with Real Credentials
- [ ] Replace `YOUR_ACTUAL_PASSWORD` with your TiDB password
- [ ] Replace `your_admin_username` with your admin username
- [ ] Replace `your_admin_password` with your admin password  
- [ ] Replace JWT_SECRET with a long random string (32+ characters)

### 2. Push Database Schema
```bash
npm run db:push
```
- [ ] Database schema pushed successfully
- [ ] Tables created: `marketplace_users`, `admin_logs`

### 3. Test Locally
```bash
npm run dev
```
- [ ] Open http://localhost:3000
- [ ] Test user registration
- [ ] Test admin login at http://localhost:3000/admin
- [ ] Generate password for test user
- [ ] Test user login with generated password
- [ ] Test wallet connection on dashboard

## 🚀 Vercel Deployment Steps

### 4. Install Vercel CLI (if not already installed)
```bash
npm i -g vercel
```

### 5. Login to Vercel
```bash
vercel login
```

### 6. Deploy to Vercel
```bash
cd /Users/apple/Desktop/hero-factory-marketplace/hero-market
vercel --prod
```

### 7. Add Environment Variables in Vercel Dashboard
Go to: https://vercel.com/dashboard → Your Project → Settings → Environment Variables

Add these variables (same as `.env.local`):
- [ ] `DATABASE_URL` - Your TiDB connection string
- [ ] `ADMIN_USERNAME` - Your admin username
- [ ] `ADMIN_PASSWORD` - Your admin password
- [ ] `JWT_SECRET` - Your JWT secret key
- [ ] `NEXT_PUBLIC_APP_NAME` - Hero Market

### 8. Connect Custom Domain
- [ ] Go to Vercel Dashboard → Settings → Domains
- [ ] Add domain: `troothhurtz.app`
- [ ] Follow DNS configuration instructions
- [ ] Wait for DNS propagation (5-30 minutes)

### 9. Verify Deployment
- [ ] Visit https://troothhurtz.app
- [ ] Test user registration
- [ ] Test admin panel at https://troothhurtz.app/admin
- [ ] Verify all API endpoints work

## 🔧 Troubleshooting

### If you see 405 errors:
- The old deployment is still active
- Redeploy with `vercel --prod` to replace it

### If you see database connection errors:
- Check environment variables in Vercel Dashboard
- Ensure DATABASE_URL is correct
- Verify TiDB database is accessible

### If API routes don't work:
- Ensure you're using Next.js API routes (not tRPC)
- Check that routes are in `src/app/api/` directory
- Verify build completed successfully

## 📝 Notes

- The `.env.local` file is gitignored (not committed to GitHub)
- Environment variables must be added separately in Vercel Dashboard
- Next.js API routes work natively on Vercel (no separate backend needed)
- Database connection uses TiDB Cloud (already configured)

