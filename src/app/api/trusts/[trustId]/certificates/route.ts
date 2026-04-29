import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import crypto from "crypto";

import { getDb } from "@/lib/db";
import { workflowAssetCertificates, workflowTrustAssets, trusts, trustDocuments } from "@/lib/db/schema";
import { verifyToken } from "@/lib/auth";
import { allocateCertificateNumber } from "@/lib/sequences";

async function getAuthedUserId(): Promise<number | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth-token")?.value ?? null;
  if (!token) return null;
  const payload = verifyToken(token);
  const userId = payload?.userId;
  return typeof userId === "number" ? userId : null;
}

const CreateCertificateSchema = z.object({
  assetId: z.string().uuid(),
  certificateClass: z.string().default("Unit"),
  units: z.number().int().min(1).default(1),
  restrictionsJson: z.any().optional(),
});

export async function POST(request: NextRequest, ctx: { params: Promise<{ trustId: string }> }) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { trustId } = await ctx.params;
  if (!trustId || trustId.length < 10) return NextResponse.json({ error: "Invalid trustId" }, { status: 400 });

  let body: z.infer<typeof CreateCertificateSchema>;
  try {
    body = CreateCertificateSchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Invalid body" }, { status: 400 });
  }

  const db = await getDb();

  // Verify trust ownership
  const trustRows = await db.select().from(trusts).where(and(eq(trusts.id, trustId), eq(trusts.userId, userId))).limit(1);
  if (trustRows.length === 0) return NextResponse.json({ error: "Trust not found" }, { status: 404 });

  const trust = trustRows[0];

  // Verify asset exists and belongs to this trust
  const assetRows = await db
    .select()
    .from(workflowTrustAssets)
    .where(and(eq(workflowTrustAssets.id, body.assetId), eq(workflowTrustAssets.trustId, trustId)))
    .limit(1);

  if (assetRows.length === 0) return NextResponse.json({ error: "Asset not found or does not belong to this trust" }, { status: 404 });

  const asset = assetRows[0];

  // TODO: Check authority status when authorityStatus and authorityJson fields are added to trusts table
  // const authorityStatus = trust.authorityStatus;
  // if (authorityStatus !== "confirmed") {
  //   return NextResponse.json({ error: "Trust authority must be confirmed before issuing certificates" }, { status: 403 });
  // }

  // Generate certificate number
  const year = new Date().getFullYear();
  const certificateNumber = await allocateCertificateNumber(trustId, year);

  // Create certificate
  const certificateId = crypto.randomUUID();

  // Create trust document for the certificate
  const docId = crypto.randomUUID();
  await db.insert(trustDocuments).values({
    id: docId,
    trustId,
    docType: "AssetCertificate",
    title: `Asset Certificate ${certificateNumber}`,
    version: 1,
    classification: "private",
    disclosureState: "not_shared",
    proofState: "not_hashed",
    contentJson: JSON.stringify({
      certificateId,
      certificateNumber,
      assetId: body.assetId,
      assetName: asset.name,
      certificateClass: body.certificateClass,
      units: body.units,
      restrictions: body.restrictionsJson,
    }),
  });

  // Create certificate record
  await db.insert(workflowAssetCertificates).values({
    id: certificateId,
    trustId,
    assetId: body.assetId,
    certificateNumber,
    certificateClass: body.certificateClass,
    units: body.units,
    restrictionsJson: body.restrictionsJson ? JSON.stringify(body.restrictionsJson) : null,
    trustDocumentId: docId,
  });

  // Update asset status to certificated
  await db
    .update(workflowTrustAssets)
    .set({ status: "certificated" })
    .where(eq(workflowTrustAssets.id, body.assetId));

  return NextResponse.json({
    certificate: {
      id: certificateId,
      trustId,
      assetId: body.assetId,
      certificateNumber,
      certificateClass: body.certificateClass,
      units: body.units,
      restrictionsJson: body.restrictionsJson,
      trustDocumentId: docId,
      createdAt: new Date().toISOString(),
    }
  }, { status: 201 });
}
