/**
 * Trust Brokerage Accounts API
 * GET: List brokerage accounts for a trust
 * POST: Create a brokerage account
 */
import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { trusts, trustBrokerageAccounts } from "@/lib/db/schema";
import { getAuthedUserId } from "@/lib/api/auth";
import { v4 as uuidv4 } from "uuid";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ trustId: string }> }
) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { trustId } = await ctx.params;
  if (!trustId) return NextResponse.json({ error: "Invalid trustId" }, { status: 400 });

  const db = await getDb();
  const trustRows = await db
    .select()
    .from(trusts)
    .where(and(eq(trusts.id, trustId), eq(trusts.userId, userId)))
    .limit(1);
  if (trustRows.length === 0) return NextResponse.json({ error: "Trust not found" }, { status: 404 });

  const accounts = await db
    .select()
    .from(trustBrokerageAccounts)
    .where(eq(trustBrokerageAccounts.trustId, trustId));

  return NextResponse.json({
    trustId,
    accounts: accounts.map((a) => ({
      id: a.id,
      trustId: a.trustId,
      institution: a.institution,
      accountNumber: a.accountNumber,
      accountType: a.accountType,
      authorizedBroker: a.authorizedBroker,
      createdAt: a.createdAt?.toISOString(),
    })),
  });
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ trustId: string }> }
) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { trustId } = await ctx.params;
  if (!trustId) return NextResponse.json({ error: "Invalid trustId" }, { status: 400 });

  let body: { institution?: string; accountNumber?: string; accountType?: string; authorizedBroker?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const db = await getDb();
  const trustRows = await db
    .select()
    .from(trusts)
    .where(and(eq(trusts.id, trustId), eq(trusts.userId, userId)))
    .limit(1);
  if (trustRows.length === 0) return NextResponse.json({ error: "Trust not found" }, { status: 404 });

  const id = uuidv4();
  await db.insert(trustBrokerageAccounts).values({
    id,
    trustId,
    institution: body.institution ?? null,
    accountNumber: body.accountNumber ?? null,
    accountType: body.accountType ?? null,
    authorizedBroker: body.authorizedBroker ?? null,
  });

  return NextResponse.json(
    {
      id,
      trustId,
      institution: body.institution,
      accountNumber: body.accountNumber,
      accountType: body.accountType,
      authorizedBroker: body.authorizedBroker,
      createdAt: new Date().toISOString(),
    },
    { status: 201 }
  );
}
