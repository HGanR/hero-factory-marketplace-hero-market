# Self-hosted TTS voice engine

Hero Market can clone voices and synthesize speech through a **self-hosted** HTTP service instead of ElevenLabs. The app calls your engine using `SELF_HOSTED_TTS_BASE_URL` as the origin (no trailing slash).

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SELF_HOSTED_TTS_ENABLED` | Yes | Must be `true`, `1`, `yes`, or `on` (case-insensitive) or the integration stays off. |
| `SELF_HOSTED_TTS_BASE_URL` | Yes when enabled | Origin of your engine, e.g. `https://voice.internal.example.com` or `https://api.example.com/v1/voice`. No trailing slash. |
| `SELF_HOSTED_TTS_API_KEY` | No | If set, sent as `Authorization: Bearer <key>` on every request to your engine. **Never** returned in API responses or admin health JSON. |

If `SELF_HOSTED_TTS_ENABLED` is true but `SELF_HOSTED_TTS_BASE_URL` is missing, voice creation returns **503** with: *Self-hosted voice engine not configured.*

## Local mock engine (development)

For **end-to-end testing without ElevenLabs**, run the in-repo mock HTTP server (synthetic sine-wave WAV only — not real cloning):

```bash
npm run dev:self-hosted-tts
```

Then set:

```bash
SELF_HOSTED_TTS_ENABLED=true
SELF_HOSTED_TTS_BASE_URL=http://127.0.0.1:8787
```

Details: `tools/self-hosted-tts-dev-server/README.md`.

## Endpoints your engine must implement

### `POST /voices/create`

**Request:** `multipart/form-data`

- `name` (string): Display or internal label for the new voice.
- `files` (one or more file parts): Audio clips (e.g. WAV, MP3, WebM) used for cloning.

**Response:** JSON with a voice id in **any** of these shapes (the app accepts all):

```json
{ "voiceId": "string" }
```

```json
{ "voice_id": "string" }
```

```json
{ "id": "string" }
```

The stored value in `ai_voices.providerVoiceId` is whatever id your engine returns.

### `POST /tts/speak`

**Request:** `application/json`

The app sends (mirrored keys for compatibility):

```json
{
  "voiceId": "string",
  "voice_id": "string",
  "text": "string"
}
```

`text` may be up to 8000 characters for executive read-aloud; preview uses a short sample.

**Response:** Raw **binary audio**. Acceptable `Content-Type` values include:

- `audio/mpeg`
- `audio/wav` or `audio/wave`
- `audio/ogg`

### Optional: `GET /voices/:id`

Not used by the app today. You may implement it for debugging or future UI (e.g. voice metadata).

## Reliability notes

- Respond to invalid health probes (empty body, missing files) with **4xx** rather than hanging; the dashboard health check uses short timeouts.
- Keep TLS certificates valid if the app reaches the engine over HTTPS from the server.
- Idempotent or safe rejection of duplicate `name` values helps repeated health checks in development.

## Related code

- Client: `src/lib/voices/self-hosted-tts-client.ts`, `src/lib/voices/self-hosted-tts-health.ts`, `src/lib/voices/voice-provider.ts`
- Admin health: `GET /api/admin/executive-agent/voice/self-hosted-health` (admin session; no secrets in JSON).
- AI Agency: `GET /api/app/voices?includeSelfHostedHealth=1` includes a `selfHostedHealth` object (same probe as admin health, user session).
