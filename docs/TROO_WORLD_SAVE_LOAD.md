# Troo World Save/Load Architecture

## Summary

The hero-market Troo World Editor is **designed to use the shared MySQL database** as the source of truth. All users see the same layout when the database is configured and working.

| Storage | When used | Who sees it |
|---------|-----------|-------------|
| **Database** (`troo_world_placements` table) | Primary — when API succeeds | All users |
| **localStorage** | Fallback — when API fails (401 or 500) | Only that browser |

## API Flow

### Save (modeling page, "Save Placements" button)
- **Endpoint**: `PUT /api/admin/troo-world/placements`
- **Auth**: Requires `admin-token` cookie (log in at `/admin`)
- **Writes to**: `troo_world_placements` table
- **On failure**: Saves to localStorage as backup; user sees error

### Load (modeling page)
1. `GET /api/troo-world/placements` (public, no auth) — from DB
2. If 401 on admin: `GET /api/admin/troo-world/placements` — from DB
3. If both fail: localStorage → hardcoded defaults

### Load (troo-world page)
- `GET /api/troo-world/placements` (public, no auth) — from DB
- On failure: localStorage → defaults

## Why "Failed to save placements" Happens

| Cause | Fix |
|-------|-----|
| **401 Unauthorized** | Log in at `/admin` to get `admin-token` cookie |
| **500 Database error** | Add `DATABASE_URL` in Vercel → Settings → Environment Variables |
| **Tables missing** | Run migrations: `drizzle/0003_add_troo_world_tables.sql` |
| **Wrong database** | Production must use database named `hero-market` (see `src/lib/db/index.ts`) |

## Debug Endpoint

`GET /api/troo-world/debug` returns:
- `dbConnected`: boolean
- `placementCount`: number (when DB works)
- `dbError`: string (when DB fails)
- `hasDatabaseUrl`: boolean

Use this to verify database configuration.

## Making Database the Source of Truth

1. **Vercel**: Add `DATABASE_URL` (MySQL connection string) in Project → Settings → Environment Variables
2. **Migrations**: Ensure `troo_worlds` and `troo_world_placements` tables exist (run `drizzle-kit push` or apply `drizzle/0003_add_troo_world_tables.sql`)
3. **Admin login**: Go to `/admin`, log in. This sets the `admin-token` cookie.
4. **Save**: Click "Save Placements" — writes to DB. All users loading `/troo-world` or `/modeling` will see the same layout.

## localStorage Fallback

When the database is unavailable, the editor falls back to localStorage so the user never loses their layout. It is stored per-browser only. Once the database is configured and the user saves successfully, the layout is shared across all users.
