import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { estateInstruments } from "@/lib/db/schema";
import { verifyToken } from "@/lib/auth";
import { cookies } from "next/headers";

async function getAuthedUserId(): Promise<number | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth-token")?.value ?? null;
  if (!token) return null;
  const payload = verifyToken(token);
  const userId = payload?.userId;
  return typeof userId === "number" ? userId : null;
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ publicId: string }> }
) {
  try {
    const userId = await getAuthedUserId();
    if (!userId) {
      return NextResponse.json({ ok: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } }, { status: 401 });
    }

    const { publicId } = await params;
    const db = await getDb();

    const instrument = await db.select().from(estateInstruments).where(eq(estateInstruments.publicId, publicId)).limit(1);

    if (!instrument.length || instrument[0].userId !== userId) {
      return NextResponse.json(
        { ok: false, error: { code: "NOT_FOUND", message: "Instrument not found." } },
        { status: 404 }
      );
    }

    if (instrument[0].status !== "DRAFT") {
      return NextResponse.json(
        { ok: false, error: { code: "NOT_ALLOWED", message: "Instrument cannot be finalized." } },
        { status: 409 }
      );
    }

    await db.update(estateInstruments).set({ status: "FINAL" }).where(eq(estateInstruments.id, instrument[0].id));

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    const error = {
      message: err.message || "Failed to finalize instrument",
      code: err.code || "INTERNAL_ERROR"
    };
    return NextResponse.json({ ok: false, error }, { status: 500 });
  }
}