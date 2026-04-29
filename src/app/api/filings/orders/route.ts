import { NextResponse } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { getDb } from "@/lib/db";
import { filingOrders, filingPackets } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { verifyToken } from "@/lib/auth";
import { filingDueDate, filingExtensionDate } from "@/lib/filings/deadlines";

const CreateOrderSchema = z.object({
  orderType: z.enum(["FOREIGN_OWNED_SMLLC_5472", "PARTNERSHIP_1065"]),
  taxYear: z.number().int().min(2000).max(2100).default(2025),
});

const PRICE_CENTS: Record<string, number> = {
  FOREIGN_OWNED_SMLLC_5472: 49900,
  PARTNERSHIP_1065: 89900,
};

async function getAuthedUserId(): Promise<number | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth-token")?.value ?? null;
  if (!token) return null;
  const payload = verifyToken(token);
  const userId = payload?.userId;
  return typeof userId === "number" ? userId : null;
}

async function getActiveContext(userId: number) {
  // For now, return empty context - you can implement this based on your active trust/client logic
  return {
    clientId: null,
    entityId: null,
    trustId: null,
  };
}

export async function POST(req: Request) {
  const userId = await getAuthedUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } }, { status: 401 });
  }
  const body = CreateOrderSchema.parse(await req.json());
  const active = await getActiveContext(userId);
  const db = await getDb();

  const due = filingDueDate(body.orderType, body.taxYear);
  const ext = filingExtensionDate(body.orderType, body.taxYear);

  // Generate a unique publicId
  const publicId = `filing_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;

  // Create the filing order
  const [order] = await db.insert(filingOrders).values({
    publicId,
    userId: userId,
    clientId: active.clientId ?? null,
    entityId: active.entityId ?? null,
    orderType: body.orderType,
    taxYear: body.taxYear,
    priceCents: PRICE_CENTS[body.orderType],
    status: "PAYMENT_PENDING",
    dueDate: due,
    extensionDate: ext,
  }).$returningId();

  // Create initial packet
  await db.insert(filingPackets).values({
    orderId: order.id,
    version: 1,
    payloadJson: JSON.stringify({
      intake: {},
      meta: { createdFrom: "accounting_wizard" },
    }),
  });

  // Fetch the created order with packet
  const [createdOrder] = await db.select().from(filingOrders).where(eq(filingOrders.id, order.id)).limit(1);
  const [latestPacket] = await db.select().from(filingPackets).where(eq(filingPackets.orderId, order.id)).orderBy(desc(filingPackets.version)).limit(1);

  return NextResponse.json({ ok: true, order: { ...createdOrder, packets: latestPacket ? [latestPacket] : [] } });
}
