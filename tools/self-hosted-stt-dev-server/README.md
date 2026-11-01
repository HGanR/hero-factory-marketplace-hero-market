# self-hosted-stt-dev-server

**Development only.** Accepts multipart audio on `POST /stt/transcribe` and returns a **fixed mock transcript** (does not run speech recognition).

- No OpenAI, ElevenLabs, or cloud STT.
- No production accuracy.

## Run

From **hero-market** repo root:

```bash
npm run dev:self-hosted-stt
```

Default: `http://127.0.0.1:8788`  
Override: `PORT=9998 npm run dev:self-hosted-stt`

## Point Next.js at this mock

In `.env.local` for the Next app:

```bash
SELF_HOSTED_STT_ENABLED=true
SELF_HOSTED_STT_BASE_URL=http://127.0.0.1:8788
# optional:
# SELF_HOSTED_STT_API_KEY=dev-secret
```

See `docs/voice/self-hosted-stt-engine.md` for the full contract.
