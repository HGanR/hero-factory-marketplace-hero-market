import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getExecutiveAdminUserId } from "@/lib/admin/get-executive-admin-user-id";
import { getDb } from "@/lib/db";
import { insertExecutiveAgentAuditLog } from "@/lib/executive-agent/executive-agent-audit";
import { buildPendingClientsClaudeHandoff } from "@/lib/executive-agent/pending-clients-handoff";
import { listPendingClientsQueue } from "@/lib/executive-agent/pending-clients-queue";
import { getPendingAccounts } from "@/lib/executive-agent/executive-agent-tools";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/executive-agent/pending-clients
 * Admin-only safe queue for Executive Agent / Claude handoff. Never returns secrets.
 */
export async function GET(req: NextRequest) {
  const adminUserId = await getExecutiveAdminUserId(req);
  if (adminUserId == null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limitRaw = req.nextUrl.searchParams.get("limit");
  const limit = limitRaw ? Number.parseInt(limitRaw, 10) : 50;
  const includeHandoff = req.nextUrl.searchParams.get("handoff") !== "0";

  try {
    const db = await getDb();
    const [pendingClients, pendingCounts] = await Promise.all([
      listPendingClientsQueue(db, limit),
      getPendingAccounts({ db, adminUserId, selectedClientId: null, selectedCampaignId: null }),
    ]);

    const claudeHandoff = includeHandoff
      ? buildPendingClientsClaudeHandoff(pendingClients, {
          pendingAllTime: pendingCounts.pendingAllTime,
          pendingApprox30d: pendingCounts.pendingApprox30d,
        })
      : undefined;

    await insertExecutiveAgentAuditLog(db, {
      id: randomUUID(),
      adminUserId,
      prompt: null,
      toolName: "pending_clients_queue",
      actionType: "queue_accessed",
      targetType: "platform",
      inputJson: JSON.stringify({ limit, includeHandoff }),
      outputJson: JSON.stringify({
        returned: pendingClients.length,
        pendingAllTime: pendingCounts.pendingAllTime,
      }),
      approvalStatus: "not_required",
    });

    return NextResponse.json(
      {
        pendingClients,
        counts: {
          pendingAllTime: pendingCounts.pendingAllTime,
          pendingApprox30d: pendingCounts.pendingApprox30d,
          returned: pendingClients.length,
        },
        ...(claudeHandoff ? { claudeHandoff } : {}),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "PENDING_CLIENTS_FAILED", message: msg }, { status: 500 });
  }
}
