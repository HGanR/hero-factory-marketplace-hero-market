/**
 * Dev mock — Hero Market self-hosted STT contract.
 * POST /stt/transcribe returns a fixed transcript (no ASR).
 *
 * Usage: npm run dev:self-hosted-stt
 */

import http from "node:http";

const PORT = Number.parseInt(String(process.env.PORT || "8788"), 10) || 8788;
const HOST = process.env.BIND_HOST?.trim() || "127.0.0.1";

function drainReq(req) {
  return new Promise((resolve) => {
    req.on("data", () => {});
    req.on("end", resolve);
    req.on("error", resolve);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${HOST}:${PORT}`);

  try {
    if (req.method === "GET" && url.pathname === "/") {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Cache-Control", "no-store");
      return res.end(JSON.stringify({ ok: true, service: "self-hosted-stt-dev-server" }));
    }

    if (req.method === "POST" && url.pathname === "/stt/transcribe") {
      await drainReq(req);
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Cache-Control", "no-store");
      return res.end(JSON.stringify({ transcript: "Hello Skipper", confidence: 1 }));
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
  console.log(`[self-hosted-stt-dev-server] http://${HOST}:${PORT}`);
  console.log(`  GET  /               health JSON`);
  console.log(`  POST /stt/transcribe multipart (audio + optional language) -> { transcript, confidence }`);
});
