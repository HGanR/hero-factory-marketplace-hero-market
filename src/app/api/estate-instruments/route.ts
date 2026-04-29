import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { estateInstruments, estateInstrumentVersions } from "@/lib/db/schema";
import { verifyToken } from "@/lib/auth";
import { cookies } from "next/headers";
import crypto from "crypto";

const CreateDraftSchema = z.object({
  type: z.enum(["WILL", "TESTAMENTARY_TRUST"]),
  title: z.string().min(3),
  jurisdiction: z.string().min(2).optional(),
  payload: z.unknown().default({}),
});

async function getAuthedUserId(): Promise<number | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth-token")?.value ?? null;
  if (!token) return null;
  const payload = verifyToken(token);
  const userId = payload?.userId;
  return typeof userId === "number" ? userId : null;
}

async function getActiveContext(userId: number) {
  // For now, return empty context - you can implement this based on your active trust/client logic
  return {
    clientId: null,
    entityId: null,
    trustId: null,
  };
}

export async function POST(req: Request) {
  try {
    const userId = await getAuthedUserId();
    if (!userId) {
      return NextResponse.json({ ok: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } }, { status: 401 });
    }

    const body = CreateDraftSchema.parse(await req.json());
    const active = await getActiveContext(userId);

    const db = await getDb();
    const instrumentId = crypto.randomUUID();
    const publicId = crypto.randomUUID();

    await db.insert(estateInstruments).values({
      id: instrumentId,
      publicId,
      type: body.type,
      status: "DRAFT",
      title: body.title,
      jurisdiction: body.jurisdiction ?? null,
      userId,
      clientId: active.clientId,
      entityId: active.entityId,
      trustId: active.trustId,
    });

    // Create initial version
    await db.insert(estateInstrumentVersions).values({
      id: crypto.randomUUID(),
      instrumentId,
      version: 1,
      payloadJson: JSON.stringify(body.payload),
    });

    // Fetch the complete instrument
    const completeInstrument = await db.select().from(estateInstruments).where(eq(estateInstruments.id, instrumentId)).limit(1);

    return NextResponse.json({ ok: true, instrument: completeInstrument[0] });
  } catch (err: any) {
    const error = {
      message: err.message || "Failed to create estate instrument",
      code: err.code || "INTERNAL_ERROR"
    };
    return NextResponse.json({ ok: false, error }, { status: 500 });
  }
}