/**
 * Standalone Socket.IO server for Wreck Room multiplayer (path `/api/socket`).
 * Run alongside Next.js: `npx tsx scripts/wreck-room-socket.ts`
 * Default port 3001 — set NEXT_PUBLIC_WRECK_SOCKET_URL=http://127.0.0.1:3001 if needed.
 */
import { config } from "dotenv";
import { createServer } from "http";
import { initWreckRoomSocketServer } from "../src/lib/wreck-room/socket-server";

config({ path: ".env.local" });
config({ path: ".env" });

const port = parseInt(process.env.WRECK_SOCKET_PORT || "3001", 10);
const server = createServer((_req, res) => {
  res.writeHead(404);
  res.end();
});
initWreckRoomSocketServer(server);
server.listen(port, () => {
  console.log(
    `[wreck-room] Socket.IO listening on http://127.0.0.1:${port} (path /api/socket)`
  );
});
