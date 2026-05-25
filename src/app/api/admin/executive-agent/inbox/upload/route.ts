import { NextRequest, NextResponse } from "next/server";
import { getExecutiveAdminUserId } from "@/lib/admin/get-executive-admin-user-id";
import { serverUploadExecutiveInboxFile } from "@/lib/executive-agent/executive-inbox-upload-server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const adminUserId = await getExecutiveAdminUserId(req);
  if (adminUserId == null) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
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
    console.error("[admin executive-inbox/upload]", msg);
    return NextResponse.json({ error: "UPLOAD_FAILED", message: msg }, { status: 500 });
  }
}
