import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { aiAgents } from "@/lib/db/schema";
import { canAccessAgent } from "@/lib/agents/agent-access";

const MAX_BYTES = 512 * 1024;
const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  if (!id?.trim()) return NextResponse.json({ error: "id required" }, { status: 400 });
  if (!(await canAccessAgent(id, userId))) {
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
  const avatarImageUrl = `data:${mime};base64,${buf.toString("base64")}`;
  const avatarAltText = String(form.get("altText") ?? "").trim().slice(0, 160) || "AI agent avatar";

  const db = await getDb();
  await db
    .update(aiAgents)
    .set({ avatarImageUrl, avatarAltText, updatedAt: new Date() })
    .where(and(eq(aiAgents.id, id), eq(aiAgents.userId, userId)));

  return NextResponse.json({ avatarImageUrl, avatarAltText });
}
