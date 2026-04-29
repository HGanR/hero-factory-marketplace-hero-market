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
    const workspaceId = searchParams.get("workspaceId")?.trim() || null;
    const clientId = searchParams.get("clientId")?.trim() || null;
    const trustId = searchParams.get("trustId")?.trim() || null;

    const conditions = [sql`userId = ${userId}`];
    if (workspaceId) conditions.push(sql`(workspaceId = ${workspaceId} OR workspaceId IS NULL)`);
    if (clientId) conditions.push(sql`(clientId = ${clientId} OR clientId IS NULL)`);
    if (trustId) conditions.push(sql`(trustId = ${trustId} OR trustId IS NULL)`);

    const whereClause = sql.join(conditions, sql` AND `);
    const q = sql`
      SELECT id, userId, clientId, trustId, workspaceId, name, type, email, residentState, workState, status, createdAt
      FROM payroll_workers
      WHERE ${whereClause}
      ORDER BY name ASC
    `;

    const rows = (await db.execute(q)) as any;
    const arr = Array.isArray(rows) ? rows : rows?.rows ?? rows ?? [];

    return NextResponse.json({ workers: arr });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    if (msg === "Unauthorized") return NextResponse.json({ error: msg }, { status: 401 });
    console.error("payroll workers GET:", err);
    return NextResponse.json({ error: "Failed to fetch workers" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = requireUserId(req);
    const body = await req.json().catch(() => ({}));
    const db = await getDb();
    await ensurePayrollTables();

    const name = (typeof body?.name === "string" ? body.name.trim() : "") || "New worker";
    const type = ["employee", "contractor"].includes(body?.type) ? body.type : "employee";
    const email = typeof body?.email === "string" ? body.email.trim() || null : null;
    const clientId = typeof body?.clientId === "string" ? body.clientId.trim() || null : null;
    const trustId = typeof body?.trustId === "string" ? body.trustId.trim() || null : null;
    const workspaceId = typeof body?.workspaceId === "string" ? body.workspaceId.trim() || null : null;

    const residentState = typeof body?.residentState === "string" ? body.residentState.trim().slice(0, 32) || null : null;
    const workState = typeof body?.workState === "string" ? body.workState.trim().slice(0, 32) || null : null;

    const id = crypto.randomUUID();
    await db.execute(sql`
      INSERT INTO payroll_workers (id, userId, clientId, trustId, workspaceId, name, type, email, residentState, workState, status)
      VALUES (${id}, ${userId}, ${clientId}, ${trustId}, ${workspaceId}, ${name}, ${type}, ${email}, ${residentState}, ${workState}, 'active')
    `);

    const [row] = (await db.execute(
      sql`SELECT id, userId, clientId, trustId, workspaceId, name, type, email, residentState, workState, status, createdAt FROM payroll_workers WHERE id = ${id} LIMIT 1`
    )) as any;
    const worker = Array.isArray(row) ? row[0] : row?.rows?.[0] ?? row;

    return NextResponse.json({ worker: worker ?? { id, name, type, email, clientId, trustId, workspaceId } }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    if (msg === "Unauthorized") return NextResponse.json({ error: msg }, { status: 401 });
    console.error("payroll workers POST:", err);
    return NextResponse.json({ error: "Failed to create worker" }, { status: 500 });
  }
}
