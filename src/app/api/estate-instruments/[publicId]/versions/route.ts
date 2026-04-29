import { NextResponse } from "next/server";
import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import crypto from "crypto";
import { getDb } from "@/lib/db";
import { estateInstruments, estateInstrumentVersions } from "@/lib/db/schema";
import { verifyToken } from "@/lib/auth";
import { cookies } from "next/headers";

const AppendVersionSchema = z.object({
  payload: z.unknown(),
});

async function getAuthedUserId(): Promise<number | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth-token")?.value ?? null;
  if (!token) return null;
  const payload = verifyToken(token);
  const userId = payload?.userId;
  return typeof userId === "number" ? userId : null;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ publicId: string }> }
) {
  try {
    const userId = await getAuthedUserId();
    if (!userId) {
      return NextResponse.json({ ok: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } }, { status: 401 });
    }

    const { payload } = AppendVersionSchema.parse(await req.json());
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
        { ok: false, error: { code: "NOT_EDITABLE", message: "Instrument is not editable." } },
        { status: 409 }
      );
    }

    // Get the latest version number
    const latestVersions = await db.select({ version: estateInstrumentVersions.version })
      .from(estateInstrumentVersions)
      .where(eq(estateInstrumentVersions.instrumentId, instrument[0].id))
      .orderBy(desc(estateInstrumentVersions.version))
      .limit(1);

    const nextVersion = (latestVersions[0]?.version ?? 0) + 1;

    const versionId = crypto.randomUUID();
    await db.insert(estateInstrumentVersions).values({
      id: versionId,
      instrumentId: instrument[0].id,
      version: nextVersion,
      payloadJson: JSON.stringify(payload),
    });

    return NextResponse.json({ ok: true, version: { id: versionId, version: nextVersion } });
  } catch (err: any) {
    const error = {
      message: err.message || "Failed to save version",
      code: err.code || "INTERNAL_ERROR"
    };
    return NextResponse.json({ ok: false, error }, { status: 500 });
  }
}