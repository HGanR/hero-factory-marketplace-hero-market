import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { trustRecordRoles } from "@/lib/db/schema";
import { verifyToken } from "@/lib/auth";

const BodySchema = z.object({
  userId: z.number().int().positive(),
  role: z.enum(["Manager", "Trustee"]),
});

async function requireAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin-token")?.value ?? null;
  if (!token) return false;
  const payload = verifyToken(token);
  return !!payload?.isAdmin;
}

export async function POST(request: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Invalid body" }, { status: 400 });
  }

  const db = await getDb();
  const existing = await db.select().from(trustRecordRoles).where(eq(trustRecordRoles.userId, body.userId)).limit(1);
  if (existing.length === 0) {
    await db.insert(trustRecordRoles).values({ userId: body.userId, role: body.role } as any);
  } else {
    await db.update(trustRecordRoles).set({ role: body.role } as any).where(eq(trustRecordRoles.userId, body.userId));
  }

  return NextResponse.json({ success: true });
}














