import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import crypto from "crypto";
import { logBentleyCorrelationEvent } from "@/lib/revenue-os/bentley-correlation-server";
import { getDb } from "@/lib/db";
import { ensureRevenueOsLiveModuleTables } from "@/lib/db/revenue-os-live-modules-ensure";
import { channelSpendSnapshots } from "@/lib/db/schema";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
const BodySchema = z.object({
  userId: z.string().min(1),
  clientId: z.string().optional(),
  trustId: z.string().optional(),
  profileId: z.string().optional(),
  month: z.string().regex(/^\d{4}-\d{2}$/),
  rows: z
    .array(
      z.object({
        channel: z.string().min(1).max(64),
        spend: z.number().min(0),
        revenueAttributed: z.number().min(0).optional(),
        roas: z.number().min(0).optional(),
      })
    )
    .min(1),
});

/**
 * POST /api/revenue-os/capital/channel-spend
 * Upserts actual channel spend rows for a calendar month (workspace-scoped).
 */
export async function POST(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    logBentleyCorrelationEvent("revenue-os/capital/channel-spend", req);
    const body = await req.json().catch(() => ({}));
    const parsed = BodySchema.parse(body);

    await ensureRevenueOsLiveModuleTables();
    const db = await getDb();
    const clientId = parsed.clientId?.trim() ?? "";
    const trustId = parsed.trustId?.trim() ?? "";
    const profileId = parsed.profileId?.trim() || null;

    const written: string[] = [];

    for (const row of parsed.rows) {
      const channel = row.channel.trim();
      const spend = row.spend;
      let revenueAttributed =
        row.revenueAttributed !== undefined ? row.revenueAttributed : null;
      let roas = row.roas !== undefined ? row.roas : null;
      if (roas == null && revenueAttributed != null && spend > 0) {
        roas = revenueAttributed / spend;
      }

      const [existing] = await db
        .select({ id: channelSpendSnapshots.id })
        .from(channelSpendSnapshots)
        .where(
          and(
            eq(channelSpendSnapshots.userId, parsed.userId),
            eq(channelSpendSnapshots.clientId, clientId),
            eq(channelSpendSnapshots.trustId, trustId),
            eq(channelSpendSnapshots.month, parsed.month),
            eq(channelSpendSnapshots.channel, channel)
          )
        )
        .limit(1);

      if (existing) {
        await db
          .update(channelSpendSnapshots)
          .set({
            spend: String(spend),
            revenueAttributed:
              revenueAttributed != null ? String(revenueAttributed) : null,
            roas: roas != null ? String(roas) : null,
            profileId,
          })
          .where(eq(channelSpendSnapshots.id, existing.id));
        written.push(existing.id);
      } else {
        const id = crypto.randomUUID();
        await db.insert(channelSpendSnapshots).values({
          id,
          userId: parsed.userId,
          clientId,
          trustId,
          profileId,
          month: parsed.month,
          channel,
          spend: String(spend),
          revenueAttributed:
            revenueAttributed != null ? String(revenueAttributed) : null,
          roas: roas != null ? String(roas) : null,
        });
        written.push(id);
      }
    }

    return NextResponse.json({ ok: true, ids: written, month: parsed.month });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", details: e.flatten() },
        { status: 400 }
      );
    }
    console.error("[revenue-os/capital/channel-spend]", e);
    return NextResponse.json(
      { error: "Failed to save channel spend" },
      { status: 500 }
    );
  }
}
