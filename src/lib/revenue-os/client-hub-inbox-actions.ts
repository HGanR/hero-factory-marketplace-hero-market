import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { crm_contacts, crm_conversations } from "@/lib/db/schema";
import { getOwnedClientRow } from "@/lib/revenue-os/client-hub-ownership";
import { recordClientHubAutomationEvent } from "@/lib/revenue-os/client-hub-automation-events";

export type InboxClientHubAction =
  | "mark_qualified"
  | "assign_followup"
  | "create_task"
  | "schedule_booking"
  | "add_note";

type ActionBody = { text?: string; dueAt?: string; assignee?: string };

function mergeJson(
  prev: unknown,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const base =
    prev && typeof prev === "object" && !Array.isArray(prev) ? { ...(prev as Record<string, unknown>) } : {};
  const hub =
    base["clientHub"] && typeof base["clientHub"] === "object" && !Array.isArray(base["clientHub"])
      ? { ...(base["clientHub"] as Record<string, unknown>) }
      : {};
  return { ...base, clientHub: { ...hub, ...patch } };
}

/**
 * Approve CRM conversation + contact scoped to an owned `client_accounts` row.
 */
export async function applyClientHubInboxAction(
  userId: number,
  clientId: string,
  conversationId: string,
  action: InboxClientHubAction,
  body: ActionBody,
): Promise<{ ok: true } | { error: string; status: 400 | 404 | 403 }> {
  if (!(await getOwnedClientRow(userId, clientId))) {
    return { error: "Not found", status: 404 };
  }
  const db = await getDb();
  const [conv] = await db
    .select()
    .from(crm_conversations)
    .where(eq(crm_conversations.id, conversationId))
    .limit(1);
  if (!conv || !conv.contactId) {
    return { error: "Conversation not found", status: 404 };
  }
  const [contact] = await db
    .select()
    .from(crm_contacts)
    .where(
      and(
        eq(crm_contacts.id, conv.contactId),
        eq(crm_contacts.userId, userId),
        eq(crm_contacts.clientId, clientId),
      ),
    )
    .limit(1);
  if (!contact) {
    return { error: "Contact not found for this client", status: 404 };
  }

  const now = new Date().toISOString();
  let patch: Record<string, unknown> = {};
  let eventName = "followup_created";
  const summary: string | undefined = body.text?.trim();

  switch (action) {
    case "mark_qualified":
      patch = { leadQualified: true, leadQualifiedAt: now };
      eventName = "lead_qualified";
      break;
    case "assign_followup":
      if (!summary) return { error: "text required for follow-up", status: 400 };
      patch = { followUp: summary, followUpAt: now };
      eventName = "followup_created";
      break;
    case "create_task":
      if (!summary) return { error: "text required for task", status: 400 };
      patch = { task: summary, taskCreatedAt: now, taskDue: body.dueAt ?? null, assignee: body.assignee ?? null };
      eventName = "task_created";
      break;
    case "schedule_booking": {
      const t = (body.dueAt ?? body.text ?? "").trim();
      if (!t) return { error: "date or text required for booking", status: 400 };
      patch = { booking: t, bookingRequestedAt: now };
      eventName = "booking_scheduled";
      break;
    }
    case "add_note":
      if (!summary) return { error: "text required for note", status: 400 };
      patch = { lastNote: summary, lastNoteAt: now };
      eventName = "followup_created";
      break;
    default:
      return { error: "Invalid action", status: 400 };
  }

  const nextFields = mergeJson(contact.customFields, patch);
  await db
    .update(crm_contacts)
    .set({ customFields: nextFields, updatedAt: new Date() })
    .where(eq(crm_contacts.id, contact.id));

  const metaSummary =
    summary ||
    (action === "mark_qualified" ? "Lead marked qualified" : undefined) ||
    undefined;
  await recordClientHubAutomationEvent(userId, clientId, eventName, {
    refId: contact.id,
    metadata: { summary: metaSummary, conversationId, action },
  });
  return { ok: true };
}
