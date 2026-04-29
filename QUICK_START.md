# Quick Start - Running the Dev Server

## Navigate to Project Directory

You need to be in the `hero-market` directory to run `npm run dev`.

### Option 1: Using Terminal Commands

```bash
# Navigate to the project directory
cd ~/Desktop/hero-factory-marketplace/hero-market

# Then run the dev server
npm run dev
```

### Option 2: Full Path (One Command)

```bash
cd /Users/apple/Desktop/hero-factory-marketplace/hero-market && npm run dev
```

## Verify You're in the Right Directory

Before running `npm run dev`, check that you're in the correct location:

```bash
# Check current directory
pwd

# Should show:
# /Users/apple/Desktop/hero-factory-marketplace/hero-market

# Check that package.json exists
ls package.json

# Should show:
# package.json
```

## Common Error

If you see:
```
npm ERR! enoent Could not read package.json: Error: ENOENT: no such file or directory
```

**This means you're in the wrong directory!**

**Fix**: Navigate to the project directory first:
```bash
cd ~/Desktop/hero-factory-marketplace/hero-market
```

## After Starting Dev Server

Once `npm run dev` is running, you should see:
```
▲ Next.js 15.5.6
- Local:        http://localhost:3000
```

Then you can:
1. Open `http://localhost:3000` in your browser
2. Try logging in with admin credentials
3. Check debug endpoints:
   - `http://localhost:3000/api/admin/debug-credentials`
   - `http://localhost:3000/api/admin/check-dependencies`





