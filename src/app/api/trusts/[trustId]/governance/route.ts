import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { and, eq, desc } from "drizzle-orm";
import { z } from "zod";
import crypto from "crypto";

import { getDb } from "@/lib/db";
import { governanceAssignments, trusts, workflowClientProfiles } from "@/lib/db/schema";
import { verifyToken } from "@/lib/auth";

async function getAuthedUserId(): Promise<number | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth-token")?.value ?? null;
  if (!token) return null;
  const payload = verifyToken(token);
  const userId = payload?.userId;
  return typeof userId === "number" ? userId : null;
}

const CreateGovernanceAssignmentSchema = z.object({
  role: z.enum(["trustee", "trust_protector", "committee_member", "counsel_reviewer"]),
  clientProfileId: z.string().uuid(),
  powersJson: z.any(), // JSON object of granted powers
  triggersJson: z.any().optional(), // JSON object of activation conditions
});

const TrustProtectorPowersSchema = z.object({
  remove_replace_trustee: z.boolean().optional(),
  approve_trustee_resignation: z.boolean().optional(),
  resolve_ambiguities: z.boolean().optional(),
  approve_situs_change: z.boolean().optional(),
  approve_decanting: z.boolean().optional(),
  consent_administrative_amendments: z.boolean().optional(),
  veto_extraordinary_transactions: z.boolean().optional(),
});

const TrustProtectorTriggersSchema = z.object({
  activationMode: z.enum(["immediate", "upon_incapacity", "upon_death", "upon_irrevocable_conversion", "custom"]),
  customTriggerDescription: z.string().optional(),
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

  // Get governance assignments for this trust
  const assignments = await db
    .select({
      assignment: governanceAssignments,
      clientProfile: {
        id: workflowClientProfiles.id,
        publicId: workflowClientProfiles.publicId,
        fullName: workflowClientProfiles.fullName,
        email: workflowClientProfiles.email,
      },
    })
    .from(governanceAssignments)
    .leftJoin(workflowClientProfiles, eq(governanceAssignments.clientProfileId, workflowClientProfiles.id))
    .where(and(
      eq(governanceAssignments.entityType, "trust"),
      eq(governanceAssignments.entityId, trustId)
    ))
    .orderBy(desc(governanceAssignments.createdAt));

  return NextResponse.json({
    trustId,
    assignments: assignments.map(row => ({
      id: row.assignment.id,
      entityType: row.assignment.entityType,
      entityId: row.assignment.entityId,
      clientProfileId: row.assignment.clientProfileId,
      role: row.assignment.role,
      powersJson: JSON.parse(row.assignment.powersJson),
      triggersJson: row.assignment.triggersJson ? JSON.parse(row.assignment.triggersJson) : null,
      status: row.assignment.status,
      assignedBy: row.assignment.assignedBy,
      assignedAt: row.assignment.assignedAt?.toISOString(),
      activatedAt: row.assignment.activatedAt?.toISOString(),
      clientProfile: row.clientProfile,
    }))
  });
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ trustId: string }> }) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { trustId } = await ctx.params;
  if (!trustId || trustId.length < 10) return NextResponse.json({ error: "Invalid trustId" }, { status: 400 });

  let body: z.infer<typeof CreateGovernanceAssignmentSchema>;
  try {
    body = CreateGovernanceAssignmentSchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Invalid body" }, { status: 400 });
  }

  const db = await getDb();

  // Verify trust ownership
  const trustRows = await db.select().from(trusts).where(and(eq(trusts.id, trustId), eq(trusts.userId, userId))).limit(1);
  if (trustRows.length === 0) return NextResponse.json({ error: "Trust not found" }, { status: 404 });

  // Verify client profile exists and belongs to user
  const clientRows = await db
    .select()
    .from(workflowClientProfiles)
    .where(and(eq(workflowClientProfiles.id, body.clientProfileId), eq(workflowClientProfiles.userId, userId)))
    .limit(1);

  if (clientRows.length === 0) return NextResponse.json({ error: "Client profile not found or does not belong to you" }, { status: 404 });

  // Validate powers based on role
  if (body.role === "trust_protector") {
    try {
      TrustProtectorPowersSchema.parse(body.powersJson);
    } catch (err) {
      return NextResponse.json({ error: "Invalid trust protector powers format" }, { status: 400 });
    }

    // Validate triggers for trust protector
    if (body.triggersJson) {
      try {
        TrustProtectorTriggersSchema.parse(body.triggersJson);
      } catch (err) {
        return NextResponse.json({ error: "Invalid trust protector triggers format" }, { status: 400 });
      }
    }
  }

  // Create governance assignment
  const assignmentId = crypto.randomUUID();

  await db.insert(governanceAssignments).values({
    id: assignmentId,
    entityType: "trust",
    entityId: trustId,
    clientProfileId: body.clientProfileId,
    role: body.role,
    powersJson: JSON.stringify(body.powersJson),
    triggersJson: body.triggersJson ? JSON.stringify(body.triggersJson) : null,
    status: "active",
    assignedBy: userId,
  });

  return NextResponse.json({
    assignment: {
      id: assignmentId,
      entityType: "trust",
      entityId: trustId,
      clientProfileId: body.clientProfileId,
      role: body.role,
      powersJson: body.powersJson,
      triggersJson: body.triggersJson,
      status: "active",
      assignedBy: userId,
      assignedAt: new Date().toISOString(),
    }
  }, { status: 201 });
}
