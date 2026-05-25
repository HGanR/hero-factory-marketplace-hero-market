import { NextRequest, NextResponse } from "next/server";
import type { MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "@/lib/db/schema";
import { getExecutiveAdminUserId } from "@/lib/admin/get-executive-admin-user-id";
import { getDb } from "@/lib/db";
import { updateSkipperPromptOverlayStatus } from "@/lib/executive-agent/skipper-learning-store";
import { z } from "zod";

export const dynamic = "force-dynamic";

const PatchSchema = z.object({
  status: z.enum(["active", "rejected", "archived", "approved", "pending"]),
});

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const adminUserId = await getExecutiveAdminUserId(req);
  if (adminUserId == null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  try {
    const body = PatchSchema.parse(await req.json());
    const db = (await getDb()) as MySql2Database<typeof schema>;
    await updateSkipperPromptOverlayStatus(db, id, adminUserId, body.status);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "INVALID_REQUEST", issues: e.flatten() }, { status: 400 });
    }
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "OVERLAY_PATCH_FAILED", message: msg }, { status: 500 });
  }
}
