import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getDb } from "@/lib/db";
import {
  aiAgents,
  aiAgentCollaborators,
  marketplaceUsers,
} from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { requireUserId } from "@/lib/auth";

/** List collaborators for an agent. Caller must be owner or collaborator. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = requireUserId(req);
    const { id: agentId } = await params;

    const db = await getDb();

    const [agent] = await db
      .select({ id: aiAgents.id, userId: aiAgents.userId })
      .from(aiAgents)
      .where(eq(aiAgents.id, agentId))
      .limit(1);

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const [collab] = await db
      .select()
      .from(aiAgentCollaborators)
      .where(
        and(
          eq(aiAgentCollaborators.agentId, agentId),
          eq(aiAgentCollaborators.userId, userId)
        )
      )
      .limit(1);

    const isOwner = agent.userId === userId;
    const isCollaborator = !!collab;

    if (!isOwner && !isCollaborator) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const rows = await db
      .select({
        collaboratorId: aiAgentCollaborators.id,
        userId: aiAgentCollaborators.userId,
        invitedByUserId: aiAgentCollaborators.invitedByUserId,
        status: aiAgentCollaborators.status,
        createdAt: aiAgentCollaborators.createdAt,
        email: marketplaceUsers.email,
        username: marketplaceUsers.username,
      })
      .from(aiAgentCollaborators)
      .innerJoin(marketplaceUsers, eq(marketplaceUsers.id, aiAgentCollaborators.userId))
      .where(eq(aiAgentCollaborators.agentId, agentId));

    const collaborators = rows.map((r) => ({
      id: r.collaboratorId,
      userId: r.userId,
      invitedByUserId: r.invitedByUserId,
      status: r.status,
      createdAt: r.createdAt,
      email: r.email,
      username: r.username,
    }));

    return NextResponse.json({ collaborators });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "Unauthorized") return NextResponse.json({ error: msg }, { status: 401 });
    console.error("collaborators GET error:", err);
    return NextResponse.json({ error: "Failed to list collaborators" }, { status: 500 });
  }
}

/** Invite a user by email. Caller must be agent owner or collaborator. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = requireUserId(req);
    const { id: agentId } = await params;
    const body = await req.json().catch(() => ({}));
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { error: "Valid email is required" },
        { status: 400 }
      );
    }

    const db = await getDb();

    const [agent] = await db
      .select({ id: aiAgents.id, userId: aiAgents.userId })
      .from(aiAgents)
      .where(eq(aiAgents.id, agentId))
      .limit(1);

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const [existingCollab] = await db
      .select()
      .from(aiAgentCollaborators)
      .where(
        and(
          eq(aiAgentCollaborators.agentId, agentId),
          eq(aiAgentCollaborators.userId, userId)
        )
      )
      .limit(1);

    const isOwner = agent.userId === userId;
    const isCollaborator = !!existingCollab;

    if (!isOwner && !isCollaborator) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const [targetUser] = await db
      .select({ id: marketplaceUsers.id, email: marketplaceUsers.email })
      .from(marketplaceUsers)
      .where(eq(marketplaceUsers.email, email))
      .limit(1);

    if (!targetUser) {
      return NextResponse.json(
        { error: "No approved user found with that email. User must be registered and approved." },
        { status: 404 }
      );
    }

    const [approvedCheck] = await db
      .select({ isApproved: marketplaceUsers.isApproved, isActive: marketplaceUsers.isActive })
      .from(marketplaceUsers)
      .where(eq(marketplaceUsers.id, targetUser.id))
      .limit(1);

    if (!approvedCheck?.isApproved || !approvedCheck?.isActive) {
      return NextResponse.json(
        { error: "That user is not approved or active. Only approved accounts can be invited." },
        { status: 400 }
      );
    }

    if (targetUser.id === agent.userId) {
      return NextResponse.json(
        { error: "Owner is already on this agent." },
        { status: 400 }
      );
    }

    const [alreadyInvited] = await db
      .select()
      .from(aiAgentCollaborators)
      .where(
        and(
          eq(aiAgentCollaborators.agentId, agentId),
          eq(aiAgentCollaborators.userId, targetUser.id)
        )
      )
      .limit(1);

    if (alreadyInvited) {
      return NextResponse.json(
        { error: "User is already a collaborator on this agent." },
        { status: 400 }
      );
    }

    const id = crypto.randomUUID();
    await db.insert(aiAgentCollaborators).values({
      id,
      agentId,
      userId: targetUser.id,
      invitedByUserId: userId,
      status: "accepted",
    });

    return NextResponse.json({
      success: true,
      collaborator: {
        id,
        userId: targetUser.id,
        email: targetUser.email,
        status: "accepted",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "Unauthorized") return NextResponse.json({ error: msg }, { status: 401 });
    console.error("collaborators POST error:", err);
    return NextResponse.json({ error: "Failed to invite collaborator" }, { status: 500 });
  }
}
