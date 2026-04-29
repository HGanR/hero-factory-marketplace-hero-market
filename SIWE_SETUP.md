# SIWE Dependencies Installation

To complete the SIWE implementation, you need to install these additional dependencies:

```bash
npm install siwe @rainbow-me/rainbowkit
```

## What's Already Installed ✅
- `next-auth` - Authentication framework
- `wagmi` - Ethereum wallet hooks
- `viem` - Ethereum utilities
- `@tanstack/react-query` - Data fetching
- `@vercel/kv` - Key-value storage for sessions
- `@vercel/postgres` - Database (if needed)
- `zod` - Schema validation

## What's Added ✅
- **SIWE API Routes**: `/api/siwe/nonce`, `/api/siwe/verify`, `/api/siwe/session`, `/api/siwe/logout`
- **SIWE Hook**: `useSiwe()` for managing authentication state
- **SIWE Component**: `<SiweAuth />` for wallet connection UI
- **Integration**: SIWE now works alongside your existing token gate

## How It Works Now

1. **Two Access Methods**:
   - Hold 100,000 TROO POO (Solana) OR 100,000 TROO (Polygon) tokens
   - OR Sign in with Ethereum wallet (SIWE)

2. **SIWE Flow**:
   - User clicks "Sign In with Ethereum"
   - Wallet prompts to sign a message
   - Backend verifies the signature
   - Session is created and stored in Vercel KV
   - User gains access to the platform

3. **Account Creation**:
   - After passing the gate (either method), users can create accounts
   - Username + email sent to `troothhurtztrust@gmail.com`
   - Dashboard button appears after account creation

## Environment Variables Needed

Make sure you have these in your `.env.local`:

```env
# Vercel KV (for session storage)
KV_REST_API_URL=your_kv_url
KV_REST_API_TOKEN=your_kv_token

# Email notifications
DEVELOPER_EMAIL=troothhurtztrust@gmail.com
RESEND_API_KEY=your_resend_key
```

## Testing the Flow

1. Install dependencies: `npm install siwe @rainbow-me/rainbowkit`
2. Start dev server: `npm run dev`
3. Try both access methods:
   - Connect wallet and sign SIWE message
   - OR hold required tokens and check holdings
4. Create account with username/email
5. Verify dashboard button appears
6. Check that email was sent to `troothhurtztrust@gmail.com`

