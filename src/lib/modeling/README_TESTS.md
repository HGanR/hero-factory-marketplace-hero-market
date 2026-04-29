# Modeling Tests

## Scripts

- `npm test` — node tests only (fast, default for local dev)
- `npm run test:browser` — jsdom/browser tests (export tests skipped unless `RUN_EXPORT_TESTS=1`)
- `npm run test:ci` / `npm run test:all` — runs both; use for CI or pre-merge

## Test suites

- **Node** (`npm test`): Parser, generators, schema, disposal, boolean validation, canonical plan
- **Browser** (`npm run test:browser`): Export tests (require Blob, FileReader)

## Export tests

GLB export tests use `GLTFExporter`, which relies on `FileReader` for binary output. JSDOM's `FileReader` can hang, so these tests are **skipped by default**.

- **CI**: Runs `npm run test:all` (node + browser). Export tests are skipped; CI stays green.
- **Opt-in**: `RUN_EXPORT_TESTS=1 npm run test:browser` to run export tests (use in a real-browser test runner or known-good jsdom env).
- **Periodic validation**: Run export tests before releases or when touching `exportGlb.ts` to catch regressions.
