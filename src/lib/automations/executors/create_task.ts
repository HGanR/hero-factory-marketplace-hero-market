import { randomUUID } from "crypto";
import { sql } from "drizzle-orm";
import { crm_tasks } from "@/lib/db/schema";

export type CreateTaskStepConfig = {
  title?: string;
  titleTemplate?: string;
  description?: string;
  dueInMinutes?: number;
  priority?: "low" | "normal" | "high" | "urgent";
};

function renderTemplate(tpl: string, ctx: Record<string, unknown>): string {
  return tpl.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_m, path) => {
    const parts = String(path).split(".");
    let cur: unknown = ctx;
    for (const p of parts) cur = (cur as Record<string, unknown>)?.[p];
    return cur == null ? "" : String(cur);
  });
}

export async function executeCreateTaskStep(args: {
  db: Awaited<ReturnType<typeof import("@/lib/db").getDb>>;
  userId: number;
  contactId?: string | null;
  workspaceId?: string | null;
  payload?: Record<string, unknown>;
  contact?: Record<string, unknown>;
  stepConfig: CreateTaskStepConfig;
  runId?: string;
  stepId?: string;
}): Promise<{ taskId: string; reused?: boolean }> {
  const { db, userId, contactId, workspaceId, payload, contact, stepConfig, runId, stepId } = args;

  const priority = ["low", "normal", "high", "urgent"].includes(
    String(stepConfig.priority ?? "normal")
  )
    ? (stepConfig.priority as "low" | "normal" | "high" | "urgent")
    : "normal";

  const ctx: Record<string, unknown> = {
    payload: payload ?? {},
    contact: contact ?? {},
  };

  const title =
    stepConfig.titleTemplate
      ? renderTemplate(stepConfig.titleTemplate, ctx)
      : stepConfig.title ?? "Follow up";

  const dueAt =
    typeof stepConfig.dueInMinutes === "number" && Number.isFinite(stepConfig.dueInMinutes)
      ? new Date(Date.now() + stepConfig.dueInMinutes * 60_000)
      : null;

  const taskDedupeKey = runId && stepId ? `run:${runId}:step:${stepId}` : null;

  if (taskDedupeKey) {
    const existing = (await db.execute(sql`
      SELECT id FROM crm_tasks
      WHERE userId = ${userId}
        AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.dedupeKey')) = ${taskDedupeKey}
        AND status = 'open'
      LIMIT 1
    `)) as any;
    const arr = Array.isArray(existing) ? existing : existing?.rows ?? existing;
    const r = arr?.[0];
    if (r?.id) return { taskId: r.id, reused: true };
  }

  const id = randomUUID();
  const metadata = {
    ...(payload && typeof payload === "object" ? payload : {}),
    ...(taskDedupeKey ? { dedupeKey: taskDedupeKey } : {}),
  };

  const now = new Date();
  await db.insert(crm_tasks).values({
    id,
    userId,
    workspaceId: workspaceId ?? undefined,
    contactId: contactId ?? undefined,
    title: String(title).trim().slice(0, 255),
    description: stepConfig.description ?? undefined,
    dueAt: dueAt ?? undefined,
    status: "open",
    priority,
    source: "automation",
    metadata: Object.keys(metadata).length > 0 ? metadata : null,
    createdAt: now,
    updatedAt: now,
  });

  return { taskId: id, reused: false };
}
