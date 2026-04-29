import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { sql } from "drizzle-orm";
import { ensureCrmTables } from "@/lib/db/crm-ensure";

function getCurrentUser(req: NextRequest): { userId?: number } | null {
  const token = req.cookies.get("auth-token")?.value || req.cookies.get("admin-token")?.value;
  if (!token) return null;
  const decoded = verifyToken(token);
  return decoded?.userId ? { userId: decoded.userId } : null;
}

export async function GET(req: NextRequest) {
  const user = getCurrentUser(req);
  if (!user?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await ensureCrmTables();
    const db = await getDb();
    const uid = user.userId;

    const rows = (await db.execute(sql`
      SELECT s.id, s.name, s.sortOrder,
        COUNT(o.id) as cnt,
        COALESCE(SUM(o.value), 0) as amt
      FROM crm_pipeline_stages s
      JOIN crm_pipelines p ON s.pipelineId = p.id
      LEFT JOIN crm_opportunities o ON o.stageId = s.id
      WHERE p.userId = ${uid}
      GROUP BY s.id, s.name, s.sortOrder
      ORDER BY s.sortOrder ASC
    `)) as any;

    const arr = Array.isArray(rows) ? rows : (rows?.rows ?? rows);
    const stages = (Array.isArray(arr) ? arr : []).map((r: any) => ({
      name: r.name || "Stage",
      count: Number(r.cnt ?? 0),
      amount: Number(r.amt ?? 0),
    }));

    if (stages.length === 0) {
      const defaultStages = [
        { name: "New", count: 0, amount: 0 },
        { name: "Contacted", count: 0, amount: 0 },
        { name: "Qualified", count: 0, amount: 0 },
        { name: "Proposal", count: 0, amount: 0 },
        { name: "Won", count: 0, amount: 0 },
      ];
      return NextResponse.json({ stages: defaultStages });
    }
    return NextResponse.json({ stages });
  } catch (err) {
    console.error("pipelines summary error:", err);
    return NextResponse.json({
      stages: [
        { name: "New", count: 0, amount: 0 },
        { name: "Contacted", count: 0, amount: 0 },
        { name: "Qualified", count: 0, amount: 0 },
        { name: "Proposal", count: 0, amount: 0 },
        { name: "Won", count: 0, amount: 0 },
      ],
    });
  }
}
