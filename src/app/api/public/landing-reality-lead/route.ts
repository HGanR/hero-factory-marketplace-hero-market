import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { ensureCrmTables } from "@/lib/db/crm-ensure";
import {
  upsertRealityLandingLead,
  type RealityLandingBusinessStatus,
} from "@/lib/landing/reality-lead-crm";

const BodySchema = z
  .object({
    sessionId: z.string().min(8).max(80),
    displayName: z.string().min(1).max(120).optional(),
    email: z.string().email().max(320).optional(),
    businessStatus: z.enum(["has_business", "planning", "neither"]).optional(),
    businessState: z.union([z.string().max(60), z.null()]).optional(),
  })
  .strict();

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 40;
const hits = new Map<string, number[]>();

function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

function allowRate(ip: string): boolean {
  const now = Date.now();
  const arr = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length <= MAX_PER_WINDOW;
}

function parseOwnerUserId(): number | null {
  const raw = process.env.REALITY_LANDING_CRM_OWNER_USER_ID?.trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * POST /api/public/landing-reality-lead
 * Public intake for REALITY on the marketing home page — writes to CRM for the configured owner user only.
 */
export async function POST(req: NextRequest) {
  if (!allowRate(clientIp(req))) {
    return NextResponse.json({ ok: false, error: "Too many requests" }, { status: 429 });
  }

  const ownerUserId = parseOwnerUserId();
  if (!ownerUserId) {
    console.warn("[landing-reality-lead] REALITY_LANDING_CRM_OWNER_USER_ID is not set");
    return NextResponse.json({ ok: false, error: "Lead capture is not configured" }, { status: 503 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });
  }

  const { sessionId, displayName, email, businessStatus, businessState } = parsed.data;
  if (!displayName && !email && !businessStatus && businessState === undefined) {
    return NextResponse.json({ ok: false, error: "Nothing to save" }, { status: 400 });
  }

  try {
    await ensureCrmTables();
    const db = await getDb();
    const payload: {
      sessionId: string;
      displayName?: string;
      email?: string;
      businessStatus?: RealityLandingBusinessStatus;
      businessState?: string | null;
    } = { sessionId };
    if (displayName != null) payload.displayName = displayName;
    if (email != null) payload.email = email;
    if (businessStatus != null) payload.businessStatus = businessStatus;
    if (businessState !== undefined) payload.businessState = businessState ?? null;

    const out = await upsertRealityLandingLead(db, ownerUserId, payload);
    return NextResponse.json({ ok: true, contactId: out.contactId });
  } catch (e) {
    console.error("[landing-reality-lead]", e);
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
