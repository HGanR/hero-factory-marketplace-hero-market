# self-hosted-tts-dev-server

**Development and integration testing only.** This process is **not** a real voice clone: it accepts upload multipart for `/voices/create` but **does not** analyze or store audio on disk — it only drains the request stream. `/tts/speak` returns a **short synthetic sine-wave WAV**, not speech from a model.

- No ElevenLabs, OpenAI, or other external voice APIs.
- No production-quality cloning.

## Run

From the **hero-market** repo root:

```bash
npm run dev:self-hosted-tts
```

Default URL: `http://127.0.0.1:8787`  
Override port: `PORT=9999 npm run dev:self-hosted-tts`

## Point Hero Market at this mock

In `.env.local` (or your shell) for the **Next app** (not this server):

```bash
SELF_HOSTED_TTS_ENABLED=true
SELF_HOSTED_TTS_BASE_URL=http://127.0.0.1:8787
# optional:
# SELF_HOSTED_TTS_API_KEY=dev-secret   # mock server ignores auth today
```

Then use **AI Agency → Use my voice — Self-hosted**, record or upload clips, **Create voice**, assign to an agent, and preview / Executive speak — all without ElevenLabs.

## Contract

Matches `docs/voice/self-hosted-tts-engine.md`:

| Method | Path | Notes |
|--------|------|--------|
| GET | `/` | `{ ok: true, service: "self-hosted-tts-dev-server" }` |
| POST | `/voices/create` | `multipart/form-data` with `name` + `files` (body drained; not stored) → `{ voiceId: "dev_voice_<timestamp>" }` |
| POST | `/tts/speak` | JSON `voiceId`, `voice_id`, `text` → `audio/wav` body |

## See also

- `docs/voice/self-hosted-tts-engine.md` — full integration contract for real engines.
