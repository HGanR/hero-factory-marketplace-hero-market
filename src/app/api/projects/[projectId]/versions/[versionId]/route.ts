import { NextResponse } from "next/server";
import { merchStore } from "@/lib/merch/mock-db";
import { getDb } from "@/lib/db";
import { merchRenders, merchVersions } from "@/lib/db/schema";
import { ensureMerchTables } from "@/lib/merch/db";
import { eq } from "drizzle-orm";

type Params = { params: Promise<{ projectId: string; versionId: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { projectId, versionId } = await params;
  try {
    const db = await getDb();
    await ensureMerchTables(db);
    const [version] = await db
      .select()
      .from(merchVersions)
      .where(eq(merchVersions.id, versionId))
      .limit(1);
    if (!version || version.projectId !== projectId) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 });
    }
    const renders = await db.select().from(merchRenders).where(eq(merchRenders.versionId, versionId));
    return NextResponse.json({ version, renders });
  } catch {
    const version = merchStore.versions.find((v) => v.id === versionId && v.projectId === projectId);
    if (!version) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 });
    }
    const renders = merchStore.renders.filter((r) => r.versionId === versionId);
    return NextResponse.json({ version, renders });
  }
}

