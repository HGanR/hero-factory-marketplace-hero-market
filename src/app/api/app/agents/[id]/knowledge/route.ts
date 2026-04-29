import { NextRequest, NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { extractText, getDocumentProxy } from "unpdf";
import { getDb } from "@/lib/db";
import { requireUserId } from "@/lib/auth";
import { ensureAgentTables } from "@/lib/db/agents-ensure";
import { aiAgents, aiAgentKnowledgeItems } from "@/lib/db/schema";
import { canAccessAgent } from "@/lib/agents/agent-access";
import { invokeLlmForAgent } from "@/lib/npc/llm";
import { invokeNpcLlm } from "@/lib/npc/llm";

type Params = { params: Promise<{ id: string }> };

const MAX_CONTENT_LENGTH = 60_000; // TEXT column safe limit

/** GET: List knowledge items for an agent */
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const userId = requireUserId(req);
    const { id: agentId } = await params;
    if (!agentId) return NextResponse.json({ error: "agentId required" }, { status: 400 });

    const db = await getDb();
    await ensureAgentTables();

    const canAccess = await canAccessAgent(agentId, userId);
    if (!canAccess) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const items = await db
      .select({
        id: aiAgentKnowledgeItems.id,
        type: aiAgentKnowledgeItems.type,
        contentOrPointer: aiAgentKnowledgeItems.contentOrPointer,
        sortOrder: aiAgentKnowledgeItems.sortOrder,
        createdAt: aiAgentKnowledgeItems.createdAt,
      })
      .from(aiAgentKnowledgeItems)
      .where(eq(aiAgentKnowledgeItems.agentId, agentId))
      .orderBy(asc(aiAgentKnowledgeItems.sortOrder), asc(aiAgentKnowledgeItems.createdAt));

    const parsed = items.map((i) => {
      let displayName = i.id.slice(0, 8);
      if (!i.contentOrPointer) return { ...i, displayName };
      try {
        const j = JSON.parse(i.contentOrPointer as string) as Record<string, unknown>;
        if (i.type === "pdf" && typeof j?.fileName === "string") displayName = j.fileName;
        else if (i.type === "note") displayName = (j?.title as string) || (j?.content as string)?.slice(0, 40) || "Note";
        else if (i.type === "url" && typeof j?.url === "string") displayName = j.url;
        else if (i.type === "faq" && typeof j?.title === "string") displayName = j.title;
        else if (i.type === "web_crawler" && typeof j?.url === "string") displayName = j.url;
        else if (i.type === "tables" && typeof j?.title === "string") displayName = j.title;
      } catch {
        /* ignore */
      }
      return { ...i, displayName };
    });
    return NextResponse.json({ items: parsed });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    if (msg === "Unauthorized") return NextResponse.json({ error: msg }, { status: 401 });
    console.error("agents knowledge GET error:", err);
    return NextResponse.json({ error: "Failed to fetch knowledge" }, { status: 500 });
  }
}

/** POST: Add knowledge – note/url (JSON) or PDF (form) */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const userId = requireUserId(req);
    const { id: agentId } = await params;
    if (!agentId) return NextResponse.json({ error: "agentId required" }, { status: 400 });

    const db = await getDb();
    await ensureAgentTables();

    const canAccess = await canAccessAgent(agentId, userId);
    if (!canAccess) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const body = await req.json().catch(() => ({}));
      const type = String(body?.type || "note").toLowerCase();
      if (type === "note") {
        const content = String(body?.content ?? "").trim();
        if (!content) return NextResponse.json({ error: "content required for note" }, { status: 400 });
        const title = typeof body?.title === "string" ? body.title.trim() : null;
        const truncated =
          content.length > MAX_CONTENT_LENGTH ? content.slice(0, MAX_CONTENT_LENGTH) + "\n\n[…truncated…]" : content;
        const id = crypto.randomUUID();
        const contentOrPointer = JSON.stringify({ content: truncated, title: title || undefined });
        const existing = await db
          .select({ sortOrder: aiAgentKnowledgeItems.sortOrder })
          .from(aiAgentKnowledgeItems)
          .where(eq(aiAgentKnowledgeItems.agentId, agentId));
        const sortOrder = existing.length > 0 ? Math.max(...existing.map((r) => r.sortOrder ?? 0)) + 1 : 0;
        await db.insert(aiAgentKnowledgeItems).values({
          id,
          agentId,
          type: "note",
          contentOrPointer,
          sortOrder,
        });
        return NextResponse.json(
          { id, type: "note", title: title || "Note", charCount: truncated.length },
          { status: 201 }
        );
      }
      if (type === "url") {
        const url = String(body?.url ?? "").trim();
        if (!url) return NextResponse.json({ error: "url required" }, { status: 400 });
        const id = crypto.randomUUID();
        const contentOrPointer = JSON.stringify({ url });
        const existing = await db
          .select({ sortOrder: aiAgentKnowledgeItems.sortOrder })
          .from(aiAgentKnowledgeItems)
          .where(eq(aiAgentKnowledgeItems.agentId, agentId));
        const sortOrder = existing.length > 0 ? Math.max(...existing.map((r) => r.sortOrder ?? 0)) + 1 : 0;
        await db.insert(aiAgentKnowledgeItems).values({
          id,
          agentId,
          type: "url",
          contentOrPointer,
          sortOrder,
        });
        return NextResponse.json({ id, type: "url", url }, { status: 201 });
      }
      if (type === "faq") {
        const title = String(body?.title ?? "FAQs").trim();
        const items = Array.isArray(body?.items) ? body.items : [];
        type FaqPair = { q: string; a: string };
        const pairs: FaqPair[] = items
          .filter((p: unknown): p is { q?: unknown; a?: unknown } => p != null && typeof p === "object" && "q" in p && "a" in p)
          .map((p: { q?: unknown; a?: unknown }) => ({
            q: String(p?.q ?? "").trim(),
            a: String(p?.a ?? "").trim(),
          }))
          .filter((p: { q: string; a: string }): p is FaqPair => Boolean(p.q && p.a));
        if (!pairs.length) return NextResponse.json({ error: "At least one Q&A pair required" }, { status: 400 });
        const text = pairs.map((p: FaqPair) => `Q: ${p.q}\nA: ${p.a}`).join("\n\n");
        const truncated = text.length > MAX_CONTENT_LENGTH ? text.slice(0, MAX_CONTENT_LENGTH) + "\n\n[…truncated…]" : text;
        const id = crypto.randomUUID();
        const contentOrPointer = JSON.stringify({ title, items: pairs, extractedText: truncated });
        const existing = await db
          .select({ sortOrder: aiAgentKnowledgeItems.sortOrder })
          .from(aiAgentKnowledgeItems)
          .where(eq(aiAgentKnowledgeItems.agentId, agentId));
        const sortOrder = existing.length > 0 ? Math.max(...existing.map((r) => r.sortOrder ?? 0)) + 1 : 0;
        await db.insert(aiAgentKnowledgeItems).values({
          id,
          agentId,
          type: "faq",
          contentOrPointer,
          sortOrder,
        });
        return NextResponse.json({ id, type: "faq", title, count: pairs.length }, { status: 201 });
      }
      if (type === "web_crawler") {
        const url = String(body?.url ?? "").trim();
        if (!url) return NextResponse.json({ error: "url required for web crawler" }, { status: 400 });
        let fetchedText = "";
        try {
          const res = await fetch(url, {
            headers: { "User-Agent": "TrooAI-Agent-Bot/1.0" },
            signal: AbortSignal.timeout(15000),
          });
          if (res.ok) {
            const html = await res.text();
            fetchedText = html
              .replace(/<script[\s\S]*?<\/script>/gi, "")
              .replace(/<style[\s\S]*?<\/style>/gi, "")
              .replace(/<[^>]+>/g, " ")
              .replace(/\s+/g, " ")
              .trim()
              .slice(0, 30_000);
          }
        } catch (e) {
          console.warn("Web crawl failed:", e);
          return NextResponse.json({ error: "Failed to fetch URL. The page may be blocking requests or unreachable." }, { status: 400 });
        }
        if (!fetchedText.trim()) {
          return NextResponse.json({ error: "No text could be extracted from this URL." }, { status: 400 });
        }

        // Generate FAQs from page content using LLM
        let pairs: { q: string; a: string }[] = [];
        const llmContent = await invokeLlmForAgent(
          [
            {
              role: "system",
              content: `You are a helpful assistant that extracts FAQ (question-answer pairs) from web page content.
Output ONLY a valid JSON array with no other text. Format: [{"q": "question text", "a": "answer text"}, ...]
Extract 5-15 of the most useful Q&A pairs that would help an AI agent answer visitor questions. Be concise.`,
            },
            {
              role: "user",
              content: `Extract FAQs from this web page content:\n\n${fetchedText.slice(0, 20_000)}`,
            },
          ],
          null
        );

        if (llmContent) {
          try {
            const raw = llmContent.replace(/```[\s\S]*?```/g, "").trim();
            const match = raw.match(/\[[\s\S]*\]/);
            const parsed = match ? JSON.parse(match[0]) : JSON.parse(raw);
            if (Array.isArray(parsed)) {
              pairs = parsed
                .filter((p: unknown) => p && typeof p === "object" && ("q" in p || "question" in p) && ("a" in p || "answer" in p))
                .map((p: Record<string, unknown>) => ({
                  q: String(p?.q ?? p?.question ?? "").trim(),
                  a: String(p?.a ?? p?.answer ?? "").trim(),
                }))
                .filter((p: { q: string; a: string }) => p.q && p.a)
                .slice(0, 25);
            }
          } catch (e) {
            console.warn("FAQ JSON parse failed:", e);
          }
        }

        if (!pairs.length) {
          // Fallback: store raw text as a note so agent still has the content
          let hostname = "page";
          try {
            hostname = new URL(url).hostname;
          } catch {
            /* ignore */
          }
          const fallbackTitle = `Content from ${hostname}`;
          const truncated = fetchedText.length > MAX_CONTENT_LENGTH
            ? fetchedText.slice(0, MAX_CONTENT_LENGTH) + "\n\n[…truncated…]"
            : fetchedText;
          const id = crypto.randomUUID();
          const contentOrPointer = JSON.stringify({
            content: truncated,
            title: fallbackTitle,
            sourceUrl: url,
          });
          const existing = await db
            .select({ sortOrder: aiAgentKnowledgeItems.sortOrder })
            .from(aiAgentKnowledgeItems)
            .where(eq(aiAgentKnowledgeItems.agentId, agentId));
          const sortOrder = existing.length > 0 ? Math.max(...existing.map((r) => r.sortOrder ?? 0)) + 1 : 0;
          await db.insert(aiAgentKnowledgeItems).values({
            id,
            agentId,
            type: "note",
            contentOrPointer,
            sortOrder,
          });
          return NextResponse.json({
            id,
            type: "note",
            title: fallbackTitle,
            note: "LLM not configured or FAQ extraction failed. Stored raw page content instead. Set NPC_LLM_ENDPOINT for automatic FAQ generation.",
          }, { status: 201 });
        }

        let hostname = "page";
        try {
          hostname = new URL(url).hostname;
        } catch {
          /* ignore */
        }
        const title = (body?.title as string)?.trim() || `FAQ from ${hostname}`;
        const text = pairs.map((p) => `Q: ${p.q}\nA: ${p.a}`).join("\n\n");
        const truncated = text.length > MAX_CONTENT_LENGTH ? text.slice(0, MAX_CONTENT_LENGTH) + "\n\n[…truncated…]" : text;
        const id = crypto.randomUUID();
        const contentOrPointer = JSON.stringify({
          title,
          items: pairs,
          extractedText: truncated,
          sourceUrl: url,
        });
        const existing = await db
          .select({ sortOrder: aiAgentKnowledgeItems.sortOrder })
          .from(aiAgentKnowledgeItems)
          .where(eq(aiAgentKnowledgeItems.agentId, agentId));
        const sortOrder = existing.length > 0 ? Math.max(...existing.map((r) => r.sortOrder ?? 0)) + 1 : 0;
        await db.insert(aiAgentKnowledgeItems).values({
          id,
          agentId,
          type: "faq",
          contentOrPointer,
          sortOrder,
        });
        return NextResponse.json({
          id,
          type: "faq",
          title,
          count: pairs.length,
          sourceUrl: url,
        }, { status: 201 });
      }
      if (type === "tables") {
        const title = String(body?.title ?? "Table").trim();
        const rows = Array.isArray(body?.rows) ? body.rows : [];
        const rawCsv = typeof body?.rawCsv === "string" ? body.rawCsv.trim() : "";
        if (!rows.length && !rawCsv) return NextResponse.json({ error: "Table data or rawCsv required" }, { status: 400 });
        const text = rawCsv || rows.map((r: unknown[]) => (Array.isArray(r) ? r.join(", ") : String(r))).join("\n");
        const truncated = text.length > MAX_CONTENT_LENGTH ? text.slice(0, MAX_CONTENT_LENGTH) + "\n\n[…truncated…]" : text;
        const id = crypto.randomUUID();
        const contentOrPointer = JSON.stringify({
          title,
          rows: rows.length ? rows : rawCsv.split("\n").map((line: string) => line.split(",").map((c: string) => c.trim())),
          extractedText: truncated,
        });
        const existing = await db
          .select({ sortOrder: aiAgentKnowledgeItems.sortOrder })
          .from(aiAgentKnowledgeItems)
          .where(eq(aiAgentKnowledgeItems.agentId, agentId));
        const sortOrder = existing.length > 0 ? Math.max(...existing.map((r) => r.sortOrder ?? 0)) + 1 : 0;
        await db.insert(aiAgentKnowledgeItems).values({
          id,
          agentId,
          type: "tables",
          contentOrPointer,
          sortOrder,
        });
        return NextResponse.json({ id, type: "tables", title }, { status: 201 });
      }
      return NextResponse.json({ error: "Unknown type; use note, url, faq, web_crawler, or tables" }, { status: 400 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: "PDF file or JSON body required" }, { status: 400 });
    }

    const name = (typeof file === "object" && "name" in file ? (file as File).name : "document.pdf") as string;
    if (!name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "Only PDF files are accepted" }, { status: 400 });
    }

    const buf = new Uint8Array(await file.arrayBuffer());
    let extracted: { totalPages: number; text: string | string[] };
    try {
      const pdf = await getDocumentProxy(buf);
      extracted = await extractText(pdf, { mergePages: true });
    } catch (e) {
      console.error("PDF extract error:", e);
      return NextResponse.json({ error: "Failed to extract text from PDF." }, { status: 500 });
    }

    const text = Array.isArray(extracted.text) ? extracted.text.join("\n") : (extracted.text ?? "");
    const content = (text ?? "").trim();
    if (!content) {
      return NextResponse.json({ error: "No text could be extracted from this PDF (may be image-only or empty)" }, { status: 400 });
    }

    const truncated = content.length > MAX_CONTENT_LENGTH
      ? content.slice(0, MAX_CONTENT_LENGTH) + "\n\n[…truncated…]"
      : content;

    const id = crypto.randomUUID();
    const type = "pdf";
    const contentOrPointer = JSON.stringify({
      fileName: name,
      extractedText: truncated,
      charCount: truncated.length,
    });

    const existing = await db
      .select({ sortOrder: aiAgentKnowledgeItems.sortOrder })
      .from(aiAgentKnowledgeItems)
      .where(eq(aiAgentKnowledgeItems.agentId, agentId));

    const sortOrder = existing.length > 0
      ? Math.max(...existing.map((r) => r.sortOrder ?? 0)) + 1
      : 0;

    await db.insert(aiAgentKnowledgeItems).values({
      id,
      agentId,
      type,
      contentOrPointer,
      sortOrder,
    });

    return NextResponse.json({
      id,
      type,
      fileName: name,
      charCount: truncated.length,
    }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    if (msg === "Unauthorized") return NextResponse.json({ error: msg }, { status: 401 });
    console.error("agents knowledge POST error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
