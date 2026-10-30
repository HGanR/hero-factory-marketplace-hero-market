# Wallet / TROO purchase-flow map — hero-factory-marketplace-hero-market

Head read: `e26b3dd932fec6b627a5a675725047e381343957` (PR #1 branch).
Status: MAP ONLY. No code changed, no payment enabled, no real-value
payments authorized by this document. All statements describe the files
listed below as read at that head. Callers and flows not traced here are
marked unestablished; the repository code-search index returned no usable
results for this repo, so absence claims are limited to the files read.

## Files read for this map

- `src/lib/troo-token-config.ts` — token + treasury configuration.
- `src/lib/troo-payment.ts` — client-side ERC-20 transfer helper.
- `src/lib/world-wallet-auth.ts`, `src/lib/world-wallet-auth-client.ts` —
  wallet-signature edit authorization (EIP-191).
- `src/app/api/world-assets/route.ts` — published catalog listing.
- `src/app/api/world-assets/[assetId]/purchase/route.ts` — purchase endpoint.
- `src/app/api/world-assets/me/route.ts` — owned-assets listing.
- `src/app/api/marketplace/wallet/route.ts` — wallet-address link.
- `src/app/api/buildings/route.ts` — user building records (GET/POST).
- `src/app/api/troo-world/placements/route.ts` — placement reads (GET).
- `src/lib/db/schema.worlds.ts` — `worldLibraryAssets`, `userWorldAssets`
  table definitions (extracts read).
- `src/lib/troo-world/placements-storage.ts` — localStorage placement
  fallback (client only).

## The flow as it exists today

1. Catalog. `GET /api/world-assets` lists published, active,
   non-platform-only rows from `worldLibraryAssets`, exposing `tokenPrice`
   (integer, default 0), `modelUrl`, `previewImageUrl`, `manifestUrl`,
   `collisionType`, `instancable`, `boundsJson`. Category filter optional.
2. Wallet link (self-declared). `POST /api/marketplace/wallet` stores the
   request body's `walletAddress` and `hasTokenAccess` on the signed-in
   member's `marketplaceUsers` row. The route verifies the session cookie
   only; it performs no signature check, so the wallet link and the token
   claim are asserted by the client, not proven.
3. Client transfer (unverified callers). `transferTrooToTreasury(amount)`
   in `src/lib/troo-payment.ts` runs in the browser only: it requires
   `window.ethereum`, requests accounts, requires Polygon (chain 137),
   and sends an ERC-20 `transfer` of the amount to `TROO_TREASURY_WALLET`
   from `src/lib/troo-token-config.ts`. It returns the transaction hash,
   buyer wallet, and chain id after `tx.wait()`. No caller of this helper
   was established in this inspection, and no UI purchase flow was traced
   end to end. Whether any page calls it is unestablished here.
4. Purchase = ownership row, payment unchecked. `POST
   /api/world-assets/[assetId]/purchase` requires a signed-in user, loads
   the published/active asset, returns `alreadyOwned` when an ownership
   row exists, enforces `supplyLimit` by count, then inserts a
   `userWorldAssets` row (`licenseScope`: `all_worlds_owned` /
   `one_world` / `quantity_based`; `remainingPlacements` for
   quantity-based; `purchaseTx` from the request body's `txRef`, or a
   fabricated `asset_<uuid>` when absent). Its own header comment states:
   "For tokenPrice > 0, payment wiring is future work." No on-chain
   receipt, amount, recipient, chain, or replay check of any kind is
   performed before the row is created. An authenticated caller can
   obtain ownership of any priced asset without paying. This is the
   purchase free-ride hole: do not present this endpoint as a sale.
5. Ownership reads. `GET /api/world-assets/me` joins `userWorldAssets` to
   `worldLibraryAssets` for the signed-in user and returns owned assets
   with `licenseScope`, `remainingPlacements`, and `purchasedAt`.
6. Buildings (disconnected). `GET/POST /api/buildings` reads/writes
   `oasisBuildings` rows keyed by the signed-in user id. POST accepts a
   client-supplied `id`, `name`, `type`, and `data` with no payment check,
   no asset reference, and no ownership check. Nothing links a building
   record to a catalog asset, a purchase, or a transaction.
7. Placements (disconnected, write path untraced). `GET
   /api/troo-world/placements` is a public read returning placements for
   a world id (seeding default/green-terrain records, including the
   stadium and school placements, when absent). The placement-write path
   and any ownership enforcement on placing an asset were not
   established in this inspection; the client-side
   `placements-storage.ts` is a localStorage fallback only. Do not assume
   owning an asset gates placement, or vice versa.
8. Edit authorization (separate concern). `verifyWorldWalletSignature`
   proves, via EIP-191 recovery with a 5-minute timestamp window, that a
   signer controls a wallet address for editing a world id. It authorizes
   edits; it does not prove payment or ownership.
9. Mobile Preview exposure: none of the above. `apps/mobile-preview`
   exposes only the gated mobile shell/session/terms/icon/assets surface.
   Wallet, world, and purchase routes live on the canonical website host
   (`https://troothhurtz.app`, reached via redirects with a separate
   session). A member buying on the website and viewing on the Preview
   crosses two sessions; nothing in the target records or shows a
   purchase.
10. Other rails (not inspected, do not conflate): `src/app/api/payments/
    xumm` is a separate payments rail. The server-side TROO verification
    helper built for the older website repository (Phase 4) is reference
    material only; no equivalent server verification was found in the
    files read in this repository.

## Configuration facts

- Token: `0xa7927231898293377Ce676CFC9bbD551Cb845695`, 18 decimals,
  Polygon 137 (`src/lib/troo-token-config.ts`; address overridable via
  `NEXT_PUBLIC_TROO_TOKEN_ADDRESS`).
- Treasury: `NEXT_PUBLIC_TROO_TREASURY_WALLET` or `PLATFORM_WALLET`, else
  empty string. When empty, the client transfer helper throws
  ("TROO treasury wallet not configured"). No server-side configuration
  check endpoint was found in the files read. Treasury address control
  (who holds it) is unestablished here.
- Prices: `tokenPrice` is an integer on the catalog row. The priced
  examples discussed for this program (5 TROO neon buildings) are catalog
  data/seed state, not code constants; seed state for this repository was
  not established in this inspection.

## Gaps: what is missing for purchasing buildings + recording ownership

G1. Server-side payment verification BEFORE ownership is created:
    receipt lookup, chain id, token contract, recipient = treasury,
    amount >= `tokenPrice`, confirmation depth, and tx-hash uniqueness.
    Today none of this exists in the purchase path.
G2. Payment-to-ownership binding: the ownership insert must require a
    verified payment record; `purchaseTx` must be the verified on-chain
    hash, never client-supplied-or-fabricated. Today it is either.
G3. Idempotency + atomicity: no unique constraint on
    `(userId, assetId)` or on `purchaseTx` in `userWorldAssets`; the
    supply-limit count-then-insert is non-atomic. Duplicate/replayed
    purchases are stopped only by the application-level existing check.
G4. Wallet proof: bind `walletAddress`/`hasTokenAccess` to a verified
    signature (the EIP-191 pattern already exists for world edits) instead
    of trusting the request body; record which wallet paid for which
    ownership row.
G5. Building linkage: `oasisBuildings` needs an asset/purchase reference
    (asset id + ownership id + tx hash) and creation must require a
    verified ownership row; today buildings and purchases share no key.
G6. Placement gating: define and enforce, on the server placement-write
    path (untraced here), that placing a catalog asset requires an
    ownership row with remaining placements for the target world/scope,
    decrementing `remainingPlacements` for quantity-based licenses.
G7. Treasury/config readiness: confirm the treasury address, its holder,
    and a server-side config check before any real-value flow; confirm
    catalog seed state (which assets exist, at which prices) in the
    database the Preview will use.
G8. Mobile surface: decide whether purchases stay website-only (current
    fact) with a separate session, or gain a mobile purchase surface;
    either way, owned assets must be readable from the member's session
    on both hosts without pretending the sessions are shared.
G9. Money-movement rules: refunds, failed/reverted transactions,
    wrong-amount and wrong-recipient handling, and an audit trail are
    entirely absent. No real-value flow may be enabled until G1–G5 and
    these rules are designed, reviewed, and approved.
G10. Tests/evidence: no purchase-flow tests were inspected or run here.
    Any future verification work needs: priced-asset purchase with a
    real receipt on a test network/database, unpaid-purchase rejection,
    replay rejection, supply-limit contention, and ownership/placement
    reads after purchase — all recorded, none claimed from fixtures.

## Explicit non-goals of this map

No real-value payments are enabled, wired, or tested by this document.
No endpoint behavior was changed. The purchase endpoint must not be
described to members as a sale while G1/G2 stand.
