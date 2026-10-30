# Mobile Preview re-validation record — 2026-10-29 (Aura)

Exact revision under validation: `e26b3dd932fec6b627a5a675725047e381343957`
(PR #1 branch `feat/smart-trust-mobile-preview-20261026`, draft PR #1).
This revision is the commit that first contains the `apps/mobile-preview`
target. The docs-only commit on top of it (draft PR #2, `7f750b88`) changes
no target code.

## Script

`scripts/revalidate-mobile-preview.sh` — executable commands, not comments
alone. It verifies, in order, stopping on the first failure:

1. The supplied directory is a git work tree whose `origin` is
   `HGanR/hero-factory-marketplace-hero-market` (https or ssh form).
2. Node.js major version is 24.
3. `git fetch origin`, then an isolated detached worktree at the exact SHA
   above; asserts `HEAD` equals the SHA and the worktree is clean. The
   caller's checkout is never checked out, reset, stashed, or force-updated.
   The worktree is removed on exit, pass or fail.
4. In the worktree: `npm ci`, `npm run build`, `npm test` under
   `apps/mobile-preview`, then the root mobile/cookie suites with
   `NODE_PATH` pointed at the target's `node_modules`.
5. A runtime dependency audit, recorded but not gating.

Run it from the repository root (or anywhere) as:

```sh
bash scripts/revalidate-mobile-preview.sh <checkout-dir> 2>&1 | tee revalidation.log
```

`<checkout-dir>` is the caller's own checkout; the previously discovered
candidate `/Users/user/Desktop/hero-factory-marketplace/hero-market` is
UNVERIFIED from here — the script's remote check is what establishes
whether a given directory is the right checkout. Do not substitute a
placeholder path. No secrets are read, printed, or stored. The script
performs no deployment, migration, or production action.

## Results

| Step | Command | Result |
| --- | --- | --- |
| Checkout / remote / Node / SHA | script steps 1–3 | NOT RUN |
| Target `npm ci` | script step 4 | NOT RUN |
| Target `npm run build` | script step 4 | NOT RUN |
| Target `npm test` (6 tests) | script step 4 | NOT RUN |
| Root mobile/cookie suites | script step 4 | NOT RUN |
| Runtime audit | script step 5 | NOT RUN |

No results are recorded yet: this environment has no checkout and cannot
execute the script (private-repo clone needs the caller's credentials).
When the script is run, paste its `=== REVALIDATION RESULT ===` block and
any failure output here (or report it in chat) and this table will be
updated from the actual output. Do not mark any step passed from the
earlier validation pass: that pass ran against the working tree on top of
base `c2a5b069`, before the target was committed, and is reported — not
re-executed — in `docs/mobile/MOBILE-PREVIEW-VALIDATION.md`.

## Out of scope for this record

Vercel remote build, protected URL, environment configuration, database
target, real member login, and phone/device checks remain separate live
checks (see `docs/mobile/DELIVERY-PHASES.md`). The whole-website build
remains blocked and is not re-validated by this script. The purchase
safeguard is a separate draft change; it does not alter the target.
