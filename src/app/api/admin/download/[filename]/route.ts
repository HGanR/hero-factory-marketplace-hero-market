import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { verifyToken } from "@/lib/auth";
import {
  BESU_ADMIN_DIR,
  BESU_ADMIN_FILE_SET,
  contentTypeForFilename,
  isSafeDownloadName,
} from "@/lib/besuBundle";

export async function GET(request: NextRequest, context: { params: Promise<{ filename: string }> }) {
  const { filename } = await context.params;

  // Server-side admin protection (matches existing admin APIs)
  const token = request.cookies.get("admin-token")?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const decoded = verifyToken(token);
  if (!decoded?.isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isSafeDownloadName(filename)) {
    return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
  }

  if (!BESU_ADMIN_FILE_SET.has(filename)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const filePath = path.join(BESU_ADMIN_DIR, filename);
  try {
    const buf = await fs.readFile(filePath);
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": contentTypeForFilename(filename),
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, max-age=0, must-revalidate",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}



