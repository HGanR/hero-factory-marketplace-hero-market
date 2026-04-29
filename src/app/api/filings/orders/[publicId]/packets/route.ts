import { NextResponse } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { getDb } from "@/lib/db";
import { filingOrders, filingPackets } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { verifyToken } from "@/lib/auth";

const AppendPacketSchema = z.object({
  payload: z.any(),
});

async function getAuthedUserId(): Promise<number | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth-token")?.value ?? null;
  if (!token) return null;
  const payload = verifyToken(token);
  const userId = payload?.userId;
  return typeof userId === "number" ? userId : null;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ publicId: string }> }
) {
  const userId = await getAuthedUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } }, { status: 401 });
  }
  const { payload } = AppendPacketSchema.parse(await req.json());
  const db = await getDb();
  const resolvedParams = await params;

  const [order] = await db.select().from(filingOrders).where(eq(filingOrders.publicId, resolvedParams.publicId)).limit(1);

  if (!order || order.userId !== userId) {
    return NextResponse.json(
      { ok: false, error: { code: "NOT_FOUND", message: "Filing order not found." } },
      { status: 404 }
    );
  }

  const [lastPacket] = await db.select().from(filingPackets).where(eq(filingPackets.orderId, order.id)).orderBy(desc(filingPackets.version)).limit(1);
  const last = lastPacket?.version ?? 0;
  const nextVersion = last + 1;

  const packet = await db.insert(filingPackets).values({
    orderId: order.id,
    version: nextVersion,
    payloadJson: JSON.stringify(payload),
  }).$returningId();

  await db.update(filingOrders)
    .set({ status: "INTAKE_IN_PROGRESS" })
    .where(eq(filingOrders.id, order.id));

  return NextResponse.json({ ok: true, packet: { id: packet[0].id, version: nextVersion } });
}
