/**
 * Dev-only mock for the Hero Market self-hosted TTS contract.
 * Not production voice cloning — returns synthetic WAV (sine wave), not your timbre.
 *
 * Usage: from repo root, `npm run dev:self-hosted-tts`
 * Env: PORT (default 8787), bind 127.0.0.1
 */

import http from "node:http";

const PORT = Number.parseInt(String(process.env.PORT || "8787"), 10) || 8787;
const HOST = process.env.BIND_HOST?.trim() || "127.0.0.1";

/** Drain request body (multipart for /voices/create is not persisted). */
function drainReq(req) {
  return new Promise((resolve) => {
    req.on("data", () => {});
    req.on("end", resolve);
    req.on("error", resolve);
  });
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw.trim()) return {};
  return JSON.parse(raw);
}

function wavHeader(dataLength, sampleRate, numChannels, bitsPerSample) {
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const buf = Buffer.alloc(44);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + dataLength, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(numChannels, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(byteRate, 28);
  buf.writeUInt16LE(blockAlign, 32);
  buf.writeUInt16LE(bitsPerSample, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(dataLength, 40);
  return buf;
}

/**
 * Short mono PCM WAV — deterministic sine; placeholder only.
 * @param {{ seconds?: number; sampleRate?: number; freq?: number; amplitude?: number }} opts
 */
function sineWaveWav(opts = {}) {
  const seconds = Math.min(2, Math.max(0.15, opts.seconds ?? 0.35));
  const sampleRate = opts.sampleRate ?? 16000;
  const freq = opts.freq ?? 440;
  const amplitude = opts.amplitude ?? 0.25;
  const numSamples = Math.floor(seconds * sampleRate);
  const bitsPerSample = 16;
  const numChannels = 1;
  const data = Buffer.alloc(numSamples * 2);
  for (let i = 0; i < numSamples; i++) {
    const v = Math.max(-1, Math.min(1, amplitude * Math.sin((2 * Math.PI * freq * i) / sampleRate)));
    data.writeInt16LE(Math.round(v * 32767), i * 2);
  }
  return Buffer.concat([wavHeader(data.length, sampleRate, numChannels, bitsPerSample), data]);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${HOST}:${PORT}`);

  try {
    if (req.method === "GET" && url.pathname === "/") {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Cache-Control", "no-store");
      return res.end(JSON.stringify({ ok: true, service: "self-hosted-tts-dev-server" }));
    }

    if (req.method === "POST" && url.pathname === "/voices/create") {
      await drainReq(req);
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Cache-Control", "no-store");
      const voiceId = `dev_voice_${Date.now()}`;
      return res.end(JSON.stringify({ voiceId }));
    }

    if (req.method === "POST" && url.pathname === "/tts/speak") {
      const body = await readJsonBody(req);
      const text = String(body.text ?? body.input ?? "");
      const wav = sineWaveWav({ seconds: 0.2 + Math.min(1.5, text.length * 0.012) });
      res.setHeader("Content-Type", "audio/wav");
      res.setHeader("Cache-Control", "no-store");
      return res.end(wav);
    }

    res.statusCode = 404;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    return res.end("not found");
  } catch (e) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    return res.end(e instanceof Error ? e.message : String(e));
  }
});

server.listen(PORT, HOST, () => {
  console.log(`[self-hosted-tts-dev-server] http://${HOST}:${PORT}`);
  console.log(`  GET  /              health JSON`);
  console.log(`  POST /voices/create multipart (name + files) -> { voiceId }`);
  console.log(`  POST /tts/speak     JSON { voiceId, text } -> audio/wav (sine placeholder)`);
});
