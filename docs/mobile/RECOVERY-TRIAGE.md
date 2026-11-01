# Clean recovery triage

Base: 7e4bc725f9cd3a22b798ac57ada78b0fe8b4f9fd. Fresh checkout with no .next output. No routes deleted, placeholders added, test exclusions, merge or deployment.

Recovered scripts/typecheck-empty-modules-report.mjs byte-for-byte from HGanR/oct12026heromarket main: Git blob 021bebc99dde30a043a6492c2d850e84732ad137. Its existing node:test regression passes 1/1. Scanner ran across 4,306 source files: 54 empty/export-less suspects, including 23 whitespace-only route.ts files. All 54 have no populated counterpart in the other repository's main tree inspected this session. Historical recovery remains open.

npm ci --ignore-scripts --no-audit --no-fund succeeded on Node 24.22.1. No dependency/lock changes. Mobile tests pass 18/18. Clean npm run typecheck:tsc completes with exit 2: 4,902 diagnostics across 883 files, 4,408 in test/spec files and 494 elsewhere. These counts are not independent defects. TS2306 falls from 81 to 9 without generated route types; build generation can expose empty route errors again.

The 367 TS2307 diagnostics group to six specifiers: date-fns, @playwright/test, @jest/globals, socket.io, pixelmatch, ./tax-agent-chas.png. The adjacent inventory lists all importers and remaining non-test diagnostics. Missing PNG type declarations do not necessarily mean lost image bytes.

Running node --import tsx --test src/lib/bentley-social-leads/bentley-sli-v4.spec.ts fails with ReferenceError: describe is not defined. Installing ambient Jest types or excluding tests does not make the suite runnable. A real runner or equivalent test conversion is required.

Next: inspect dependencies/assets for the six specifiers; establish an executable test-runner strategy; recover handlers from verified historical sources or establish intentional retirement before removing them. Then regenerate route types and run full build/CI in representative isolated configuration. No repeat build was attempted while source checks still fail. The previous build memory failure remains unresolved. PR stays draft and preview/production remain blocked. Windows PR #7 is untouched.
