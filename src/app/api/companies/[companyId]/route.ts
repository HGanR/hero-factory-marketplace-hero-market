// Individual Company API - Update and get company with ownership isolation
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/lib/db";
import { companies } from "@/lib/db/schema";
import { verifyToken } from "@/lib/auth";

async function getAuthedUserId(): Promise<number | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth-token")?.value ?? null;
  if (!token) return null;
  const payload = verifyToken(token);
  const userId = payload?.userId;
  return typeof userId === "number" ? userId : null;
}

const UpdateCompanySchema = z.object({
  companyName: z.string().min(1).max(255).optional(),
  formationState: z.string().length(2).optional(),
  companyKind: z.enum(["parent_holding_company", "operating_company"]).optional(),
  corpType: z.enum(["c_corp", "s_corp", "llc", "unknown"]).optional(),
  parentStructure: z.enum(["single_parent_single_sub", "single_parent_multi_sub", "parent_only", "unknown"]).optional(),

  // Formation details
  registeredAgentPlanned: z.boolean().optional(),
  authorizedShares: z.number().int().min(0).optional(),
  parValue: z.number().min(0).optional(),
  fiscalYearEndMonth: z.number().int().min(1).max(12).optional(),

  // Governance
  boardSize: z.number().int().min(1).optional(),
  officersPlanned: z.boolean().optional(),
  initialBoardConsentPlanned: z.boolean().optional(),

  // Draft and status
  draftJson: z.string().optional(),
  status: z.enum(["draft", "counsel_reviewed", "board_adopted", "execution_ready"]).optional(),
}).partial();

export async function GET(request: NextRequest, ctx: { params: Promise<{ companyId: string }> }) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { companyId } = await ctx.params;
  if (!companyId) return NextResponse.json({ error: "Missing companyId" }, { status: 400 });

  const db = await getDb();

  // Enforce ownership: company must belong to authenticated user
  const companyRows = await db
    .select()
    .from(companies)
    .where(and(eq(companies.id, companyId), eq(companies.userId, userId)))
    .limit(1);

  if (companyRows.length === 0) {
    return NextResponse.json({ error: "Company not found or access denied" }, { status: 404 });
  }

  return NextResponse.json({ company: companyRows[0] });
}

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ companyId: string }> }) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { companyId } = await ctx.params;
  if (!companyId) return NextResponse.json({ error: "Missing companyId" }, { status: 400 });

  let body: z.infer<typeof UpdateCompanySchema>;
  try {
    body = UpdateCompanySchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Invalid body" }, { status: 400 });
  }

  const db = await getDb();

  // Verify ownership before update
  const existingCompany = await db
    .select()
    .from(companies)
    .where(and(eq(companies.id, companyId), eq(companies.userId, userId)))
    .limit(1);

  if (existingCompany.length === 0) {
    return NextResponse.json({ error: "Company not found or access denied" }, { status: 404 });
  }

  // Update the company - convert types as needed
  const updateData: any = { ...body, updatedAt: new Date() };

  // Convert numeric fields to strings for decimal columns
  if (updateData.parValue !== undefined) {
    updateData.parValue = updateData.parValue?.toString();
  }

  await db.update(companies)
    .set(updateData)
    .where(and(eq(companies.id, companyId), eq(companies.userId, userId)));

  return NextResponse.json({ message: "Company updated successfully" });
}

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ companyId: string }> }) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { companyId } = await ctx.params;
  if (!companyId) return NextResponse.json({ error: "Missing companyId" }, { status: 400 });

  const db = await getDb();

  // Verify ownership before deletion
  const existingCompany = await db
    .select()
    .from(companies)
    .where(and(eq(companies.id, companyId), eq(companies.userId, userId)))
    .limit(1);

  if (existingCompany.length === 0) {
    return NextResponse.json({ error: "Company not found or access denied" }, { status: 404 });
  }

  // Delete the company (this will cascade to affiliations due to FK constraints)
  await db.delete(companies)
    .where(and(eq(companies.id, companyId), eq(companies.userId, userId)));

  return NextResponse.json({ message: "Company deleted successfully" });
}
