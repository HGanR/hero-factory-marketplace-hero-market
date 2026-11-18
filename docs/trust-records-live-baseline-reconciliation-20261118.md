# Trust Records — live baseline reconciliation

## Source-of-truth
Current production deployment of hero-market (2026-11-18): `6e79c62dd7bafcda08b61d5d8e42ed34b973a0b7` on `feat/green-terrain-on-production-baseline-20261117`.

The earlier draft PR #61 is based on `main` (`f043274ed11dbfdf824387e21e9903b4a8a548b5`) and must **not** be merged or promoted: its preview contains an older homepage. The Trust Records page in production is 6257 lines, versus 3688 lines in the earlier draft, so wholesale replacement would erase newer features.

## Non-destructive integration
1. Keep production code and all exterior pages unchanged.
2. Inspect the production Trust Records tabs, layout, state, and settings before applying any UI changes.
3. Port only additive guided navigation and collapsible settings; do not copy the older Trust Records page wholesale.
4. Compare this branch against the production SHA; allowed source changes are restricted to `src/app/trust-records/**` (plus tests/docs) unless separately approved.
5. Validate protected preview homepage against `troothhurtz.app` and authenticated `/trust-records` against the current production route.
6. Keep old PR #61 draft; do not merge or deploy production without explicit approval.
