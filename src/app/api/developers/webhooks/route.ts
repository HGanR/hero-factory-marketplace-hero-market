/**
 * Developer Webhooks
 * GET: List webhooks for current user
 * POST: Create webhook
 */
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import { getDb } from "@/lib/db";
import { developerWebhooks } from "@/lib/db/schema";
import { getAuthedUserId } from "@/lib/api/auth";
import { v4 as uuidv4 } from "uuid";

const VALID_EVENTS = [
  "certificate_issued",
  "instrument_issued",
  "collateral_pledged",
  "proceeds_received",
  "accounting_event_processed",
];

export async function GET() {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = await getDb();
  const hooks = await db
    .select()
    .from(developerWebhooks)
    .where(eq(developerWebhooks.userId, userId));

  return NextResponse.json({
    ok: true,
    webhooks: hooks.map((h) => ({
      id: h.id,
      url: h.url,
      events: JSON.parse(h.events || "[]"),
      isActive: h.isActive,
      lastTriggeredAt: h.lastTriggeredAt?.toISOString(),
      lastStatus: h.lastStatus,
      createdAt: h.createdAt?.toISOString(),
    })),
  });
}

export async function POST(req: NextRequest) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { url: string; events?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const url = (body.url ?? "").trim();
  if (!url.startsWith("https://")) {
    return NextResponse.json({ error: "url must be HTTPS" }, { status: 400 });
  }

  const events = Array.isArray(body.events) ? body.events : ["certificate_issued"];
  const invalid = events.filter((e) => !VALID_EVENTS.includes(e));
  if (invalid.length) {
    return NextResponse.json({ error: `Invalid events: ${invalid.join(", ")}` }, { status: 400 });
  }

  const id = uuidv4();
  const secret = crypto.randomBytes(32).toString("base64url");

  const db = await getDb();
  await db.insert(developerWebhooks).values({
    id,
    userId,
    url,
    events: JSON.stringify(events),
    secret, // Store raw for HMAC signing (Stripe-style)
    isActive: true,
  });

  return NextResponse.json({
    ok: true,
    webhook: {
      id,
      url,
      events,
      secret,
      warning: "Save the secret now. You will not be able to see it again.",
    },
  });
}
