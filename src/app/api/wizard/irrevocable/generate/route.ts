import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { wizardSessions, generatedDocuments } from "@/lib/db/schema";
import { getAuthedUserId } from "@/lib/api/auth";
import { eq, and } from "drizzle-orm";
import { IrrevocableTrustWizardSchema } from "@/lib/irrevocableTrust/schema";
import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";

function sha256Hex(data: Buffer | string): string {
  const hash = crypto.createHash("sha256");
  hash.update(typeof data === "string" ? Buffer.from(data, "utf-8") : data);
  return hash.digest("hex");
}

export async function POST(req: NextRequest) {
  const userId = await getAuthedUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { sessionId } = body as { sessionId: string };

    const db = await getDb();
    const sessionRows = await db
      .select()
      .from(wizardSessions)
      .where(and(eq(wizardSessions.id, sessionId), eq(wizardSessions.userId, userId)))
      .limit(1);

    if (sessionRows.length === 0) {
      return NextResponse.json({ ok: false, error: { code: "NOT_FOUND", message: "Session not found" } }, { status: 404 });
    }

    const session = sessionRows[0];
    if (session.status === "LOCKED" || session.status === "GENERATED") {
      return NextResponse.json(
        { ok: false, error: { code: "ALREADY_GENERATED", message: "Already generated/locked" } },
        { status: 409 }
      );
    }

    const data = JSON.parse(session.dataJson || "{}");
    const parsed = IrrevocableTrustWizardSchema.safeParse(data);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: { code: "VALIDATION", message: "Wizard is incomplete or invalid", details: parsed.error.flatten() } },
        { status: 422 }
      );
    }

    // Lock before generating to prevent drift
    await db.update(wizardSessions).set({ status: "LOCKED" }).where(eq(wizardSessions.id, sessionId));

    // Placeholder until you wire doc generation:
    // In production, you would:
    // 1. Use docxtemplater to render a DOCX template
    // 2. Upload to S3/R2 storage
    // 3. Store the storage key
    const placeholder = Buffer.from(JSON.stringify({ generatedAt: new Date().toISOString(), data: parsed.data }, null, 2));
    const digest = sha256Hex(placeholder);
    const storageKey = `trust-wizard/irrevocable/${sessionId}/${digest}.json`;

    const doc = await db.insert(generatedDocuments).values({
      id: uuidv4(),
      sessionId,
      title: `${parsed.data.terms.trustName} - Irrevocable Trust (Draft)`,
      mimeType: "application/json",
      storageKey,
      sha256: digest,
    });

    await db.update(wizardSessions).set({ status: "GENERATED" }).where(eq(wizardSessions.id, sessionId));

    // Fetch the created document
    const docId = (doc as any).insertId || uuidv4();
    const docRows = await db
      .select()
      .from(generatedDocuments)
      .where(eq(generatedDocuments.sessionId, sessionId))
      .limit(1);

    return NextResponse.json({ ok: true, documentId: docRows[0]?.id || docId });
  } catch (error: any) {
    console.error("Generate document error:", error);
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: error?.message || "Failed to generate document" } },
      { status: 500 }
    );
  }
}
