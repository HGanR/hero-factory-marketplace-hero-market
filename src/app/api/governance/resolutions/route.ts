import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { resolutions } from "@/lib/db/schema";
import { getAuthedUserId } from "@/lib/api/auth";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { getTemplateForResolution } from "@/lib/governance/resolution-templates";

export async function POST(req: NextRequest) {
  const userId = await getAuthedUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } }, { status: 401 });
  }

  try {
    const body = await req.json();
    const {
      minutesId,
      title,
      resolutionType,
      text,
      effectiveDate,
      expirationDate,
      monetaryThreshold,
      counterparty,
      approvalThreshold,
      isStanding,
      standingScope,
      useTemplate,
      templateVars,
      entityType,
    } = body;

    if (!minutesId || !title || !resolutionType || !effectiveDate) {
      return NextResponse.json(
        { ok: false, error: { code: "BAD_REQUEST", message: "minutesId, title, resolutionType, effectiveDate are required" } },
        { status: 400 }
      );
    }

    let finalText = text;
    if (useTemplate && templateVars && entityType) {
      const template = getTemplateForResolution(entityType, resolutionType);
      if (template) {
        finalText = template(templateVars);
      }
    }

    const db = await getDb();

    const resolutionId = uuidv4();
    await db.insert(resolutions).values({
      id: resolutionId,
      minutesId,
      title,
      resolutionType,
      text: finalText,
      effectiveDate,
      expirationDate: expirationDate || null,
      monetaryThreshold: monetaryThreshold ? String(monetaryThreshold) : null,
      counterparty: counterparty || null,
      approvalThreshold: approvalThreshold || "Majority",
      isStanding: isStanding || false,
      standingScope: standingScope ? JSON.stringify(standingScope) : null,
      status: "draft",
    });

    const created = await db.select().from(resolutions).where(eq(resolutions.id, resolutionId)).limit(1);

    return NextResponse.json({ ok: true, resolution: created[0] });
  } catch (error: any) {
    console.error("Create resolution error:", error);
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: error?.message || "Failed to create resolution" } },
      { status: 500 }
    );
  }
}
