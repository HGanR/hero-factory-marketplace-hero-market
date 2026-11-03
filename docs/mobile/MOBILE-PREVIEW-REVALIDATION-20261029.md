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

`<checkout-dir>` is the caller's own checkout, verified by the script's
remote check. The checkout used for the executed run below,
`/Users/user/Desktop/hero-factory-marketplace/hero-market`, was confirmed
by inspection (origin, `recovery-from-prod` @ `e8e432f`, Node v24.15.0).
Do not substitute a placeholder path. No secrets are read, printed, or
stored. The script performs no deployment, migration, or production action.

## Results — executed 2026-10-29 on Charles's Mac

Run from worktree `hero-market-revalidate` @ `04cf52de`, script invoked
with checkout `/Users/user/Desktop/hero-factory-marketplace/hero-market`.
Node v24.15.0, npm 11.12.1. Full output in `revalidation.log` in the
worktree directory. Outcome: **PASS**.

| Step | Command | Result |
| --- | --- | --- |
| Checkout / remote / Node / SHA | script steps 1–3 | PASS — origin verified, Node v24.15.0, isolated worktree HEAD `e26b3dd…`, clean |
| Target `npm ci` | script step 4 | PASS — 59 packages added, 60 audited, 0 vulnerabilities |
| Target `npm run build` | script step 4 | PASS — Next.js 16.4.3 (webpack); compiled successfully; TypeScript finished; 6 routes (/, /_not-found, /api/mobile/session, /mobile, /mobile/icon.png, /mobile/terms) |
| Target `npm test` (6 tests) | script step 4 | PASS — 6 pass, 0 fail |
| Root mobile/cookie suites | script step 4 | PASS — 17 pass, 0 fail (`node --test tests/mobile/*.test.cjs`) |
| Runtime audit | script step 5 | PASS (recorded) — 0 vulnerabilities at every severity |

`prepare:source` reported 28 verified sources/assets copied unchanged.
Count note: this run observed 17 tests under `tests/mobile/*.test.cjs`.
The earlier validation pass recorded its mobile/cookie figures as 18
mobile checks + 3 cookie checks; the counting basis differs and was not
reconciled here. What this run establishes is its own observed count:
17 tests, all passing, against the exact committed revision.

## Out of scope for this record

Vercel remote build, protected URL, environment configuration, database
target, real member login, and phone/device checks remain separate live
checks (see `docs/mobile/DELIVERY-PHASES.md`). The whole-website build
remains blocked and is not re-validated by this script. The purchase
safeguard is a separate draft change; its tests were not run by this
script and remain NOT RUN.
