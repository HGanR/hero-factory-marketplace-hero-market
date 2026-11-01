# Self-hosted STT engine (SKIPPER / Executive voice)

Hero Market can transcribe microphone audio through a **self-hosted HTTP service** instead of the browser `SpeechRecognition` API (needed for **Firefox** and other browsers without reliable Web Speech).

## Environment variables (Next.js server)

| Variable | Required | Description |
|----------|----------|-------------|
| `SELF_HOSTED_STT_ENABLED` | Yes | Must be `true`, `1`, `yes`, or `on` (case-insensitive). |
| `SELF_HOSTED_STT_BASE_URL` | Yes when enabled | Origin of the engine, e.g. `http://127.0.0.1:8788`. No trailing slash. |
| `SELF_HOSTED_STT_API_KEY` | No | If set, sent as `Authorization: Bearer <key>` on requests to the engine. **Never** returned in API JSON. |

If enabled but `BASE_URL` is missing, `POST /api/admin/executive-agent/voice/transcribe` returns **503**.

## HTTP contract

### `POST /stt/transcribe`

- **Content-Type:** `multipart/form-data`
- **Fields:**
  - `audio` (required): audio file (`WebM`, `WAV`, `MP3`, or engine-supported types).
  - `language` (optional): BCP-47-ish tag, e.g. `en-US`.

**Response JSON:**

```json
{
  "transcript": "Hello Skipper",
  "confidence": 0.92
}
```

`confidence` is optional.

## Local dev mock

From `hero-market`:

```bash
npm run dev:self-hosted-stt
```

Default URL: `http://127.0.0.1:8788`

Details: `tools/self-hosted-stt-dev-server/README.md`.

## App integration

- **Health (admin):** `GET /api/admin/executive-agent/voice/self-hosted-stt-health`
- **Transcribe (admin):** `POST /api/admin/executive-agent/voice/transcribe` — browser sends recorded blob; server forwards to `SELF_HOSTED_STT_BASE_URL/stt/transcribe`, then the client calls existing `POST /api/admin/executive-agent/voice/turn` with the transcript.

## Code

- Client routing: `src/lib/voices/stt-provider.ts`
- Server client: `src/lib/voices/self-hosted-stt-client.ts`
- Health: `src/lib/voices/self-hosted-stt-health.ts`
