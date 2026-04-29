# Vercel Deployment Guide

## ✅ Pre-Deployment Checklist

- [x] Build successful
- [x] All API routes configured
- [x] Database connection working
- [ ] Environment variables ready

## 🚀 Deployment Steps

### Step 1: Deploy to Vercel

```bash
cd /Users/apple/Desktop/hero-factory-marketplace/hero-market
vercel --prod
```

**Note:** Use `vercel --prod` (not `vercel deploy --prod`)

### Step 2: Add Environment Variables in Vercel Dashboard

After deployment, go to:
**Vercel Dashboard → Your Project → Settings → Environment Variables**

Add these variables (same as your `.env.local`):

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | `mysql://2PrXrw5SH4HNXii.root:oRmXP5c8CYkpIlIU@gateway01.us-east-1.prod.aws.tidbcloud.com:4000/test?ssl={"rejectUnauthorized":true}` |
| `ADMIN_USERNAME` | `admin` |
| `ADMIN_PASSWORD` | `HeroAdmin2024!` |
| `JWT_SECRET` | `hQ2PNx+vOI123VUKW01NeLsvaXVrUG5MJyRXH98UxoI` |
| `NEXT_PUBLIC_APP_NAME` | `Hero Market` |

**Important:** 
- Make sure to add these for **Production** environment
- After adding, Vercel will automatically redeploy

### Step 3: Connect Custom Domain

1. Go to **Vercel Dashboard → Your Project → Settings → Domains**
2. Add domain: `troothhurtz.app`
3. Follow DNS configuration instructions:
   - Add CNAME record: `@` → `cname.vercel-dns.com`
   - Or A record: `@` → `76.76.21.21`
4. Wait for DNS propagation (5-30 minutes)

### Step 4: Verify Deployment

- Visit your Vercel URL (e.g., `https://hero-market.vercel.app`)
- Test user registration
- Test admin login at `/admin`
- Test user login
- Verify all API endpoints work

## 🔧 Troubleshooting

### If deployment fails:
- Check build logs in Vercel Dashboard
- Verify all environment variables are set
- Check that database is accessible from Vercel's IPs

### If API routes return 405:
- Ensure you're using Next.js API routes (not tRPC)
- Check that routes are in `src/app/api/` directory
- Verify build completed successfully

### If database connection fails:
- Verify `DATABASE_URL` is correct in Vercel
- Check TiDB Cloud allows connections from Vercel IPs
- Test connection string format

## 📝 Notes

- The `.env.local` file is NOT deployed (it's gitignored)
- Environment variables must be added separately in Vercel Dashboard
- Next.js API routes work natively on Vercel (no separate backend needed)
- Database uses TiDB Cloud (already configured)

