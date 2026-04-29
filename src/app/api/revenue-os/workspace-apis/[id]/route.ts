import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { ensureRevenueOsWorkspaceApisTable } from "@/lib/db/revenue-os-workspace-apis-ensure";
import { revenueOsWorkspaceApis } from "@/lib/db/schema";
import { getAuthedUserId } from "@/lib/api/auth";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { encryptToken } from "@/lib/social/encrypt";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
type Params = { params: Promise<{ id: string }> };

const PatchSchema = z.object({
  label: z.string().max(120).optional().nullable(),
  apiKey: z.string().min(1).optional(),
  endpointUrl: z.union([z.string().url().max(512), z.literal("")]).optional().nullable(),
});

export async function PATCH(req: NextRequest, ctx: Params) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    const userId = await getAuthedUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await ctx.params;
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const parsed = PatchSchema.safeParse(body);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return NextResponse.json(
        { error: firstIssue?.message ?? "Invalid request" },
        { status: 400 }
      );
    }

    await ensureRevenueOsWorkspaceApisTable();
    const db = await getDb();

    const updates: Record<string, unknown> = {};
    if (parsed.data.label !== undefined) updates.label = parsed.data.label != null ? (parsed.data.label.trim() || null) : null;
    if (parsed.data.apiKey !== undefined) updates.apiKeyEnc = encryptToken(parsed.data.apiKey.trim());
    if (parsed.data.endpointUrl !== undefined)
      updates.endpointUrl = (parsed.data.endpointUrl === "" || parsed.data.endpointUrl === null)
        ? null
        : String(parsed.data.endpointUrl).trim();

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ ok: true, message: "No updates" });
    }

    await db
      .update(revenueOsWorkspaceApis)
      .set(updates as Record<string, string | null>)
      .where(
        and(
          eq(revenueOsWorkspaceApis.id, id),
          eq(revenueOsWorkspaceApis.userId, String(userId))
        )
      );

    return NextResponse.json({ ok: true, message: "Integration updated" });
  } catch (e) {
    console.error("[revenue-os/workspace-apis] PATCH", e);
    return NextResponse.json({ error: "Failed to update workspace API" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: Params) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    const userId = await getAuthedUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await ctx.params;
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    await ensureRevenueOsWorkspaceApisTable();
    const db = await getDb();
    const result = await db
      .delete(revenueOsWorkspaceApis)
      .where(
        and(
          eq(revenueOsWorkspaceApis.id, id),
          eq(revenueOsWorkspaceApis.userId, String(userId))
        )
      );

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[revenue-os/workspace-apis] DELETE", e);
    return NextResponse.json({ error: "Failed to remove workspace API" }, { status: 500 });
  }
}
