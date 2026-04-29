import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { oasisElementCategories } from "@/lib/db/schema";
import { asc } from "drizzle-orm";

export async function GET() {
  try {
    const db = await getDb();
    const categories = await db
      .select()
      .from(oasisElementCategories)
      .orderBy(asc(oasisElementCategories.name));
    return NextResponse.json({ categories });
  } catch (error) {
    console.error("OASIS categories GET error:", error);
    return NextResponse.json({ error: "Failed to load categories" }, { status: 500 });
  }
}


