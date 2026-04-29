# Hero Market - Next.js Application

A Next.js marketplace application with token-gated access, built for seamless Vercel deployment.

## 🚀 Quick Start

### Prerequisites

- Node.js 18.x or 20.x
- npm 9.x+
- TiDB Cloud database account
- MetaMask browser extension (for wallet features)

### Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   
   Create a `.env.local` file in the root directory with the following:
   ```env
   # Database - Your TiDB Connection String
   DATABASE_URL=mysql://2PrXrw5SH4HNXii.root:YOUR_PASSWORD@gateway01.us-east-1.prod.aws.tidbcloud.com:4000/test?ssl={"rejectUnauthorized":true}

   # Admin Credentials
   ADMIN_USERNAME=your_admin_username
   ADMIN_PASSWORD=your_admin_password

   # JWT Secret (generate a random string)
   JWT_SECRET=your-super-secret-jwt-key-make-it-long-and-random

   # App Settings
   NEXT_PUBLIC_APP_NAME=Hero Market
   ```

3. **Push database schema:**
   ```bash
   npm run db:push
   ```

4. **Run development server:**
   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📁 Project Structure

```
hero-market/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── admin/          # Admin API routes
│   │   │   └── marketplace/    # Marketplace API routes
│   │   ├── admin/              # Admin page
│   │   ├── dashboard/          # User dashboard
│   │   ├── layout.tsx          # Root layout
│   │   ├── page.tsx            # Home page
│   │   └── globals.css         # Global styles
│   ├── lib/
│   │   ├── db/
│   │   │   ├── schema.ts       # Database schema
│   │   │   └── index.ts        # Database connection
│   │   ├── auth.ts             # Authentication utilities
│   │   └── utils.ts            # General utilities
│   └── types/
│       └── ethereum.d.ts        # Ethereum type definitions
├── drizzle.config.ts           # Drizzle ORM configuration
└── package.json
```

## 🔑 Features

- **User Registration & Login**: Secure authentication with JWT tokens
- **Admin Panel**: Manage users, generate passwords, toggle access
- **Wallet Integration**: Connect MetaMask wallet for token-gated access
- **Token-Gated Content**: Verify token ownership before granting access

## 🛠️ API Routes

### Marketplace Routes

- `POST /api/marketplace/register` - Register a new user
- `POST /api/marketplace/login` - User login
- `POST /api/marketplace/wallet` - Update wallet address

### Admin Routes

- `POST /api/admin/login` - Admin login
- `GET /api/admin/users` - Get all users
- `POST /api/admin/generate-password` - Generate password for user
- `POST /api/admin/toggle-access` - Revoke/restore user access

## 🗄️ Database Schema

### `marketplace_users`
- User accounts with email, username, password hash
- Approval and activation status
- Wallet address and token access flags

### `admin_logs`
- Logs of all admin actions
- Tracks password generation, access changes, etc.

## 🚢 Deployment to Vercel

1. **Push to GitHub:**
   ```bash
   git init
   git add .
   git commit -m "Initial Next.js Hero Market"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/hero-market.git
   git push -u origin main
   ```

2. **Deploy via Vercel CLI:**
   ```bash
   npm i -g vercel
   vercel login
   vercel --prod
   ```

3. **Add Environment Variables in Vercel Dashboard:**
   - Go to your project → Settings → Environment Variables
   - Add all variables from `.env.local`

4. **Connect Custom Domain:**
   - Go to Settings → Domains
   - Add `troothhurtz.app`
   - Follow DNS configuration instructions

## 📝 Notes

- The `.env.local` file is gitignored for security
- Make sure to set strong values for `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and `JWT_SECRET`
- The database schema will be automatically created when you run `npm run db:push`
- Token verification in the dashboard is simplified - implement actual ERC-20 token balance checking for production

## 🔒 Security

- Passwords are hashed using bcrypt
- JWT tokens are used for authentication
- Admin routes are protected with token verification
- Environment variables are never committed to git

## 📄 License

Private project - All rights reserved

---

*Built with Next.js, TypeScript, Tailwind CSS, and Drizzle ORM*
