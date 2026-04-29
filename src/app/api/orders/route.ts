import { NextResponse } from "next/server";
import { makeId, merchStore } from "@/lib/merch/mock-db";
import { CreateOrderSchema } from "@/lib/zod/order";
import { getDb } from "@/lib/db";
import { merchOrders, merchProjects } from "@/lib/db/schema";
import { ensureMerchTables } from "@/lib/merch/db";
import { desc, eq } from "drizzle-orm";
import { getAuthedUserId } from "@/lib/api/auth";

const nowIso = () => new Date().toISOString();

export async function GET() {
  try {
    const db = await getDb();
    await ensureMerchTables(db);
    const userId = (await getAuthedUserId()) ?? 1;
    const items = await db.select().from(merchOrders).where(eq(merchOrders.userId, userId)).orderBy(desc(merchOrders.createdAt));
    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ items: merchStore.orders });
  }
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const parsed = CreateOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  }
  const payload = parsed.data;
  try {
    const db = await getDb();
    await ensureMerchTables(db);
    const [project] = await db.select().from(merchProjects).where(eq(merchProjects.id, payload.projectId)).limit(1);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    const userId = (await getAuthedUserId()) ?? 1;
    const id = makeId("order");
    await db.insert(merchOrders).values({
      id,
      userId,
      projectId: payload.projectId,
      status: payload.status,
      itemsJson: payload.itemsJson,
      totalCents: payload.totalCents,
    });
    const [item] = await db.select().from(merchOrders).where(eq(merchOrders.id, id)).limit(1);
    return NextResponse.json(item, { status: 201 });
  } catch {
    const project = merchStore.projects.find((p) => p.id === payload.projectId);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    const item = {
      id: makeId("order"),
      ownerId: payload.ownerId || "demo-owner",
      projectId: payload.projectId,
      status: payload.status,
      itemsJson: payload.itemsJson,
      totalCents: payload.totalCents,
      createdAt: nowIso(),
    };
    merchStore.orders.unshift(item);
    return NextResponse.json(item, { status: 201 });
  }
}

