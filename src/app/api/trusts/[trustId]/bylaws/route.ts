import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { and, eq, desc } from "drizzle-orm";
import crypto from "crypto";

import { getDb } from "@/lib/db";
import { trusts, trustDocuments } from "@/lib/db/schema";
import { verifyToken } from "@/lib/auth";
import { BylawsDraft } from "@/lib/bylaws/wizard-config";
import { validateBylawsDraft } from "@/lib/bylaws/validator";

async function getAuthedUserId(): Promise<number | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth-token")?.value ?? null;
  if (!token) return null;
  const payload = verifyToken(token);
  const userId = payload?.userId;
  return typeof userId === "number" ? userId : null;
}

// Generate bylaws document content
function generateBylawsDocument(bylawsDraft: BylawsDraft): string {
  const clauses = Object.entries(bylawsDraft.clauses)
    .filter(([_, clauseData]) => clauseData.enabled && clauseData.content?.trim())
    .map(([clauseId, clauseData]) => {
      const title = clauseId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      return `## ${title}\n\n${clauseData.content}\n\n`;
    })
    .join('');

  return `# Bylaws of ${bylawsDraft.entityType.replace('_', ' ').toUpperCase()}

**State of Formation:** ${bylawsDraft.state}
**Entity Form:** ${bylawsDraft.entityForm.replace('_', ' ').toUpperCase()}
**Generated:** ${new Date().toLocaleDateString()}

## Article I - Name and Purpose

${bylawsDraft.clauses['name-purpose']?.content || 'To be defined'}

## Article II - Membership

${bylawsDraft.clauses['members']?.content || 'Membership provisions to be defined'}

## Article III - Board of Directors

**Number of Directors:** ${bylawsDraft.directorCount}

${bylawsDraft.clauses['board-composition']?.content || 'Board composition to be defined'}

## Article IV - Officers

${bylawsDraft.clauses['officer-roles']?.content || 'Officer roles to be defined'}

## Article V - Meetings and Voting

**Quorum Requirement:** ${bylawsDraft.quorumPercentage}%
**Notice Period:** ${bylawsDraft.noticeDays} days

${bylawsDraft.clauses['meetings-quorum']?.content || 'Meeting provisions to be defined'}

## Article VI - Committees

${bylawsDraft.clauses['committees']?.content || 'Committee provisions to be defined'}

## Article VII - Conflicts of Interest

${bylawsDraft.clauses['conflicts-interest']?.content || 'Conflict of interest policy to be defined'}

## Article VIII - Indemnification

${bylawsDraft.clauses['indemnification']?.content || 'Indemnification provisions to be defined'}

## Article IX - Amendment Procedure

${bylawsDraft.clauses['amendment-procedure']?.content || 'Amendment procedure to be defined'}

## Article X - Dissolution

${bylawsDraft.clauses['dissolution']?.content || 'Dissolution provisions to be defined'}

---

*These bylaws were generated using state-specific legal requirements and should be reviewed by qualified legal counsel before adoption.*
`;
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ trustId: string }> }) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { trustId } = await ctx.params;
  if (!trustId || trustId.length < 10) return NextResponse.json({ error: "Invalid trustId" }, { status: 400 });

  let bylawsDraft: BylawsDraft;
  try {
    bylawsDraft = await request.json();
  } catch (err) {
    return NextResponse.json({ error: "Invalid bylaws data" }, { status: 400 });
  }

  const db = await getDb();

  // Verify trust ownership
  const trustRows = await db.select().from(trusts).where(and(eq(trusts.id, trustId), eq(trusts.userId, userId))).limit(1);
  if (trustRows.length === 0) return NextResponse.json({ error: "Trust not found" }, { status: 404 });

  // Validate bylaws against rules
  const validation = validateBylawsDraft(bylawsDraft);
  if (!validation.isValid) {
    return NextResponse.json({
      error: "Bylaws validation failed",
      validation: validation
    }, { status: 400 });
  }

  // Generate bylaws document content
  const bylawsContent = generateBylawsDocument(bylawsDraft);

  // Check if bylaws document already exists for this trust
  const existingDocs = await db
    .select()
    .from(trustDocuments)
    .where(and(
      eq(trustDocuments.trustId, trustId),
      eq(trustDocuments.docType, "Bylaws")
    ))
    .orderBy(desc(trustDocuments.version))
    .limit(1);

  const nextVersion = existingDocs.length > 0 ? existingDocs[0].version + 1 : 1;

  // Create new bylaws document
  const documentId = crypto.randomUUID();

  await db.insert(trustDocuments).values({
    id: documentId,
    trustId,
    docType: "Bylaws",
    title: `Bylaws - ${bylawsDraft.entityType} (${bylawsDraft.state})`,
    version: nextVersion,
    classification: "private",
    disclosureState: "not_shared",
    proofState: "not_hashed",
    contentJson: JSON.stringify({
      bylawsDraft,
      validation,
      generatedAt: new Date().toISOString(),
      generator: "bylaws-wizard"
    }),
  });

  return NextResponse.json({
    documentId,
    version: nextVersion,
    validation,
    message: "Bylaws saved successfully as trust document"
  }, { status: 201 });
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ trustId: string }> }) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { trustId } = await ctx.params;
  if (!trustId || trustId.length < 10) return NextResponse.json({ error: "Invalid trustId" }, { status: 400 });

  const db = await getDb();

  // Verify trust ownership
  const trustRows = await db.select().from(trusts).where(and(eq(trusts.id, trustId), eq(trusts.userId, userId))).limit(1);
  if (trustRows.length === 0) return NextResponse.json({ error: "Trust not found" }, { status: 404 });

  // Get latest bylaws document
  const bylawsDocs = await db
    .select({
      id: trustDocuments.id,
      title: trustDocuments.title,
      version: trustDocuments.version,
      createdAt: trustDocuments.createdAt,
      contentJson: trustDocuments.contentJson
    })
    .from(trustDocuments)
    .where(and(
      eq(trustDocuments.trustId, trustId),
      eq(trustDocuments.docType, "Bylaws")
    ))
    .orderBy(desc(trustDocuments.version))
    .limit(1);

  if (bylawsDocs.length === 0) {
    return NextResponse.json({ bylaws: null, message: "No bylaws found for this trust" });
  }

  const bylawsDoc = bylawsDocs[0];
  const bylawsData = JSON.parse(bylawsDoc.contentJson || '{}');

  return NextResponse.json({
    documentId: bylawsDoc.id,
    version: bylawsDoc.version,
    createdAt: bylawsDoc.createdAt,
    bylawsDraft: bylawsData.bylawsDraft,
    validation: bylawsData.validation
  });
}
