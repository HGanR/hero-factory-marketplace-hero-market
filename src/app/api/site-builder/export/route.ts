import archiver from "archiver";
import { NextResponse } from "next/server";
import { PassThrough } from "stream";
import { getAuthedUserId } from "@/lib/api/auth";
import { SiteSchemaDocument } from "@/lib/site-builder/schema";
import { buildDeploymentProjectFromSchema, type ProjectExportFile } from "@/lib/site-builder/site-builder-project-export";

function zipProjectFiles(files: ProjectExportFile[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const archive = archiver("zip", { zlib: { level: 9 } });
    const pass = new PassThrough();
    const chunks: Buffer[] = [];
    pass.on("data", (chunk: Buffer) => chunks.push(chunk));
    pass.on("end", () => resolve(Buffer.concat(chunks)));
    pass.on("error", reject);
    archive.on("error", reject);
    archive.pipe(pass);
    for (const f of files) {
      archive.append(f.content, { name: f.path });
    }
    void archive.finalize();
  });
}

export async function POST(req: Request) {
  const userId = await getAuthedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const raw = (body as { schemaJson?: unknown })?.schemaJson;
  const parsed = SiteSchemaDocument.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid schemaJson", issues: parsed.error.issues }, { status: 400 });
  }

  try {
    const files = await buildDeploymentProjectFromSchema(parsed.data, { userId });
    const buf = await zipProjectFiles(files);
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": 'attachment; filename="site-project.zip"',
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Export failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
