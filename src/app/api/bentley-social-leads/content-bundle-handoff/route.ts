import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
/**
 * Persist and retrieve Bentley SLI → Content Bundle structured handoffs (operator-initiated).
 */

import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { randomUUID } from "crypto";

import { requireUserId } from "@/lib/auth";
import { getDb } from "@/lib/db";
import {
  bentleyContentBundleHandoffs,
  leadUploads,
} from "@/lib/db/schema.bentley-social-leads";
import type { BentleyContentBundleHandoff } from "@/lib/bentley-social-leads/handoff/contentBundleHandoffTypes";
import { isBentleyContentBundleHandoffPayload } from "@/lib/bentley-social-leads/handoff/validateContentBundleHandoffPayload";

export const runtime = "nodejs";

/**
 * POST — persist handoff; returns stable id. Body: { payload: BentleyContentBundleHandoff }
 */
export async function POST(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  let userId: number;
  try {
    userId = requireUserId(req);
  } catch {
    return NextResponse.json({ ok: false, error: "Unauthorized" } as const, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { payload?: unknown };
  if (!isBentleyContentBundleHandoffPayload(body.payload)) {
    return NextResponse.json({ ok: false, error: "Invalid handoff payload" } as const, { status: 400 });
  }

  const incoming = body.payload;
  const db = await getDb();

  if (incoming.provenance.uploadId) {
    const [up] = await db
      .select({ id: leadUploads.id })
      .from(leadUploads)
      .where(and(eq(leadUploads.id, incoming.provenance.uploadId!), eq(leadUploads.userId, userId)))
      .limit(1);
    if (!up) {
      return NextResponse.json({ ok: false, error: "Upload not found for user" } as const, { status: 403 });
    }
  }

  const id = randomUUID();
  const createdAt = incoming.createdAt ?? new Date().toISOString();
  const full: BentleyContentBundleHandoff = {
    ...incoming,
    handoffId: id,
    createdAt,
  };
  await db.insert(bentleyContentBundleHandoffs).values({
    id,
    userId,
    uploadId: full.provenance.uploadId ?? null,
    runId: full.provenance.runId ?? null,
    payloadJson: full as unknown as Record<string, unknown>,
    createdAt: new Date(createdAt),
  });

  return NextResponse.json({ ok: true, handoffId: id, createdAt } as const);
}

/**
 * GET — latest handoff for user, or ?id= for specific id.
 */
export async function GET(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  let userId: number;
  try {
    userId = requireUserId(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const id = url.searchParams.get("id")?.trim();

  const db = await getDb();

  if (id) {
    const [row] = await db
      .select()
      .from(bentleyContentBundleHandoffs)
      .where(and(eq(bentleyContentBundleHandoffs.id, id), eq(bentleyContentBundleHandoffs.userId, userId)))
      .limit(1);
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ handoff: row.payloadJson as BentleyContentBundleHandoff });
  }

  const [latest] = await db
    .select()
    .from(bentleyContentBundleHandoffs)
    .where(eq(bentleyContentBundleHandoffs.userId, userId))
    .orderBy(desc(bentleyContentBundleHandoffs.createdAt))
    .limit(1);

  return NextResponse.json({ handoff: latest?.payloadJson ?? null });
}
