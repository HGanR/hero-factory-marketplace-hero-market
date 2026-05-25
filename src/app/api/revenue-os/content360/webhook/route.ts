import { NextRequest, NextResponse } from "next/server";
import {
  getContent360WebhookSecret,
  getContent360WebhookSignatureHeaderName,
  verifyContent360WebhookSignature,
} from "@/lib/revenue-os/content360-webhook-verify";

/**
 * POST /api/revenue-os/content360/webhook
 * Placeholder until Content360 documents events and payloads.
 */
export async function POST(req: NextRequest) {
  if (!getContent360WebhookSecret()) {
    return NextResponse.json({ ok: false, error: "Webhook not configured" }, { status: 503 });
  }

  const raw = await req.text();
  const headerName = getContent360WebhookSignatureHeaderName();
  const sig = req.headers.get(headerName) ?? req.headers.get(headerName.replace(/^x-/, "X-"));

  if (!verifyContent360WebhookSignature(sig, raw)) {
    return NextResponse.json({ ok: false, error: "Invalid signature" }, { status: 401 });
  }

  let parsed: unknown = null;
  try {
    parsed = raw.trim() ? JSON.parse(raw) : null;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const eventType =
    parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? String((parsed as Record<string, unknown>).type ?? (parsed as Record<string, unknown>).event ?? "unknown")
      : "unknown";

  // TODO(Content360): map vendor event types → provider_publish_jobs / campaign_posts updates when docs exist.
  console.info("[content360-webhook] unsupported event (no-op)", { eventType });

  return NextResponse.json({ ok: true, received: true, eventType, handled: false });
}
