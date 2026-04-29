import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { trustRecordRoles, trustRecordStates } from "@/lib/db/schema";
import { verifyToken } from "@/lib/auth";

async function getAuthedUserId(): Promise<number | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth-token")?.value ?? null;
  if (!token) return null;
  const payload = verifyToken(token);
  const userId = payload?.userId;
  return typeof userId === "number" ? userId : null;
}

export async function GET(_request: NextRequest) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = await getDb();

  // Ensure role row exists (default Manager)
  const roleRows = await db.select().from(trustRecordRoles).where(eq(trustRecordRoles.userId, userId)).limit(1);
  if (roleRows.length === 0) {
    await db.insert(trustRecordRoles).values({ userId, role: "Manager" } as any);
  }
  const role = (roleRows[0]?.role ?? "Manager") as "Manager" | "Trustee";

  // Ensure state exists
  const stateRows = await db.select().from(trustRecordStates).where(eq(trustRecordStates.userId, userId)).limit(1);
  if (stateRows.length === 0) {
    const defaultState = {
      config: {
        entityType: "Trust",
        entityName: "Trust Name Here",
        certificatePrefix: "TTC",
        sealDataUrl: undefined,
        watermarkDataUrl: undefined,
        watermarkOpacity: 0.12,
        watermarkScale: 1,
        watermarkRotateDeg: 0,
        trusteesDisplayName: "Board of Trustees",
      },
      assets: [],
      certificates: [],
      minutes: [],
      serialCounter: 1,
    };
    await db.insert(trustRecordStates).values({ userId, stateJson: JSON.stringify(defaultState) } as any);
    return NextResponse.json({ role, state: defaultState });
  }

  try {
    const state = JSON.parse(stateRows[0].stateJson);
    return NextResponse.json({ role, state });
  } catch {
    return NextResponse.json({ role, state: null, error: "Corrupt trust record state JSON" }, { status: 500 });
  }
}














