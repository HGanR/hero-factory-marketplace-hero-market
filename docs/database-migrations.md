# Database migrations (TiDB / MySQL)

Numbered SQL files live in `drizzle/` (pattern `NNNN_description.sql`). The app tracks what ran in the table `drizzle_sql_migrations`.

## Commands

| Command | When to use |
|--------|-------------|
| `npm run db:migrate:all` | Apply **pending** numbered migrations in order. Use for **controlled DDL** (staging/production, or after adding a new `NNNN_*.sql` file). Requires `DATABASE_URL`. |
| `npm run db:status` | **Inspect** state: APPLIED / PENDING / MISMATCH per file. Safe anytime; does not change the database except creating `drizzle_sql_migrations` if missing. |
| `npm run db:migrate:check` | Same as `db:status` with **`--strict`**: exits **1** if anything is PENDING or MISMATCH. For **CI** and pre-deploy gates. |
| `npm run db:push` | **Dev-only** convenience: syncs `schema.ts` (and related Drizzle schema files) to the DB via `drizzle-kit push`. **Not** a substitute for numbered SQL migrations in production. |
| `npm run db:migrate -- drizzle/some_file.sql` | Run **one** SQL file via `scripts/run-migration.mjs` (e.g. unnumbered scripts like `ret_sessions.sql`). |

### Bootstrap after manual SQL (TiDB console)

If DDL was applied by hand, align the tracker without re-running:

```bash
npm run db:migrate:all -- --mark-file drizzle/NNNN_name.sql
```

Use `--mark-all` only if **every** numbered file in `drizzle/` already matches the database.

## CI

Configure GitHub Actions with a repository secret **`DATABASE_URL`** pointing at a database that should reflect the expected migration state (often **staging**).

The workflow at the **repo root** (`.github/workflows/db-migrations.yml`) runs `npm run db:migrate:check` inside `hero-market/`. If `DATABASE_URL` is **not** set, the job **skips** the check (passes) and prints a notice — set the secret to **enforce** the check on every run.

```bash
npm run db:migrate:check
```

## Production caveats

1. **Partial failure**: A file with multiple statements may apply some statements then fail; the tracker row is **not** written. Fix the DB or SQL, then re-run or use `--mark-file` only when the DB already matches the file.
2. **Duplicate/conflicting** older migrations (e.g. two `0009_*.sql`) need a human decision before `db:migrate:all` on a fresh database.
3. **`db:push`** can propose destructive or wide diffs; avoid it against production.

## Pre-deploy (recommended)

1. Review new `drizzle/NNNN_*.sql` in the release.
2. On the target environment (or staging first): `npm run db:migrate:all`.
3. Verify: `npm run db:status` (expect APPLIED for shipped migrations).
4. In CI before merge: `npm run db:migrate:check` (with `DATABASE_URL` secret).
