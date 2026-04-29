import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { revenueOsScenarios } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const __rosGate = await enforceRevenueOsApiAccess(_req);
  if (__rosGate) return __rosGate;
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ message: "Missing id" }, { status: 400 });
    }

    const db = await getDb();
    const rows = await db
      .select()
      .from(revenueOsScenarios)
      .where(eq(revenueOsScenarios.id, id))
      .limit(1);

    if (rows.length === 0) {
      return NextResponse.json({ message: "Scenario not found" }, { status: 404 });
    }

    const row = rows[0];
    const payload =
      typeof row.payload === "object" && row.payload !== null
        ? (row.payload as Record<string, unknown>)
        : {};

    return NextResponse.json({
      id: row.id,
      payload,
      createdAt: row.createdAt,
    });
  } catch (e) {
    console.error("[revenue-os/scenarios/[id]]", e);
    return NextResponse.json(
      { message: "Failed to fetch scenario" },
      { status: 500 }
    );
  }
}
