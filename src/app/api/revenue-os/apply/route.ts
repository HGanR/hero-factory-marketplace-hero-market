import { NextResponse } from "next/server";
import crypto from "crypto";
import { and, eq, gte } from "drizzle-orm";
import { RevenueOsApplySchema } from "@/lib/validators/revenue-os";
import { getDb } from "@/lib/db";
import { revenueOsApplications } from "@/lib/db/schema";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
const THROTTLE_MINUTES = 15;

export async function POST(req: Request) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    const body = await req.json();
    const parsed = RevenueOsApplySchema.parse(body);

    const db = await getDb();

    const email = parsed.email.trim().toLowerCase();
    const wallet = parsed.walletAddress?.toLowerCase().trim() || null;

    // Spam throttle: block repeat submissions from same email within window
    const cutoff = new Date(Date.now() - THROTTLE_MINUTES * 60 * 1000);
    const recent = await db
      .select({ id: revenueOsApplications.id })
      .from(revenueOsApplications)
      .where(
        and(
          eq(revenueOsApplications.email, email),
          gte(revenueOsApplications.createdAt, cutoff)
        )
      )
      .limit(1);

    if (recent.length > 0) {
      return NextResponse.json(
        {
          error: "INVALID_REQUEST",
          message: `Please wait ${THROTTLE_MINUTES} minutes before submitting again.`,
        },
        { status: 429 }
      );
    }

    const id = crypto.randomUUID();

    await db.insert(revenueOsApplications).values({
      id,
      userId: parsed.userId ?? null,
      clientId: parsed.clientId?.trim() || null,
      trustId: parsed.trustId?.trim() || null,
      walletAddress: wallet,
      fullName: parsed.fullName.trim(),
      email,
      businessSummary: parsed.businessSummary.trim(),
      status: "SUBMITTED",
    });

    return NextResponse.json({ ok: true, id });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "INVALID_REQUEST", message },
      { status: 400 }
    );
  }
}
