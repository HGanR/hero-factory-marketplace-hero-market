import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { requireUserId } from "@/lib/auth";
import { ensurePayrollTables } from "@/lib/db/payroll-ensure";

export async function GET(req: NextRequest) {
  try {
    const userId = requireUserId(req);
    const db = await getDb();
    await ensurePayrollTables();

    const searchParams = req.nextUrl.searchParams;
    const clientId = searchParams.get("clientId")?.trim() || null;
    const trustId = searchParams.get("trustId")?.trim() || null;
    const workspaceId = searchParams.get("workspaceId")?.trim() || null;

    const base = sql`SELECT id, userId, clientId, trustId, workspaceId, name, status, createdAt FROM payroll_workspaces WHERE userId = ${userId}`;
    const conditions: ReturnType<typeof sql>[] = [];
    if (clientId) conditions.push(sql`AND clientId = ${clientId}`);
    if (trustId) conditions.push(sql`AND trustId = ${trustId}`);
    if (workspaceId) conditions.push(sql`AND workspaceId = ${workspaceId}`);

    const q = conditions.length
      ? sql`${base} ${sql.join(conditions, sql` `)} ORDER BY updatedAt DESC`
      : sql`${base} ORDER BY updatedAt DESC`;

    const rows = (await db.execute(q)) as any;
    const arr = Array.isArray(rows) ? rows : rows?.rows ?? rows ?? [];

    return NextResponse.json({ workspaces: arr });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    if (msg === "Unauthorized") return NextResponse.json({ error: msg }, { status: 401 });
    console.error("payroll workspaces GET:", err);
    return NextResponse.json({ error: "Failed to fetch workspaces" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = requireUserId(req);
    const body = await req.json().catch(() => ({}));
    const db = await getDb();
    await ensurePayrollTables();

    const clientId = typeof body?.clientId === "string" ? body.clientId.trim() || null : null;
    const trustId = typeof body?.trustId === "string" ? body.trustId.trim() || null : null;
    const workspaceId =
      (typeof body?.workspaceId === "string" ? body.workspaceId.trim() : null) ||
      trustId ||
      `ws-${userId}-${Date.now()}`;
    const name = (typeof body?.name === "string" ? body.name.trim() : null) || "Default workspace";

    const id = crypto.randomUUID();
    await db.execute(sql`
      INSERT INTO payroll_workspaces (id, userId, clientId, trustId, workspaceId, name, status)
      VALUES (${id}, ${userId}, ${clientId}, ${trustId}, ${workspaceId}, ${name}, 'active')
    `);

    const [row] = (await db.execute(
      sql`SELECT id, userId, clientId, trustId, workspaceId, name, status, createdAt FROM payroll_workspaces WHERE id = ${id} LIMIT 1`
    )) as any;
    const workspace = Array.isArray(row) ? row[0] : row?.rows?.[0] ?? row;

    return NextResponse.json({ workspace: workspace ?? { id, userId, clientId, trustId, workspaceId, name, status: "active" } }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    if (msg === "Unauthorized") return NextResponse.json({ error: msg }, { status: 401 });
    console.error("payroll workspaces POST:", err);
    return NextResponse.json({ error: "Failed to create workspace" }, { status: 500 });
  }
}
