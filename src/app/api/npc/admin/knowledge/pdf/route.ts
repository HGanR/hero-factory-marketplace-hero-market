import { NextRequest, NextResponse } from "next/server";
import { extractText, getDocumentProxy } from "unpdf";
import { requireNpcAdminSession } from "@/lib/admin/require-npc-admin";
import { addKnowledge, getNpcRowByNpcId } from "@/lib/npc/db";

/** Admin-only PDF ingestion for existing NPC identity, not a cloned AI Agent. */
export async function POST(req: NextRequest) {
  if (!(await requireNpcAdminSession(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const form = await req.formData().catch(() => null);
  const npcId = String(form?.get("npcId") ?? "").trim();
  const file = form?.get("file");
  if (npcId !== "trust-advisor") return NextResponse.json({ error: "PDF intake is currently enabled only for Jarva." }, { status: 400 });
  if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".pdf") || file.type && file.type !== "application/pdf")
    return NextResponse.json({ error: "A PDF file is required." }, { status: 400 });
  if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: "PDF exceeds 10 MB." }, { status: 413 });
  const row = await getNpcRowByNpcId(npcId);
  if (!row) return NextResponse.json({ error: "Jarva is not registered." }, { status: 404 });
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (String.fromCharCode(...bytes.slice(0, 5)) !== "%PDF-") return NextResponse.json({ error: "Invalid PDF signature." }, { status: 400 });
    const pdf = await getDocumentProxy(bytes);
    const extracted = await extractText(pdf, { mergePages: false });
    const pages = Array.isArray(extracted.text) ? extracted.text : [String(extracted.text ?? "")];
    const entries = pages.flatMap((page, index) => {
      const clean = String(page).replace(/\u0000/g, "").trim();
      if (!clean) return [];
      const chunks: { topic: string; keywords: string[]; content: string; priority: number; category: "general" }[] = [];
      for (let start = 0; start < clean.length; start += 3500) {
        chunks.push({
          topic: file.name + " — page " + (index + 1),
          keywords: ["Jarva", "legal reference", file.name],
          content: "Source document: " + file.name + "\nPage: " + (index + 1) + "\nVerification: unverified uploaded reference; confirm current law independently.\n\n" + clean.slice(start, start + 3500),
          priority: 5,
          category: "general",
        });
      }
      return chunks;
    });
    if (!entries.length) return NextResponse.json({ error: "No selectable text found. Scanned PDFs require OCR." }, { status: 422 });
    if (entries.length > 200) return NextResponse.json({ error: "Document exceeds 200 knowledge chunks; split it before uploading." }, { status: 413 });
    await addKnowledge(row.id, entries);
    return NextResponse.json({ success: true, fileName: file.name, pages: pages.length, chunks: entries.length });
  } catch (error) {
    console.error("Jarva PDF ingestion failed", error);
    return NextResponse.json({ error: "Unable to extract PDF text." }, { status: 422 });
  }
}
