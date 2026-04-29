import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getDb } from "@/lib/db";
import { filingOrders } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { verifyToken } from "@/lib/auth";

async function getAuthedUserId(): Promise<number | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth-token")?.value ?? null;
  if (!token) return null;
  const payload = verifyToken(token);
  const userId = payload?.userId;
  return typeof userId === "number" ? userId : null;
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ publicId: string }> }
) {
  const userId = await getAuthedUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } }, { status: 401 });
  }

  const db = await getDb();
  const resolvedParams = await params;

  const [order] = await db.select().from(filingOrders).where(eq(filingOrders.publicId, resolvedParams.publicId)).limit(1);

  if (!order || order.userId !== userId) {
    return NextResponse.json(
      { ok: false, error: { code: "NOT_FOUND", message: "Filing order not found." } },
      { status: 404 }
    );
  }

  // In production you’d assert payment succeeded here before handoff.
  await db.update(filingOrders)
    .set({ status: "READY_FOR_AGENT" })
    .where(eq(filingOrders.id, order.id));

  return NextResponse.json({ ok: true });
}
