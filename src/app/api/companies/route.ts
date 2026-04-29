// Companies API - Create and list companies with ownership isolation
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/lib/db";
import { companies } from "@/lib/db/schema";
import { verifyToken } from "@/lib/auth";
import { allocateCompanyId } from "@/lib/company-sequences";

async function getAuthedUserId(): Promise<number | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth-token")?.value ?? null;
  if (!token) return null;
  const payload = verifyToken(token);
  const userId = payload?.userId;
  return typeof userId === "number" ? userId : null;
}

const CreateCompanySchema = z.object({
  companyName: z.string().min(1).max(255),
  formationState: z.string().length(2),
  companyKind: z.enum(["parent_holding_company", "operating_company"]),
  corpType: z.enum(["c_corp", "s_corp", "llc", "unknown"]),
  parentStructure: z.enum(["single_parent_single_sub", "single_parent_multi_sub", "parent_only", "unknown"]),
  draftJson: z.string().optional(), // JSON string of ParentCorpDraft
});

export async function GET(request: NextRequest) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = await getDb();

  // Only return companies owned by the authenticated user
  const userCompanies = await db
    .select({
      id: companies.id,
      companyName: companies.companyName,
      formationState: companies.formationState,
      companyKind: companies.companyKind,
      corpType: companies.corpType,
      parentStructure: companies.parentStructure,
      publicCompanyId: companies.publicCompanyId,
      status: companies.status,
      createdAt: companies.createdAt,
      updatedAt: companies.updatedAt,
    })
    .from(companies)
    .where(eq(companies.userId, userId))
    .orderBy(companies.createdAt);

  return NextResponse.json({ companies: userCompanies });
}

export async function POST(request: NextRequest) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: z.infer<typeof CreateCompanySchema>;
  try {
    body = CreateCompanySchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Invalid body" }, { status: 400 });
  }

  const db = await getDb();

  // Generate public company ID using thread-safe sequence
  const publicCompanyId = await allocateCompanyId(body.formationState);

  const companyId = crypto.randomUUID();

  await db.insert(companies).values({
    id: companyId,
    userId, // Enforce ownership
    companyName: body.companyName,
    formationState: body.formationState,
    companyKind: body.companyKind,
    corpType: body.corpType,
    parentStructure: body.parentStructure,
    publicCompanyId,
    draftJson: body.draftJson,
  });

  return NextResponse.json({
    company: {
      id: companyId,
      companyName: body.companyName,
      publicCompanyId,
      status: "draft",
    }
  }, { status: 201 });
}
