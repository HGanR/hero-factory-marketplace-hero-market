import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/lib/db";
import { accessLogs, trusts } from "@/lib/db/schema";
import { verifyToken } from "@/lib/auth";

async function getAuthedUserId(): Promise<number | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth-token")?.value ?? null;
  if (!token) return null;
  const payload = verifyToken(token);
  const userId = payload?.userId;
  return typeof userId === "number" ? userId : null;
}

const ProofNetworkSchema = z.enum(["none", "metal_blockchain"]);
const ProofModeSchema = z.enum(["hash_only"]);

const PostSchema = z.object({
  network: ProofNetworkSchema,
  mode: ProofModeSchema.default("hash_only"),
});

function defaultSettings() {
  // Enterprise default posture: Metal Blockchain in hash-only mode.
  return { network: "metal_blockchain" as const, mode: "hash_only" as const };
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ trustId: string }> }) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { trustId } = await ctx.params;
  const db = await getDb();

  const trustRows = await db.select().from(trusts).where(and(eq(trusts.id, trustId), eq(trusts.userId, userId))).limit(1);
  if (trustRows.length === 0) return NextResponse.json({ error: "Trust not found" }, { status: 404 });

  const latest = await db
    .select()
    .from(accessLogs)
    .where(and(eq(accessLogs.trustId, trustId), eq(accessLogs.action, "proof_settings_updated")))
    .orderBy(desc(accessLogs.createdAt))
    .limit(1);

  let resolved: { network: "none" | "metal_blockchain"; mode: "hash_only" } = defaultSettings();
  if (latest[0]?.metaJson) {
    try {
      const parsed = JSON.parse(String((latest[0] as any).metaJson));
      const network = ProofNetworkSchema.safeParse(parsed?.network);
      const mode = ProofModeSchema.safeParse(parsed?.mode);
      resolved = {
        network: network.success ? network.data : resolved.network,
        mode: mode.success ? mode.data : resolved.mode,
      };
    } catch {
      // ignore
    }
  }

  return NextResponse.json(
    { trustId, ...resolved },
    { headers: { "Cache-Control": "private, max-age=60", Vary: "Cookie" } }
  );
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ trustId: string }> }) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { trustId } = await ctx.params;

  let body: z.infer<typeof PostSchema>;
  try {
    body = PostSchema.parse(await req.json());
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Invalid body" }, { status: 400 });
  }

  const db = await getDb();
  const trustRows = await db.select().from(trusts).where(and(eq(trusts.id, trustId), eq(trusts.userId, userId))).limit(1);
  if (trustRows.length === 0) return NextResponse.json({ error: "Trust not found" }, { status: 404 });

  await db.insert(accessLogs).values({
    id: crypto.randomUUID(),
    trustId,
    actorUserId: userId,
    action: "proof_settings_updated",
    metaJson: JSON.stringify({
      network: body.network,
      mode: body.mode,
      updatedAt: new Date().toISOString(),
    }),
  } as any);

  return NextResponse.json({ trustId, network: body.network, mode: body.mode });
}


