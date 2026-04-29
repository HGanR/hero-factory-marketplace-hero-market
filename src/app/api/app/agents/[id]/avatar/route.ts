import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { aiAgentSiteBindings, aiAgents } from "@/lib/db/schema";
import { canAccessAgent } from "@/lib/agents/agent-access";
import { parseWidgetBindingMetadata, mergeWidgetBindingMetadata } from "@/lib/widget/widget-binding-metadata";

const MAX_BYTES = 512 * 1024;
const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: agentId } = await ctx.params;
  if (!agentId?.trim()) return NextResponse.json({ error: "agentId required" }, { status: 400 });
  if (!(await canAccessAgent(agentId, userId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "file is required" }, { status: 400 });
  if (!ALLOWED.has((file.type || "").toLowerCase())) {
    return NextResponse.json({ error: "Unsupported image type" }, { status: 400 });
  }
  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length > MAX_BYTES) {
    return NextResponse.json({ error: "Image too large (max 512KB)" }, { status: 400 });
  }
  const mime = file.type.toLowerCase();
  const base64 = buf.toString("base64");
  const avatarImageUrl = `data:${mime};base64,${base64}`;
  const avatarAltText = String(form.get("altText") ?? "").trim().slice(0, 160) || "AI assistant avatar";

  const db = await getDb();
  await db
    .update(aiAgents)
    .set({ avatarImageUrl, avatarAltText, updatedAt: new Date() })
    .where(and(eq(aiAgents.id, agentId), eq(aiAgents.userId, userId)));

  const [binding] = await db
    .select({ id: aiAgentSiteBindings.id, metadata: aiAgentSiteBindings.metadata })
    .from(aiAgentSiteBindings)
    .where(eq(aiAgentSiteBindings.agentId, agentId))
    .limit(1);
  if (!binding) {
    return NextResponse.json({ error: "Bind the agent to a site first" }, { status: 400 });
  }
  const meta = parseWidgetBindingMetadata(binding.metadata);
  const merged = mergeWidgetBindingMetadata(meta, {
    widgetAppearance: {
      ...(meta.widgetAppearance ?? {}),
      avatarImageUrl,
      avatarAltText,
      avatarShape: "circle",
    },
  });
  await db
    .update(aiAgentSiteBindings)
    .set({ metadata: JSON.stringify(merged), updatedAt: new Date() })
    .where(and(eq(aiAgentSiteBindings.id, binding.id), eq(aiAgentSiteBindings.agentId, agentId)));

  return NextResponse.json({ avatarImageUrl });
}
