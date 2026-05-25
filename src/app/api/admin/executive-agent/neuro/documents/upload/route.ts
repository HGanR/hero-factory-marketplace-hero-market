import { NextRequest, NextResponse } from "next/server";
import { getExecutiveAdminUserId } from "@/lib/admin/get-executive-admin-user-id";
import { getDb } from "@/lib/db";
import { indexNeuroDocumentFromBuffer } from "@/lib/executive-agent/neuro/neuro-indexing-service";
import { insertNeuroDocument } from "@/lib/executive-agent/neuro/neuro-store";
import {
  inferNeuroSourceType,
  isNeuroAssignedAgent,
  isNeuroSubjectArea,
} from "@/lib/executive-agent/neuro/neuro-types";
import {
  resolveNeuroUploadMetadata,
  uploadNeuroSourceFile,
} from "@/lib/executive-agent/neuro/neuro-upload-server";

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
    const fileName = file instanceof File && file.name ? file.name : "upload";
    const asFile = new File([file], fileName, { type: file.type || "application/octet-stream" });

    const title = typeof form.get("title") === "string" ? form.get("title") : null;
    const subjectRaw = typeof form.get("subjectArea") === "string" ? form.get("subjectArea") : null;
    const agentRaw = typeof form.get("assignedAgent") === "string" ? form.get("assignedAgent") : null;
    const subjectArea = subjectRaw && isNeuroSubjectArea(subjectRaw) ? subjectRaw : null;
    const assignedAgent = agentRaw && isNeuroAssignedAgent(agentRaw) ? agentRaw : null;

    const meta = resolveNeuroUploadMetadata({ title, fileName, subjectArea, assignedAgent });
    const { storageUri, buffer } = await uploadNeuroSourceFile(asFile);
    const sourceType = inferNeuroSourceType(fileName, asFile.type);

    const db = await getDb();
    const documentId = await insertNeuroDocument(db, {
      adminUserId,
      title: meta.title,
      fileName,
      mimeType: asFile.type || "application/octet-stream",
      sizeBytes: asFile.size,
      storageUri,
      assignedAgent: meta.assignedAgent,
      subjectArea: meta.subjectArea,
      sourceType,
      status: "uploaded",
    });

    void indexNeuroDocumentFromBuffer(db, {
      adminUserId,
      documentId,
      buffer,
      sourceType,
      fileName,
    }).catch((e) => console.error("[neuro upload index]", e));

    return NextResponse.json({ ok: true, documentId, status: "processing" }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "MISSING_FILE") return NextResponse.json({ error: "MISSING_FILE" }, { status: 400 });
    if (msg === "FILE_TOO_LARGE") return NextResponse.json({ error: "FILE_TOO_LARGE" }, { status: 400 });
    if (msg === "UNSUPPORTED_TYPE") return NextResponse.json({ error: "UNSUPPORTED_TYPE" }, { status: 400 });
    console.error("[neuro/documents/upload]", msg);
    return NextResponse.json({ error: "UPLOAD_FAILED", message: msg }, { status: 500 });
  }
}
