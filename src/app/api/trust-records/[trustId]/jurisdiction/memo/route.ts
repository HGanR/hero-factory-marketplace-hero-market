import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { trusts, minuteBooks, minutes, resolutions, trustDocuments } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { generateJurisdictionMemo, generateJurisdictionResolution } from "@/lib/jurisdictions/dapt/memo";
import { v4 as uuidv4 } from "uuid";

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
  { params }: { params: Promise<{ trustId: string }> }
) {
  try {
    const userId = await getAuthedUserId();
    if (!userId) {
      return NextResponse.json({ ok: false, error: { message: "Unauthorized", code: "UNAUTHORIZED" } }, { status: 401 });
    }

    const resolvedParams = await params;
    const db = await getDb();

    // Verify trust ownership and get jurisdiction data
    const trustRows = await db.select({
      id: trusts.id,
      name: trusts.name,
      jurisdictionStateCode: trusts.jurisdictionStateCode,
      jurisdictionObjective: trusts.jurisdictionObjective,
      jurisdictionHasDigitalAssets: trusts.jurisdictionHasDigitalAssets,
      jurisdictionSelfSettled: trusts.jurisdictionSelfSettled,
      jurisdictionScoreSnapshot: trusts.jurisdictionScoreSnapshot,
      jurisdictionReasonsSnapshot: trusts.jurisdictionReasonsSnapshot,
      jurisdictionSelectedAt: trusts.jurisdictionSelectedAt,
      jurisdictionSelectedByUserId: trusts.jurisdictionSelectedByUserId,
    }).from(trusts).where(and(eq(trusts.id, resolvedParams.trustId), eq(trusts.userId, userId))).limit(1);

    if (trustRows.length === 0) {
      return NextResponse.json({ ok: false, error: { message: "Trust not found", code: "NOT_FOUND" } }, { status: 404 });
    }

    const trust = trustRows[0];

    if (!trust.jurisdictionStateCode) {
      return NextResponse.json({ ok: false, error: { message: "No jurisdiction selected for this trust", code: "NO_JURISDICTION" } }, { status: 400 });
    }

    // Get or create minute book for this trust
    let minuteBookRows = await db.select().from(minuteBooks).where(eq(minuteBooks.trustId, resolvedParams.trustId)).limit(1);

    let minuteBook;
    if (minuteBookRows.length === 0) {
      // Create minute book
      const minuteBookId = uuidv4();
      await db.insert(minuteBooks).values({
        id: minuteBookId,
        clientId: "", // We'll need to get this from trust relationship
        trustId: resolvedParams.trustId,
        entityType: "Trust",
        createdBy: userId,
      });

      // Fetch the created minute book
      const newMinuteBookRows = await db.select().from(minuteBooks).where(eq(minuteBooks.id, minuteBookId)).limit(1);
      minuteBook = newMinuteBookRows[0];
    } else {
      minuteBook = minuteBookRows[0];
    }

    // Generate jurisdiction memo content
    const memoData = {
      trustId: trust.id,
      situsStateCode: trust.jurisdictionStateCode,
      objective: trust.jurisdictionObjective!,
      hasDigitalAssets: trust.jurisdictionHasDigitalAssets!,
      selfSettled: trust.jurisdictionSelfSettled!,
      score: trust.jurisdictionScoreSnapshot!,
      reasons: trust.jurisdictionReasonsSnapshot ? JSON.parse(trust.jurisdictionReasonsSnapshot) : [],
      selectedAt: trust.jurisdictionSelectedAt!,
      selectedByUserId: trust.jurisdictionSelectedByUserId!,
      trustName: trust.name || undefined,
    };

    const memoContent = generateJurisdictionMemo(memoData);
    const resolutionData = generateJurisdictionResolution(memoData);

    // Create minute entry
    const minuteId = uuidv4();
    await db.insert(minutes).values({
      id: minuteId,
      minuteBookId: minuteBook.id,
      recordType: "written_consent",
      title: "Situs and Jurisdiction Determination",
      actionDate: new Date(),
      calledBy: "Trustee",
      chair: "Trustee",
      quorumRequired: false,
      quorumMet: true,
      status: "approved",
      createdBy: userId,
      approvedAt: new Date(),
      finalizedAt: new Date(),
      hash: "", // Could compute hash if needed
    });

    // Create resolution
    await db.insert(resolutions).values({
      id: uuidv4(),
      minutesId: minuteId,
      title: resolutionData.title,
      resolutionType: "Organizational",
      text: resolutionData.text,
      effectiveDate: new Date(),
      status: "approved",
    });

    // Store memo content as document
    await db.insert(trustDocuments).values({
      id: uuidv4(),
      trustId: resolvedParams.trustId,
      docType: "Minutes",
      title: "Situs and Jurisdiction Determination",
      version: 1,
      classification: "private",
      contentJson: JSON.stringify({
        type: "jurisdiction_memo",
        content: memoContent,
        metadata: memoData,
      }),
      createdAt: new Date(),
    });

    return NextResponse.json({
      ok: true,
      minuteId: minuteId,
      message: "Jurisdiction memo created and added to minute book"
    });

  } catch (err: any) {
    const error = {
      message: err.message || "Failed to create jurisdiction memo",
      code: err.code || "INTERNAL_ERROR"
    };
    return NextResponse.json({ ok: false, error }, { status: 500 });
  }
}