import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { requireUserId } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { marketplaceUsers } from "@/lib/db/schema";
import { mysqlTruthy } from "@/lib/mysqlTruthy";
import { serverUploadExecutiveInboxFile } from "@/lib/executive-agent/executive-inbox-upload-server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const userId = requireUserId(req);
    const db = await getDb();
    const [u] = await db.select().from(marketplaceUsers).where(eq(marketplaceUsers.id, userId)).limit(1);
    if (!u || !mysqlTruthy(u.isApproved)) {
      return NextResponse.json({ error: "NOT_APPROVED" }, { status: 403 });
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof Blob) || file.size <= 0) {
      return NextResponse.json({ error: "MISSING_FILE" }, { status: 400 });
    }
    const blob = file as Blob;
    const asFile = new File([blob], file instanceof File && file.name ? file.name : "upload", {
      type: blob.type || "application/octet-stream",
    });

    const attachment = await serverUploadExecutiveInboxFile(asFile);
    return NextResponse.json({ ok: true, attachment });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (msg === "MISSING_FILE") return NextResponse.json({ error: "MISSING_FILE" }, { status: 400 });
    if (msg === "FILE_TOO_LARGE") return NextResponse.json({ error: "FILE_TOO_LARGE" }, { status: 400 });
    if (msg === "UNSUPPORTED_TYPE") return NextResponse.json({ error: "UNSUPPORTED_TYPE" }, { status: 400 });
    if (msg === "SITE_PROJECT_INVALID") {
      return NextResponse.json(
        {
          error: "SITE_PROJECT_INVALID",
          message:
            "ZIP must be a Site Builder Vercel/Next.js export (package.json + app/) or include site.builder-schema.json.",
        },
        { status: 400 },
      );
    }
    console.error("[executive-inbox/upload]", msg);
    return NextResponse.json({ error: "UPLOAD_FAILED", message: msg }, { status: 500 });
  }
}
