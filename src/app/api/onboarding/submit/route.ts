import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { entityOnboardings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { verifyToken } from "@/lib/auth";

function isLast4(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}$/.test(s);
}

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get("auth-token")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const decoded = verifyToken(token);
    if (!decoded?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const {
      companyName,
      entityType,
      jurisdiction,
      taxIdLast4,
      serviceTier,
      primaryContact,
      contactEmail,
      phone,
    } = body ?? {};

    if (
      typeof companyName !== "string" ||
      !companyName.trim() ||
      typeof entityType !== "string" ||
      !entityType.trim() ||
      typeof jurisdiction !== "string" ||
      !jurisdiction.trim() ||
      typeof serviceTier !== "string" ||
      !serviceTier.trim() ||
      !isLast4(taxIdLast4)
    ) {
      return NextResponse.json(
        { error: "Missing/invalid fields (taxIdLast4 must be 4 digits)" },
        { status: 400 }
      );
    }

    const db = await getDb();
    const existing = await db
      .select()
      .from(entityOnboardings)
      .where(eq(entityOnboardings.userId, decoded.userId))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(entityOnboardings).values({
        userId: decoded.userId,
        companyName: companyName.trim(),
        entityType: entityType.trim(),
        jurisdiction: jurisdiction.trim(),
        taxIdLast4,
        serviceTier: serviceTier.trim(),
        primaryContact: typeof primaryContact === "string" ? primaryContact.trim() : null,
        contactEmail: typeof contactEmail === "string" ? contactEmail.trim() : null,
        phone: typeof phone === "string" ? phone.trim() : null,
        onboardingStatus: "submitted",
      });
    } else {
      const row = existing[0];
      if (row.isRevoked) {
        return NextResponse.json({ error: "Onboarding has been revoked" }, { status: 403 });
      }
      await db
        .update(entityOnboardings)
        .set({
          companyName: companyName.trim(),
          entityType: entityType.trim(),
          jurisdiction: jurisdiction.trim(),
          taxIdLast4,
          serviceTier: serviceTier.trim(),
          primaryContact: typeof primaryContact === "string" ? primaryContact.trim() : null,
          contactEmail: typeof contactEmail === "string" ? contactEmail.trim() : null,
          phone: typeof phone === "string" ? phone.trim() : null,
          onboardingStatus: "submitted",
        })
        .where(eq(entityOnboardings.id, row.id));
    }

    const rows = await db
      .select()
      .from(entityOnboardings)
      .where(eq(entityOnboardings.userId, decoded.userId))
      .limit(1);

    return NextResponse.json({ onboarding: rows[0] || null });
  } catch (error) {
    console.error("Onboarding submit error:", error);
    return NextResponse.json({ error: "Failed to submit onboarding" }, { status: 500 });
  }
}


