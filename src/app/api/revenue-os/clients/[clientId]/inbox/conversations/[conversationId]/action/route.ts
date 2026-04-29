import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthedUserId } from "@/lib/api/auth";
import { ensureClientHubTables } from "@/lib/db/client-hub-ensure";
import { assertValidClientId } from "@/lib/revenue-os/client-hub-queries";
import {
  applyClientHubInboxAction,
  type InboxClientHubAction,
} from "@/lib/revenue-os/client-hub-inbox-actions";
import { ensureCrmTables } from "@/lib/db/crm-ensure";
import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";

const Body = z
  .object({
    action: z.enum([
      "mark_qualified",
      "assign_followup",
      "create_task",
      "schedule_booking",
      "add_note",
    ] satisfies [InboxClientHubAction, ...InboxClientHubAction[]]),
    text: z.string().optional(),
    dueAt: z.string().optional(),
    assignee: z.string().optional(),
  })
  .strict();

type Ctx = { params: Promise<{ clientId: string; conversationId: string }> };

/**
 * POST — CRM inbox action for a conversation whose contact is scoped to this client + user.
 */
export async function POST(req: NextRequest, ctx: Ctx) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    await ensureClientHubTables();
    await ensureCrmTables();
    const userId = await getAuthedUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { clientId, conversationId } = await ctx.params;
    try {
      assertValidClientId(clientId);
    } catch {
      return NextResponse.json({ error: "Invalid client id" }, { status: 400 });
    }
    const body = await req.json();
    const parsed = Body.parse(body);
    const r = await applyClientHubInboxAction(userId, clientId, conversationId, parsed.action, {
      text: parsed.text,
      dueAt: parsed.dueAt,
      assignee: parsed.assignee,
    });
    if ("error" in r) {
      return NextResponse.json({ error: r.error }, { status: r.status });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid payload", details: e.flatten() }, { status: 400 });
    }
    console.error("POST client inbox action", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
