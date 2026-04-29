import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { and, eq, desc } from "drizzle-orm";
import { z } from "zod";
import crypto from "crypto";

import { getDb } from "@/lib/db";
import { workflowPresentationPackages, trusts } from "@/lib/db/schema";
import { verifyToken } from "@/lib/auth";
import { allocatePackageNumber } from "@/lib/sequences";
import { requiresTrustProtectorApproval } from "@/lib/governance";

async function getAuthedUserId(): Promise<number | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth-token")?.value ?? null;
  if (!token) return null;
  const payload = verifyToken(token);
  const userId = payload?.userId;
  return typeof userId === "number" ? userId : null;
}

const CreatePackageSchema = z.object({
  includedJson: z.any(),
  offeringId: z.string().uuid().optional(),
});

export async function GET(request: NextRequest, ctx: { params: Promise<{ trustId: string }> }) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { trustId } = await ctx.params;
  if (!trustId || trustId.length < 10) return NextResponse.json({ error: "Invalid trustId" }, { status: 400 });

  const db = await getDb();

  // Verify trust ownership
  const trustRows = await db.select().from(trusts).where(and(eq(trusts.id, trustId), eq(trusts.userId, userId))).limit(1);
  if (trustRows.length === 0) return NextResponse.json({ error: "Trust not found" }, { status: 404 });

  // Get packages for this trust
  const packages = await db
    .select()
    .from(workflowPresentationPackages)
    .where(eq(workflowPresentationPackages.trustId, trustId))
    .orderBy(desc(workflowPresentationPackages.createdAt));

  return NextResponse.json({
    trustId,
    packages: packages.map(pkg => ({
      id: pkg.id,
      trustId: pkg.trustId,
      packageNumber: pkg.packageNumber,
      status: pkg.status,
      includedJson: JSON.parse(pkg.includedJson),
      pitchDeckTrustDocumentId: pkg.pitchDeckTrustDocumentId,
      offeringId: pkg.offeringId,
      createdAt: pkg.createdAt?.toISOString(),
      updatedAt: pkg.updatedAt?.toISOString(),
    }))
  });
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ trustId: string }> }) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { trustId } = await ctx.params;
  if (!trustId || trustId.length < 10) return NextResponse.json({ error: "Invalid trustId" }, { status: 400 });

  let body: z.infer<typeof CreatePackageSchema>;
  try {
    body = CreatePackageSchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Invalid body" }, { status: 400 });
  }

  const db = await getDb();

  // Verify trust ownership
  const trustRows = await db.select().from(trusts).where(and(eq(trusts.id, trustId), eq(trusts.userId, userId))).limit(1);
  if (trustRows.length === 0) return NextResponse.json({ error: "Trust not found" }, { status: 404 });

  // Check if package creation requires Trust Protector approval
  // This is a simplified check - in practice, you'd analyze the package contents
  const protectorCheck = await requiresTrustProtectorApproval("trust", trustId, "package_ready_for_review");
  if (protectorCheck.required) {
    return NextResponse.json({
      error: "Package creation requires Trust Protector approval",
      protectors: protectorCheck.protectors,
      action: "package_ready_for_review"
    }, { status: 403 });
  }

  // Generate package number
  const year = new Date().getFullYear();
  const packageNumber = await allocatePackageNumber(trustId, year);

  // Create package
  const packageId = crypto.randomUUID();

  const result = await db.insert(workflowPresentationPackages).values({
    id: packageId,
    trustId,
    packageNumber,
    status: "draft",
    includedJson: JSON.stringify(body.includedJson),
    offeringId: body.offeringId,
  });

  return NextResponse.json({
    package: {
      id: packageId,
      trustId,
      packageNumber,
      status: "draft",
      includedJson: body.includedJson,
      offeringId: body.offeringId,
      createdAt: new Date().toISOString(),
    }
  }, { status: 201 });
}
