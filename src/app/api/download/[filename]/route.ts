import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import {
  BESU_PUBLIC_DIR,
  BESU_PUBLIC_FILE_SET,
  contentTypeForFilename,
  isSafeDownloadName,
} from "@/lib/besuBundle";

export async function GET(_request: NextRequest, context: { params: Promise<{ filename: string }> }) {
  const { filename } = await context.params;

  if (!isSafeDownloadName(filename)) {
    return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
  }

  if (!BESU_PUBLIC_FILE_SET.has(filename)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const filePath = path.join(BESU_PUBLIC_DIR, filename);
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



