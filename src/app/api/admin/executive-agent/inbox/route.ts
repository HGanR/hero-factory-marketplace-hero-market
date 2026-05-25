import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getExecutiveAdminUserId } from "@/lib/admin/get-executive-admin-user-id";
import { getDb } from "@/lib/db";
import {
  collectExecutiveInboxUserIds,
  fetchMarketplaceUserDirectory,
  insertExecutiveBroadcast,
  insertExecutiveToUserMessage,
  listApprovedMarketplaceUsers,
  listDepartmentMessagesForExecutiveAdmin,
} from "@/lib/executive-agent/executive-department-inbox-store";
import {
  serializeExecutiveInboxAttachments,
  validateExecutiveInboxAttachmentsArray,
} from "@/lib/executive-agent/executive-inbox-attachments";

export const dynamic = "force-dynamic";

const PostSchema = z
  .object({
    bodyText: z.string().max(20_000).default(""),
    broadcast: z.boolean().optional(),
    toMarketplaceUserId: z.number().int().positive().optional(),
    metadata: z.record(z.string(), z.unknown()).optional().nullable(),
    attachments: z.array(z.unknown()).max(5).optional(),
  })
  .superRefine((data, ctx) => {
    const hasBody = data.bodyText.trim().length > 0;
    const hasAtt = (data.attachments?.length ?? 0) > 0;
    if (!hasBody && !hasAtt) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "EMPTY_MESSAGE" });
    }
  });

export async function GET(req: NextRequest) {
  const adminUserId = await getExecutiveAdminUserId(req);
  if (adminUserId == null) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const db = await getDb();
    const [messages, recipients] = await Promise.all([
      listDepartmentMessagesForExecutiveAdmin(db, 120),
      // Approved + active marketplace accounts for direct-message recipient picker (cap for UI performance).
      listApprovedMarketplaceUsers(db, 2500),
    ]);
    const directory = await fetchMarketplaceUserDirectory(db, collectExecutiveInboxUserIds(messages));
    return NextResponse.json({ messages, recipients, directory });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "LIST_FAILED", message: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const adminUserId = await getExecutiveAdminUserId(req);
  if (adminUserId == null) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = PostSchema.parse(await req.json());
    const db = await getDb();
    const meta = body.metadata ?? undefined;

    let attachmentsJson: string | null = null;
    if (body.attachments?.length) {
      const validated = validateExecutiveInboxAttachmentsArray(body.attachments);
      if (!validated) {
        return NextResponse.json({ error: "INVALID_ATTACHMENTS" }, { status: 400 });
      }
      attachmentsJson = serializeExecutiveInboxAttachments(validated);
    }

    if (body.broadcast) {
      const id = await insertExecutiveBroadcast(db, adminUserId, body.bodyText.trim(), meta, attachmentsJson);
      return NextResponse.json({ ok: true, id, kind: "executive_broadcast" });
    }
    if (body.toMarketplaceUserId) {
      const id = await insertExecutiveToUserMessage(
        db,
        adminUserId,
        body.toMarketplaceUserId,
        body.bodyText.trim(),
        meta,
        attachmentsJson,
      );
      return NextResponse.json({ ok: true, id, kind: "executive_to_user" });
    }
    return NextResponse.json({ error: "NEED_BROADCAST_OR_TARGET" }, { status: 400 });
  } catch (e) {
    if (e instanceof z.ZodError) {
      const empty = e.issues.some((i) => i.message === "EMPTY_MESSAGE");
      return NextResponse.json(
        { error: empty ? "EMPTY_MESSAGE" : "INVALID_REQUEST", issues: e.flatten() },
        { status: 400 },
      );
    }
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "SEND_FAILED", message: msg }, { status: 500 });
  }
}
