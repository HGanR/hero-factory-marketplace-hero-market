import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { trustRecordRoles, trusts, clients, marketplaceUsers } from "@/lib/db/schema";
import { verifyToken } from "@/lib/auth";

async function getAuthedUserId(): Promise<number | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth-token")?.value ?? null;
  if (!token) return null;
  const payload = verifyToken(token);
  const userId = payload?.userId;
  return typeof userId === "number" ? userId : null;
}

const SetActiveTrustContextRequestSchema = z.object({
  trustId: z.string().optional(),
  trustPublicId: z.string().optional(),
  clientId: z.string().optional(),
  clientPublicId: z.string().optional(),
  entityId: z.string().optional(),
  entityPublicId: z.string().optional(),
  source: z.enum(["trust-records", "smart-trust", "ecclesiastical", "dashboard", "issue-securities", "deep-link"]).optional(),
}).refine(
  (data) => data.trustId || data.trustPublicId,
  { message: "trustId or trustPublicId is required" }
);

export async function POST(request: NextRequest) {
  const userId = await getAuthedUserId();
  if (!userId) {
    return NextResponse.json({
      ok: false,
      error: { code: "UNAUTHENTICATED", message: "Sign in required" }
    }, { status: 401 });
  }

  let body: z.infer<typeof SetActiveTrustContextRequestSchema>;
  try {
    body = SetActiveTrustContextRequestSchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json({
      ok: false,
      error: { code: "INVALID_INPUT", message: err instanceof Error ? err.message : "Invalid request body" }
    }, { status: 400 });
  }

  const db = await getDb();

  try {
    // Resolve trust by trustId or trustPublicId
    let trustRows;
    if (body.trustId) {
      trustRows = await db
        .select({
          id: trusts.id,
          publicId: trusts.publicId,
          clientId: trusts.clientId,
          name: trusts.name,
          trustType: trusts.trustType,
          userId: trusts.userId,
        })
        .from(trusts)
        .where(eq(trusts.id, body.trustId))
        .limit(1);
    } else if (body.trustPublicId) {
      trustRows = await db
        .select({
          id: trusts.id,
          publicId: trusts.publicId,
          clientId: trusts.clientId,
          name: trusts.name,
          trustType: trusts.trustType,
          userId: trusts.userId,
        })
        .from(trusts)
        .where(eq(trusts.publicId, body.trustPublicId))
        .limit(1);
    }

    const trust = trustRows?.[0];

    if (!trust) {
      return NextResponse.json({
        ok: false,
        error: { code: "TRUST_NOT_FOUND", message: "Trust not found" }
      }, { status: 404 });
    }

    // Verify user has access to this trust
    if (trust.userId !== userId) {
      return NextResponse.json({
        ok: false,
        error: { code: "FORBIDDEN", message: "No access to this trust" }
      }, { status: 403 });
    }

    // Validate client/entity if provided
    if (body.clientId && trust.clientId !== body.clientId) {
      return NextResponse.json({
        ok: false,
        error: { code: "CONTEXT_MISMATCH", message: "Provided client does not match trust" }
      }, { status: 409 });
    }

    // Get client info
    let clientInfo = null;
    if (trust.clientId) {
      const clientRows = await db
        .select()
        .from(clients)
        .where(eq(clients.id, trust.clientId))
        .limit(1);
      if (clientRows[0]) {
        const clientPublicId = `CID-2026-${String(clientRows[0].id).slice(-4).toUpperCase()}`;
        clientInfo = {
          clientId: clientRows[0].id,
          clientPublicId,
        };
      }
    }

    // Get user role
    const roleRows = await db.select().from(trustRecordRoles).where(eq(trustRecordRoles.userId, userId)).limit(1);
    const role = (roleRows[0]?.role ?? "Manager") as "grantor" | "trustee" | "admin" | "counsel" | "viewer" | "unknown";

    await db
      .update(marketplaceUsers)
      .set({ lastActiveTrustId: trust.id })
      .where(eq(marketplaceUsers.id, userId));

    // Optional recency signal for lists / legacy consumers; not the source of truth for active trust.
    await db.update(trusts).set({ updatedAt: new Date() }).where(eq(trusts.id, trust.id));

    return NextResponse.json({
      ok: true,
      active: {
        clientId: clientInfo?.clientId ?? null,
        clientPublicId: clientInfo?.clientPublicId ?? null,
        entityId: null, // Not implemented yet
        entityPublicId: trust.publicId ?? null,
        trustId: trust.id,
        trustPublicId: trust.publicId,
        role,
      },
      meta: {
        source: body.source || "trust-records",
        updatedAt: new Date().toISOString(),
      },
    });

  } catch (error) {
    console.error("Set active trust context error:", error);
    return NextResponse.json({
      ok: false,
      error: { code: "INTERNAL", message: "Failed to set active trust context" }
    }, { status: 500 });
  }
}
