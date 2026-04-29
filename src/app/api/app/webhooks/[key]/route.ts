import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { ensureAgentWebhookRegistrationsTable } from "@/lib/agent-maps/db";
import { runWorkflow } from "@/lib/agent-maps/workflow-runner";

type Params = { params: Promise<{ key: string }> };

function extractPayload(req: NextRequest): Promise<Record<string, unknown>> {
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return req.json().catch(() => ({}));
  }
  if (contentType.includes("application/x-www-form-urlencoded")) {
    return req.formData().then((fd) => {
      const o: Record<string, unknown> = {};
      fd.forEach((v, k) => {
        o[k] = typeof v === "string" ? v : v.name;
      });
      return o;
    });
  }
  return req.text().then((t) => {
    try {
      return JSON.parse(t) as Record<string, unknown>;
    } catch {
      return { body: t };
    }
  });
}

/** POST: Invoke workflow by webhook key. No auth required - key is the secret. */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { key } = await params;
    if (!key || key.length < 16) {
      return NextResponse.json({ error: "Invalid webhook key" }, { status: 400 });
    }

    const db = await getDb();
    await ensureAgentWebhookRegistrationsTable(db);

    const rows = (await db.execute(
      sql`SELECT userId, workspaceId, triggerNodeId FROM agent_webhook_registrations WHERE webhookKey = ${key} LIMIT 1`
    )) as { userId: number; workspaceId: string; triggerNodeId: string }[] | { rows?: { userId: number; workspaceId: string; triggerNodeId: string }[] };

    const row = Array.isArray(rows) ? rows[0] : rows?.rows?.[0];
    if (!row) {
      return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
    }

    const userId = Number(row.userId);
    const workspaceId = String(row.workspaceId ?? "");
    const triggerNodeId = String(row.triggerNodeId ?? "");

    if (!userId || !workspaceId || !triggerNodeId) {
      return NextResponse.json({ error: "Invalid webhook registration" }, { status: 500 });
    }

    const payload = await extractPayload(req);

    const result = await runWorkflow(userId, workspaceId, triggerNodeId, payload);

    return NextResponse.json({
      ok: result.success,
      triggerNodeId,
      outputs: result.outputs,
      error: result.error,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("Webhook invoke error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
