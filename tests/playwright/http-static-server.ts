import http from "http";
import fs from "fs";
import path from "path";

/** Minimal static file server for parity HTML/CSS (no extra deps). */
export function startStaticServer(rootDir: string): Promise<{ port: number; close: () => Promise<void> }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        const url = req.url?.split("?")[0] || "/";
        const safe = path.normalize(url).replace(/^(\.\.[\/\\])+/, "");
        const filePath = path.join(rootDir, safe === "/" ? "index.html" : safe);
        if (!filePath.startsWith(path.resolve(rootDir))) {
          res.statusCode = 403;
          res.end();
          return;
        }
        if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
          res.statusCode = 404;
          res.end();
          return;
        }
        const ext = path.extname(filePath);
        const ct =
          ext === ".css" ? "text/css" : ext === ".html" ? "text/html" : ext === ".js" ? "application/javascript" : "application/octet-stream";
        res.setHeader("Content-Type", ct);
        res.end(fs.readFileSync(filePath));
      } catch {
        res.statusCode = 500;
        res.end();
      }
    });
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      resolve({
        port,
        close: () =>
          new Promise((res) => {
            server.close(() => res());
          }),
      });
    });
    server.on("error", reject);
  });
}
