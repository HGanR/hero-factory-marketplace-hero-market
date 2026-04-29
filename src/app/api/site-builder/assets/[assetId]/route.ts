import { NextResponse } from "next/server";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { getAuthedUserId } from "@/lib/api/auth";
import { siteBuilderAssetAbsoluteDir } from "@/lib/site-builder/site-builder-asset-paths";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ assetId: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const userId = await getAuthedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const assetId = (await ctx.params).assetId?.trim();
  if (!assetId || !/^[0-9a-f-]{36}$/i.test(assetId)) {
    return NextResponse.json({ error: "Invalid asset" }, { status: 400 });
  }

  const base = path.join(siteBuilderAssetAbsoluteDir(), String(userId));
  const exts = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".mp4"];
  let hit: string | null = null;
  for (const e of exts) {
    const p = path.join(base, `${assetId}${e}`);
    try {
      await stat(p);
      hit = p;
      break;
    } catch {
      /* try next */
    }
  }
  if (!hit) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const lower = hit.toLowerCase();
  const ct = lower.endsWith(".png")
    ? "image/png"
    : lower.endsWith(".webp")
      ? "image/webp"
      : lower.endsWith(".gif")
        ? "image/gif"
        : lower.endsWith(".mp4")
          ? "video/mp4"
          : "image/jpeg";

  const buf = await readFile(hit);
  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": ct,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
