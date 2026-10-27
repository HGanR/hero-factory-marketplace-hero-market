# Dependency and runner repair — 2026-10-27

Draft PR #1 only. No deployment, activation, route removal, or mobile implementation changes.

Restores date-fns and socket.io as runtime dependencies; Jest, ts-jest, jsdom, Playwright, pixelmatch and PNG tooling as dev dependencies. Existing declared ranges and the original 96-file Node test command are preserved. PNG typing uses Next's own static image declaration; the source image is unchanged.

`tests/runner-selection.json` explicitly assigns 534 Jest Node suites and seven jsdom suites. It excludes the original 96 Node suites, 21 additional Node suites outside the original command, and 26 empty specs. The 21 are recorded, not silently added to the existing command. The 26 are missing coverage, never passing tests. The selector rejects overlap and unassigned new specs. The existing bare-global suites now have a real Jest runtime. ts-jest performs isolated transpilation; a separate full TypeScript check remains required.

The configs use the same server-only marker mapping as Next's own Jest preset. One existing Node regression assertion now checks the actual strict tsconfig.json command introduced earlier in this PR, instead of requiring a nonexistent tsconfig.typecheck.json.

## Validation checkpoint

Final validation for this restored checkout is pending. A previous temporary checkout ran both runners, but was lost before publishing. Do not treat those earlier results as verification of this commit's final dependency graph. The next update will record actual commands and results for this checkout. No successful full build is claimed.

The existing empty-route and application-code recovery inventory remains open. No handler was fabricated and no failing suite was excluded to improve results. Windows PR #7 remains separate.
