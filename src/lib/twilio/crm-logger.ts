import { getDb } from "@/lib/db";
import { sql } from "drizzle-orm";
import { ensureCrmTables } from "@/lib/db/crm-ensure";
import { computePreview } from "@/lib/conversations/preview";
import { normalizeDirection } from "@/lib/crm/constants";
import { randomUUID } from "crypto";

export type TwilioVoicePayload = {
  CallSid: string;
  From: string;
  To: string;
  CallStatus?: string;
  Direction?: string;
};

/**
 * Log an inbound call to CRM: creates/ finds contact, conversation, call_log, and message.
 * Returns voiceAgentId if the To number matched an ai_voice_agent.
 */
export async function logInboundCall(payload: TwilioVoicePayload): Promise<{
  callLogId: string;
  conversationId: string;
  contactId: string | null;
  voiceAgentId: string | null;
}> {
  await ensureCrmTables();
  const db = await getDb();

  const fromNumber = (payload.From || "").trim();
  const toNumber = (payload.To || "").trim();
  const callSid = (payload.CallSid || "").trim();
  const direction = normalizeDirection(payload.Direction || "inbound");

  // Find voice agent by To number (use first userId for ownership)
  const [agentRow] = (await db.execute(sql`
    SELECT id, userId FROM ai_voice_agents
    WHERE phoneNumber = ${toNumber} AND isActive = 1
    LIMIT 1
  `)) as any;
  const agent = Array.isArray(agentRow) ? agentRow[0] : agentRow?.rows?.[0] ?? agentRow;
  const voiceAgentId = agent?.id ?? null;
  const userId = agent?.userId ?? 1; // fallback for unassigned numbers

  // Find or create contact by phone
  const [contactRow] = (await db.execute(sql`
    SELECT id FROM crm_contacts
    WHERE phone = ${fromNumber} AND userId = ${userId}
    LIMIT 1
  `)) as any;
  const existingContact = Array.isArray(contactRow) ? contactRow[0] : contactRow?.rows?.[0] ?? contactRow;
  let contactId = existingContact?.id;
  let isNewContact = false;
  if (!contactId) {
    contactId = randomUUID();
    isNewContact = true;
    await db.execute(sql`
      INSERT INTO crm_contacts (id, userId, phone, firstName, lastName)
      VALUES (${contactId}, ${userId}, ${fromNumber}, '', '')
    `);
  }

  // Idempotency: if call with this twilioCallSid already exists, return existing (no duplicate insert)
  const [existingCall] = (await db.execute(sql`
    SELECT id as callLogId, conversationId, contactId FROM crm_call_logs
    WHERE twilioCallSid = ${callSid}
    LIMIT 1
  `)) as any;
  const existing = Array.isArray(existingCall) ? existingCall[0] : existingCall?.rows?.[0] ?? existingCall;
  if (existing?.callLogId) {
    return {
      callLogId: existing.callLogId,
      conversationId: existing.conversationId,
      contactId: existing.contactId,
      voiceAgentId,
    };
  }

  // Find or create conversation (one per contact per channel for calls)
  const [convRow] = (await db.execute(sql`
    SELECT id FROM crm_conversations
    WHERE contactId = ${contactId} AND channel = 'call' AND userId = ${userId}
    LIMIT 1
  `)) as any;
  let conversationId = Array.isArray(convRow) ? convRow[0]?.id : convRow?.rows?.[0]?.id ?? convRow?.id;
  if (!conversationId) {
    conversationId = randomUUID();
    await db.execute(sql`
      INSERT INTO crm_conversations (id, contactId, userId, channel, status)
      VALUES (${conversationId}, ${contactId}, ${userId}, 'call', 'open')
    `);
  }

  // Create call log (twilioCallSid is unique via uniq_twilio_sid index)
  const callLogId = randomUUID();
  await db.execute(sql`
    INSERT INTO crm_call_logs (id, conversationId, contactId, userId, voiceAgentId, fromNumber, toNumber, direction, status, twilioCallSid)
    VALUES (${callLogId}, ${conversationId}, ${contactId}, ${userId}, ${voiceAgentId}, ${fromNumber}, ${toNumber}, ${direction}, 'initiated', ${callSid})
  `);

  // Create message (call event)
  const messageId = randomUUID();
  await db.execute(sql`
    INSERT INTO crm_messages (id, conversationId, direction, channel, callLogId)
    VALUES (${messageId}, ${conversationId}, ${direction}, 'call', ${callLogId})
  `);

  const preview = computePreview({
    channel: "call",
    bodyText: `Inbound call from ${fromNumber}`,
    fallback: "Inbound call started",
  });
  await db.execute(sql`
    UPDATE crm_conversations
    SET lastMessageAt = NOW(), lastMessagePreview = ${preview}, unreadCount = unreadCount + 1, updatedAt = NOW()
    WHERE id = ${conversationId}
  `);

  // Fire contact_created only for newly created contacts (idempotent)
  if (isNewContact) {
    try {
      const { fireAutomationWithIdempotency } = await import("@/lib/automations/runner");
      await fireAutomationWithIdempotency(`contact_created:${contactId}`, "contact_created", { contactId, metadata: { contactId } });
    } catch {
      /* ignore */
    }
  }

  return { callLogId, conversationId, contactId, voiceAgentId };
}

/**
 * Update call log status (ringing, answered, completed, etc.)
 */
export async function updateCallStatus(
  callSid: string,
  status: string,
  extra?: { duration?: number; recordingUrl?: string; transcript?: string }
): Promise<boolean> {
  await ensureCrmTables();
  const db = await getDb();

  const sets: ReturnType<typeof sql>[] = [sql`status = ${status}`];
  if (extra?.duration != null) sets.push(sql`duration = ${extra.duration}`);
  if (extra?.recordingUrl != null) sets.push(sql`recordingUrl = ${extra.recordingUrl}`);
  if (extra?.transcript != null) sets.push(sql`transcript = ${extra.transcript}`);
  sets.push(sql`updatedAt = NOW()`);

  await db.execute(sql`
    UPDATE crm_call_logs SET ${sql.join(sets, sql`, `)} WHERE twilioCallSid = ${callSid}
  `);

  // Fire call_completed automation when status is completed (idempotent by CallSid)
  if (status === "completed") {
    try {
      const [row] = (await db.execute(sql`
        SELECT contactId FROM crm_call_logs WHERE twilioCallSid = ${callSid} LIMIT 1
      `)) as any;
      const r = Array.isArray(row) ? row[0] : row?.rows?.[0] ?? row;
      const contactId = r?.contactId;
      if (contactId) {
        const { fireAutomationWithIdempotency } = await import("@/lib/automations/runner");
        await fireAutomationWithIdempotency(`call_completed:${callSid}`, "call_completed", {
          contactId,
          metadata: { twilioCallSid: callSid },
        });
      }
    } catch {
      /* ignore */
    }
  }
  return true;
}

/** Update only the recording URL for a call (recording callback fires async). */
export async function updateCallRecordingUrl(callSid: string, recordingUrl: string): Promise<boolean> {
  await ensureCrmTables();
  const db = await getDb();
  await db.execute(sql`
    UPDATE crm_call_logs SET recordingUrl = ${recordingUrl}, updatedAt = NOW() WHERE twilioCallSid = ${callSid}
  `);
  return true;
}
