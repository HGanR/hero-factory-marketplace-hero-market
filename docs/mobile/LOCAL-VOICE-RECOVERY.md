# Local voice recovery — 2026-10-27

Restores eight previously untracked files from the operator's uploaded `hero-local-recovery.tgz`, byte-for-byte, on PR #1 after `5de2c1f51637ebf9f9101a145bb7cfac9b5a4786`. No existing application symbols are modified. No mobile implementation, routes, dependency declarations, catalog authorization, or deployment changes.

The archive contains ten regular files: eight voice docs/mock-service files, AGENTS.md, and tsconfig.typecheck.json. No environment files or private keys were present; documentation contains example placeholder credentials. AGENTS.md supplies the local workflow rules and is not imported into the remote repository. The alternate tsconfig excludes test files, so it is not adopted as a replacement for the full check.

## Actual validation

Node v24.22.1; tsx 4.23.15 from the existing test-tools environment. Both `node --check tools/self-hosted-{stt,tts}-dev-server/server.mjs` checks pass. The existing four targeted suites execute real local HTTP mock servers and pass 13/13, with zero failures, cancellations or skips:

```
node --import /workspace/scratch/3568b076ef28/test-tools/node_modules/tsx/dist/loader.mjs --test \
  src/lib/voices/self-hosted-stt-dev-mock.integration.spec.ts \
  src/lib/voices/self-hosted-tts-dev-mock.integration.spec.ts \
  src/lib/voices/self-hosted-stt-health.spec.ts \
  src/lib/voices/self-hosted-tts-health.spec.ts
```

In a normal installed checkout use `node --import tsx --test` with the same four files. Tests verify STT's fixed transcript, health behavior, TTS voice-id response and actual WAV response, plus documentation and existing fallback-source assertions. These are deliberately development mocks: no real recognition, cloning or generated speech is claimed. No external AI service or credentials used.

This closes the targeted missing-doc and mock-server setup failures from the prior Node run. The entire 96-file command, Jest, full TypeScript, build and deployment were not rerun in this restoration-only pass. Their prior failures remain documented; do not claim a passing build or new overall test total from these targeted passes.

## Provenance

Archive SHA-256: `dd1d01b30791c1dbd1a73c7450f4ff33b989081e3d881f69e807479120b0e25c`

| Restored path | SHA-256 |
| --- | --- |
| `docs/voice/self-hosted-stt-engine.md` | `ec7deb8e7c4d845b2793ae0fdff194d2c116c2ed69699146fd6f2357474c365d` |
| `docs/voice/self-hosted-tts-engine.md` | `1909220b9e07ff1e56de1b34fd3f97a674e931b334d54714742561b4d580e76a` |
| `tools/self-hosted-stt-dev-server/README.md` | `2c86d6a127c60af19ff8362300f6e2133a4ad9e9b1edf28d4f072e8eeba771d7` |
| `tools/self-hosted-stt-dev-server/package.json` | `ff7497f43ed7cbf74d9b34a93588a3f6b0e2371b74bbdb70a5d8b11965b27753` |
| `tools/self-hosted-stt-dev-server/server.mjs` | `549f879a22f29e88046c12b585d3480f8508faf698809e3b933b44ce49745e13` |
| `tools/self-hosted-tts-dev-server/README.md` | `e63af7bfa15090de7bec0c1a9c8140db12bb9f2a42ab703359b6a7732706da3e` |
| `tools/self-hosted-tts-dev-server/package.json` | `e111dd4bf84a853687df8135cfe0c706a49346d739584907c40fd73201378236` |
| `tools/self-hosted-tts-dev-server/server.mjs` | `5c4c4a20d39e0c5450e9d2300522fb08bfb3f4aebf6a535fa2246446c6c29664` |

`git diff --cached --check` reports two pre-existing Markdown hard-line-break spaces, one in each restored README; preserved deliberately for exact-byte recovery. No source-file whitespace warnings.

## Scope verification

GitNexus 1.6.12 index-only analysis completed on the actual checkout (83,782 nodes, 283,120 edges). Then `gitnexus detect-changes --scope staged --repo hero-voice-recovery` completed: **9 files, 39 symbols, reported risk low, 0 affected indexed processes**. Direct Git inspection confirms the staged paths are only the eight restored files plus this report. No existing function/class/method is edited; restored source bytes are identical to the upload.

Limits: FTS was disabled; process extraction explicitly reported truncation (7,922 entry-point candidates dropped, 37,794 callees skipped, 28 walks budget-cut), and callable/scope resolution emitted incomplete-link warnings. Therefore zero affected indexed processes is NOT proof of zero real callers or complete coverage. The original operator index was not available; this was a fresh local index, stored outside the checkout. No GitNexus-generated application/configuration files are included.
