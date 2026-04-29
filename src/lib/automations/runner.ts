import { getDb } from "@/lib/db";
import { sql } from "drizzle-orm";
import { ensureCrmTables } from "@/lib/db/crm-ensure";
import { randomUUID } from "crypto";

export type TriggerContext = {
  contactId?: string;
  opportunityId?: string;
  metadata?: Record<string, unknown>;
};

function computeDedupeKey(triggerType: string, automationId: string, context: TriggerContext): string | null {
  if (context.metadata?.manualTest) return null; // Manual test runs never dedupe
  const meta = context.metadata ?? {};
  if (triggerType === "call_completed") {
    const sid = meta.twilioCallSid ?? meta.callSid ?? meta.CallSid;
    return sid ? `${triggerType}:${String(sid)}:${automationId}` : null;
  }
  if (triggerType === "contact_created" && context.contactId) {
    return `${triggerType}:${context.contactId}:${automationId}`;
  }
  if (triggerType === "offer_created" && meta.offerId) {
    return `${triggerType}:${String(meta.offerId)}:${automationId}`;
  }
  return null;
}

/**
 * Fire an automation with idempotency. Returns [] if key was already seen.
 */
export async function fireAutomationWithIdempotency(
  idempotencyKey: string,
  triggerType: string,
  context: TriggerContext
): Promise<string[]> {
  await ensureCrmTables();
  const db = await getDb();
  try {
    await db.execute(sql`INSERT INTO crm_automation_idempotency (idempotencyKey) VALUES (${idempotencyKey})`);
  } catch {
    return []; // Duplicate key - already processed
  }
  return fireAutomation(triggerType, context);
}

/**
 * Fire an automation by trigger type. Finds active automations with matching trigger,
 * creates a run for each, and executes steps.
 * If automationId is provided, only that automation is run.
 */
export async function fireAutomation(
  triggerType: string,
  context: TriggerContext,
  options?: { automationId?: string; forceRun?: boolean }
): Promise<string[]> {
  await ensureCrmTables();
  const db = await getDb();

  const automationFilter = options?.automationId
    ? sql`AND t.automationId = ${options.automationId}`
    : sql``;
  const activeFilter = options?.forceRun ? sql`AND 1=1` : sql`AND a.isActive = 1`;

  const triggers = (await db.execute(sql`
    SELECT t.id, t.automationId, t.config
    FROM crm_automation_triggers t
    JOIN crm_automations a ON a.id = t.automationId ${activeFilter}
    WHERE t.type = ${triggerType} ${automationFilter}
  `)) as any;
  const arr = Array.isArray(triggers) ? triggers : triggers?.rows ?? triggers;
  if (!arr?.length) return [];

  const runIds: string[] = [];
  for (const t of arr) {
    const runId = await createAndExecuteRun(db, t.automationId, context, triggerType);
    if (runId) runIds.push(runId);
  }
  return runIds;
}

async function createAndExecuteRun(
  db: Awaited<ReturnType<typeof getDb>>,
  automationId: string,
  context: TriggerContext,
  triggerType: string
): Promise<string | null> {
  const dedupeKey = computeDedupeKey(triggerType, automationId, context);
  if (dedupeKey) {
    const existing = (await db.execute(sql`
      SELECT id FROM crm_automation_runs
      WHERE automationId = ${automationId}
        AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.dedupeKey')) = ${dedupeKey}
        AND status IN ('completed', 'running')
      ORDER BY triggeredAt DESC LIMIT 1
    `)) as any;
    const arr = Array.isArray(existing) ? existing : existing?.rows ?? existing;
    const r = arr?.[0];
    if (r?.id) return r.id;
  }

  const metadata = { ...(context.metadata ?? {}), ...(dedupeKey ? { dedupeKey } : {}) };
  const runId = randomUUID();
  await db.execute(sql`
    INSERT INTO crm_automation_runs (id, automationId, contactId, opportunityId, status, metadata)
    VALUES (${runId}, ${automationId}, ${context.contactId ?? null}, ${context.opportunityId ?? null}, 'running', ${JSON.stringify(metadata)})
  `);

  const steps = (await db.execute(sql`
    SELECT id, type, config, sortOrder FROM crm_automation_steps
    WHERE automationId = ${automationId}
    ORDER BY sortOrder ASC
  `)) as any;
  const stepArr = Array.isArray(steps) ? steps : steps?.rows ?? steps;

  for (const s of stepArr ?? []) {
    const stepId = s.id;
    await db.execute(sql`
      INSERT INTO crm_automation_run_steps (id, runId, stepId, status)
      VALUES (${randomUUID()}, ${runId}, ${stepId}, 'pending')
    `);
    // Execute step (stub for now - actual execution would call SES, create task, etc.)
    await executeStep(db, runId, stepId, s.type, s.config ?? {}, context);
  }

  await db.execute(sql`
    UPDATE crm_automation_runs SET status = 'completed', completedAt = NOW() WHERE id = ${runId}
  `);
  return runId;
}

async function executeStep(
  db: Awaited<ReturnType<typeof getDb>>,
  runId: string,
  stepId: string,
  type: string,
  config: Record<string, unknown>,
  context: TriggerContext
): Promise<void> {
  try {
    switch (type) {
      case "send_email": {
        const [aRow] = (await db.execute(sql`SELECT userId FROM crm_automations a JOIN crm_automation_runs r ON r.automationId = a.id WHERE r.id = ${runId} LIMIT 1`)) as any;
        const uid = Array.isArray(aRow) ? aRow[0]?.userId : aRow?.rows?.[0]?.userId ?? aRow?.userId;
        let contact: Record<string, unknown> | undefined;
        if (context.contactId) {
          const [cRow] = (await db.execute(sql`SELECT firstName, lastName, email, phone FROM crm_contacts WHERE id = ${context.contactId} LIMIT 1`)) as any;
          const c = Array.isArray(cRow) ? cRow[0] : cRow?.rows?.[0] ?? cRow;
          if (c) contact = { firstName: c.firstName, lastName: c.lastName, email: c.email, phone: c.phone };
        }
        const { executeSendEmailStep } = await import("./executors/send_email");
        const out = await executeSendEmailStep({
          db,
          userId: uid ?? 0,
          contactId: context.contactId ?? null,
          payload: context.metadata as Record<string, unknown> | undefined,
          contact,
          stepConfig: config as Parameters<typeof executeSendEmailStep>[0]["stepConfig"],
        });
        const stepResult = out.success ? { executed: true } : { executed: false, error: out.error };
        await db.execute(sql`
          UPDATE crm_automation_run_steps SET status = ${out.success ? "completed" : "failed"}, result = ${JSON.stringify(stepResult)}, executedAt = NOW()
          WHERE runId = ${runId} AND stepId = ${stepId}
        `);
        return;
      }
      case "create_task": {
        const [aRow] = (await db.execute(sql`SELECT userId FROM crm_automations a JOIN crm_automation_runs r ON r.automationId = a.id WHERE r.id = ${runId} LIMIT 1`)) as any;
        const uid = Array.isArray(aRow) ? aRow[0]?.userId : aRow?.rows?.[0]?.userId ?? aRow?.userId;
        let stepResult: Record<string, unknown> = { executed: true };
        if (uid && (config.title || config.titleTemplate)) {
          const { executeCreateTaskStep } = await import("./executors/create_task");
          let contact: Record<string, unknown> | undefined;
          if (context.contactId) {
            const [cRow] = (await db.execute(sql`SELECT firstName, lastName, email, phone FROM crm_contacts WHERE id = ${context.contactId} LIMIT 1`)) as any;
            const c = Array.isArray(cRow) ? cRow[0] : cRow?.rows?.[0] ?? cRow;
            if (c) contact = { firstName: c.firstName, lastName: c.lastName, email: c.email, phone: c.phone };
          }
          const out = await executeCreateTaskStep({
            db,
            userId: uid,
            contactId: context.contactId ?? null,
            payload: context.metadata as Record<string, unknown> | undefined,
            contact,
            stepConfig: config as Parameters<typeof executeCreateTaskStep>[0]["stepConfig"],
            runId,
            stepId,
          });
          stepResult = { executed: true, taskId: out.taskId, contactId: context.contactId ?? null, reused: out.reused ?? false };
        }
        await db.execute(sql`
          UPDATE crm_automation_run_steps SET status = 'completed', result = ${JSON.stringify(stepResult)}, executedAt = NOW()
          WHERE runId = ${runId} AND stepId = ${stepId}
        `);
        return;
      }
      case "update_field":
        // Update contact custom field - stub
        break;
      case "add_tag":
        // Append to contact tags - stub
        break;
      case "notify_consultant":
        // In-app or email notification - stub
        break;
    }
    await db.execute(sql`
      UPDATE crm_automation_run_steps SET status = 'completed', result = ${JSON.stringify({ executed: true })}, executedAt = NOW()
      WHERE runId = ${runId} AND stepId = ${stepId}
    `);
  } catch (err) {
    await db.execute(sql`
      UPDATE crm_automation_run_steps SET status = 'failed', result = ${JSON.stringify({ error: String(err) })}, executedAt = NOW()
      WHERE runId = ${runId} AND stepId = ${stepId}
    `);
  }
}

/**
 * Retry a failed step or replay entire run. Validates automation ownership via userId.
 * Returns { success, runId } or throws if not found.
 */
export async function retryRun(
  db: Awaited<ReturnType<typeof getDb>>,
  runId: string,
  userId: number,
  stepId?: string
): Promise<{ success: boolean; runId: string }> {
  const [runRow] = (await db.execute(sql`
    SELECT r.id, r.automationId, r.contactId, r.opportunityId, r.metadata
    FROM crm_automation_runs r
    JOIN crm_automations a ON a.id = r.automationId AND a.userId = ${userId}
    WHERE r.id = ${runId}
  `)) as any;
  const run = Array.isArray(runRow) ? runRow[0] : runRow?.rows?.[0] ?? runRow;
  if (!run?.id) throw new Error("Run not found");

  const context: TriggerContext = {
    contactId: run.contactId ?? undefined,
    opportunityId: run.opportunityId ?? undefined,
    metadata: typeof run.metadata === "string" ? (() => { try { return JSON.parse(run.metadata); } catch { return {}; } })() : (run.metadata ?? {}),
  };

  if (stepId) {
    const [stepRow] = (await db.execute(sql`
      SELECT s.id, s.type, s.config FROM crm_automation_steps s
      JOIN crm_automations a ON a.id = s.automationId AND a.userId = ${userId}
      WHERE s.id = ${stepId} AND s.automationId = ${run.automationId}
    `)) as any;
    const step = Array.isArray(stepRow) ? stepRow[0] : stepRow?.rows?.[0] ?? stepRow;
    if (!step?.id) throw new Error("Step not found");
    const config = typeof step.config === "string" ? (() => { try { return JSON.parse(step.config); } catch { return {}; } })() : (step.config ?? {});
    await executeStep(db, runId, stepId, step.type, config, context);
  } else {
    await db.execute(sql`UPDATE crm_automation_runs SET status = 'running', completedAt = NULL WHERE id = ${runId}`);
    await db.execute(sql`UPDATE crm_automation_run_steps SET status = 'pending', result = NULL, executedAt = NULL WHERE runId = ${runId}`);

    const steps = (await db.execute(sql`
      SELECT id, type, config, sortOrder FROM crm_automation_steps
      WHERE automationId = ${run.automationId}
      ORDER BY sortOrder ASC
    `)) as any;
    const stepArr = Array.isArray(steps) ? steps : steps?.rows ?? steps;
    for (const s of stepArr ?? []) {
      const cfg = typeof s.config === "string" ? (() => { try { return JSON.parse(s.config); } catch { return {}; } })() : (s.config ?? {});
      await executeStep(db, runId, s.id, s.type, cfg, context);
    }
    await db.execute(sql`UPDATE crm_automation_runs SET status = 'completed', completedAt = NOW() WHERE id = ${runId}`);
  }

  return { success: true, runId };
}
