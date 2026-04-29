/**
 * Platform API v1 - Info
 * GET /api/v1 - API version and available resources
 */
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    version: "v1",
    docs: "/developers/events",
    resources: [
      { path: "/api/v1/trusts", methods: ["GET"], scope: "read:trusts" },
      { path: "/api/v1/trusts/:id", methods: ["GET"], scope: "read:trusts" },
      { path: "/api/v1/trusts/:id/assets", methods: ["GET"], scope: "read:assets" },
      { path: "/api/v1/trusts/:id/instruments", methods: ["GET"], scope: "read:instruments" },
      { path: "/api/v1/assets", methods: ["GET"], scope: "read:assets" },
      { path: "/api/v1/assets/:id", methods: ["GET"], scope: "read:assets" },
      { path: "/api/v1/instruments", methods: ["GET"], scope: "read:instruments" },
      { path: "/api/v1/instruments/:id", methods: ["GET"], scope: "read:instruments" },
      { path: "/api/v1/events", methods: ["GET"], scope: "read:events" },
      { path: "/api/v1/events/:id", methods: ["GET"], scope: "read:events" },
      { path: "/api/v1/workflows", methods: ["GET"], scope: "read:workflows" },
      { path: "/api/v1/workflows/:id", methods: ["GET"], scope: "read:workflows" },
      { path: "/api/v1/worlds", methods: ["GET"], scope: "read:worlds" },
      { path: "/api/v1/worlds/:id", methods: ["GET"], scope: "read:worlds" },
      { path: "/api/v1/worlds/:id/commerce", methods: ["GET"], scope: "read:commerce" },
      { path: "/api/v1/apps", methods: ["GET"], scope: "read:apps" },
      { path: "/api/v1/apps/:slug", methods: ["GET"], scope: "read:apps" },
      { path: "/api/v1/events/stream", methods: ["GET"], scope: "read:events" },
      { path: "/api/v1/agents", methods: ["GET"], scope: "read:worlds" },
      { path: "/api/v1/identity", methods: ["GET"], scope: "read:worlds" },
      { path: "/api/v1/identity/wallets", methods: ["POST"], scope: "write:worlds" },
    ],
    auth: {
      type: "Bearer",
      header: "Authorization: Bearer <api_key>",
      keys: "Create at /developers",
    },
  });
}
