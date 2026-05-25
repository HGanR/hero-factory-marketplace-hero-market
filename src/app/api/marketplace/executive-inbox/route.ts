import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { requireUserId } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { marketplaceUsers } from "@/lib/db/schema";
import { mysqlTruthy } from "@/lib/mysqlTruthy";
import {
  collectExecutiveInboxUserIds,
  fetchMarketplaceUserDirectory,
  insertUserToExecutiveMessage,
  listDepartmentMessagesForMarketplaceUser,
} from "@/lib/executive-agent/executive-department-inbox-store";
import {
  serializeExecutiveInboxAttachments,
  validateExecutiveInboxAttachmentsArray,
} from "@/lib/executive-agent/executive-inbox-attachments";

export const dynamic = "force-dynamic";

const PostSchema = z
  .object({
    bodyText: z.string().max(20_000).default(""),
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
  try {
    const userId = requireUserId(req);
    const db = await getDb();
    const [u] = await db.select().from(marketplaceUsers).where(eq(marketplaceUsers.id, userId)).limit(1);
    if (!u || !mysqlTruthy(u.isApproved)) {
      return NextResponse.json({ error: "NOT_APPROVED" }, { status: 403 });
    }
    const messages = await listDepartmentMessagesForMarketplaceUser(db, userId, 100);
    const directory = await fetchMarketplaceUserDirectory(db, collectExecutiveInboxUserIds(messages));
    return NextResponse.json({ messages, viewerId: userId, directory });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: "LIST_FAILED", message: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = requireUserId(req);
    const body = PostSchema.parse(await req.json());
    const db = await getDb();
    const [u] = await db.select().from(marketplaceUsers).where(eq(marketplaceUsers.id, userId)).limit(1);
    if (!u || !mysqlTruthy(u.isApproved)) {
      return NextResponse.json({ error: "NOT_APPROVED" }, { status: 403 });
    }

    let attachmentsJson: string | null = null;
    if (body.attachments?.length) {
      const validated = validateExecutiveInboxAttachmentsArray(body.attachments);
      if (!validated) {
        return NextResponse.json({ error: "INVALID_ATTACHMENTS" }, { status: 400 });
      }
      attachmentsJson = serializeExecutiveInboxAttachments(validated);
    }

    const id = await insertUserToExecutiveMessage(
      db,
      userId,
      body.bodyText.trim(),
      { channel: "marketplace" },
      attachmentsJson,
    );
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    if (e instanceof z.ZodError) {
      const empty = e.issues.some((i) => i.message === "EMPTY_MESSAGE");
      return NextResponse.json(
        { error: empty ? "EMPTY_MESSAGE" : "INVALID_REQUEST", issues: e.flatten() },
        { status: 400 },
      );
    }
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: "SEND_FAILED", message: msg }, { status: 500 });
  }
}
