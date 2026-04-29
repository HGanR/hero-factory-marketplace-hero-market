export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { entityOnboardings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { verifyToken } from "@/lib/auth";
import { uploadBlobToIPFS } from "@/lib/storage";

type DocType = "LETTER_OF_GOOD_OPERATION" | "ARTICLES_OF_INCORPORATION";

function isDocType(v: unknown): v is DocType {
  return v === "LETTER_OF_GOOD_OPERATION" || v === "ARTICLES_OF_INCORPORATION";
}

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get("auth-token")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const decoded = verifyToken(token);
    if (!decoded?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const form = await request.formData();
    const docType = form.get("docType");
    const file = form.get("file");

    if (!isDocType(docType)) {
      return NextResponse.json({ error: "Invalid docType" }, { status: 400 });
    }
    if (!(file instanceof Blob)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }

    const db = await getDb();
    const rows = await db
      .select()
      .from(entityOnboardings)
      .where(eq(entityOnboardings.userId, decoded.userId))
      .limit(1);

    if (rows.length === 0) {
      return NextResponse.json({ error: "Onboarding not found" }, { status: 404 });
    }
    const onboarding = rows[0];
    if (onboarding.isRevoked) {
      return NextResponse.json({ error: "Onboarding has been revoked" }, { status: 403 });
    }

    const ipfsUri = await uploadBlobToIPFS(file);
    const patch =
      docType === "LETTER_OF_GOOD_OPERATION"
        ? { letterOfGoodOperationUri: ipfsUri }
        : { articlesOfIncorporationUri: ipfsUri };

    await db.update(entityOnboardings).set(patch).where(eq(entityOnboardings.id, onboarding.id));

    const updatedRows = await db
      .select()
      .from(entityOnboardings)
      .where(eq(entityOnboardings.id, onboarding.id))
      .limit(1);
    const updated = updatedRows[0];

    const hasLetter = !!updated?.letterOfGoodOperationUri;
    const hasArticles = !!updated?.articlesOfIncorporationUri;
    const status = hasLetter && hasArticles ? "documents_complete" : "documents_pending";

    if (updated && updated.onboardingStatus !== status) {
      await db.update(entityOnboardings).set({ onboardingStatus: status }).where(eq(entityOnboardings.id, updated.id));
      const finalRows = await db
        .select()
        .from(entityOnboardings)
        .where(eq(entityOnboardings.id, updated.id))
        .limit(1);
      return NextResponse.json({ onboarding: finalRows[0] });
    }

    return NextResponse.json({ onboarding: updated });
  } catch (error) {
    console.error("Onboarding upload error:", error);
    return NextResponse.json({ error: "Failed to upload document" }, { status: 500 });
  }
}


