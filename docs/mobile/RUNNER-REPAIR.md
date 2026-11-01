# Dependency and runner repair — 2026-10-27

Draft PR #1 only. No deployment, activation, route removal, or mobile implementation changes.

Restores date-fns and socket.io as runtime dependencies; Jest, ts-jest, jsdom, Playwright, pixelmatch and PNG tooling as dev dependencies. Existing declared ranges and the original 96-file Node test command are preserved. PNG typing uses Next's own static image declaration; the source image is unchanged.

`tests/runner-selection.json` explicitly assigns 534 Jest Node suites and seven jsdom suites. It excludes the original 96 Node suites, 21 additional Node suites outside the original command, and 26 empty specs. The 21 are recorded, not silently added to the existing command. The 26 are missing coverage, never passing tests. The selector rejects overlap and unassigned new specs. The existing bare-global suites now have a real Jest runtime. ts-jest performs isolated transpilation; a separate full TypeScript check remains required.

The configs use the same server-only marker mapping as Next's own Jest preset. One existing Node regression assertion now checks the actual strict tsconfig.json command introduced earlier in this PR, instead of requiring a nonexistent tsconfig.typecheck.json.

## Verified execution on the saved code

Tested code: `d486459e23b462ac4c15667aa9742701f7c6b598`, Node 24.22.1. This report commit changes documentation only.

| Check | Actual result |
| --- | --- |
| Clean `npm ci --ignore-scripts --no-audit --no-fund` | PASS; 2,370 packages installed from the committed lock |
| `npm run test:selection` | 2/2 PASS |
| Jest `--listTests --json --runInBand`, both configs | Exact manifest equality: 534 Node-environment, 7 jsdom suites |
| `npm run test:jest -- --json` | 506 suites passed, 26 failed, 2 skipped; 2,650 tests passed, 57 failed, 3 skipped |
| `npm run test:jest:browser -- --json` | 7 suites passed; 25 tests passed, 3 skipped |
| Original 96-file Node list, `node --import tsx --test --test-concurrency=2` | 540 tests passed, 2 failed, 3 cancelled; exit 1. Same list as npm test, concurrency bounded for this run |
| `npm run test:mobile` | 18/18 PASS |
| Cookie suite, `node --import tsx --test src/lib/auth.session-cookies.test.ts` | 3/3 PASS (also included in the Node list; not additional coverage) |
| `npm run test:playwright -- --list` | 20 tests discovered; browser execution NOT RUN |
| `node --max-old-space-size=4096 node_modules/typescript/bin/tsc --noEmit -p tsconfig.mobile-review.json` | PASS |
| `npm run typecheck:tsc -- --incremental false` | FAIL: 1216 diagnostics in 518 files; exit 2 |
| PNG comparison helper (actual PNG encode/decode + pixelmatch), date-fns, Socket.IO construction/closure | PASS; no listening server opened |

The clean TypeScript count was 4,902 before this repair. It is now 1216, of which 729 are in test/spec files and 487 elsewhere. Counts are diagnostics, not distinct defects. The original six TS2307 missing-module specifiers are resolved. Full source checking still fails; isolated ts-jest transpilation is not a substitute for that check.

### Remaining failures and limits

- Node: two missing voice documentation files fail assertions; absent local voice mock-server tooling causes suite setup failures and cancels three child tests. The outdated TypeScript-script assertion is now corrected and passes.
- Jest: failures include empty-route exports, application/fixture contract mismatches, UI assertions and a DB-dependent test without DATABASE_URL. These require individual recovery or fixture review; no production DB or credentials were used, and no failures were hidden.
- The 26 empty suites remain missing coverage, separate from the runners' intentional skips. The 21 additional Node suites remain explicitly inventoried outside the original command and were not executed in this pass.
- No handlers fabricated, routes removed, assertion expectations changed to match broken application behavior, or source imports replaced with invented implementations. The Next server-only mapping only reproduces Next's own test-marker behavior.
- Test dependency installation deliberately skipped lifecycle scripts. No successful full build, browser parity, live sign-in, phone installation, or Windows installer validation is claimed.
- No full build retry while source checks fail. The 54-empty-file recovery inventory, earlier build-memory failure, framework review, auth/security work and live deployment checks remain open.

All original declared dependency ranges and the Node test command are unchanged. The lock includes new test-tool dependencies and transitive resolver updates, not a Next upgrade. PNG tooling is now explicitly declared (pngjs + its types), rather than relying on a transitive package. The image SHA-256 remains `15d4f4592ade446542a757e372b0f1e6fbd0c591082825f1b2519db3689bdd73`.

`RUNNER-REPAIR-RESULTS.json` contains the exact selections, command exit statuses, failed-suite/test details and full TypeScript diagnostic inventory. Mobile application files are untouched. Windows PR #7 remains separate. PR #1 remains draft; nothing merged, deployed, activated or installed on the Mac.
