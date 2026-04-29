/**
 * POST /api/admin/oasis/elements/verify
 * Admin-only: HEAD each element's resolved URL; update isReady, lastVerifiedAt, lastError.
 * Keeps the generator's kit library clean—only ready assets are pickable.
 */
import { NextRequest, NextResponse } from "next/server";
import { eq, and, ne, isNotNull } from "drizzle-orm";
import { verifyToken } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { oasisWorldElements } from "@/lib/db/schema";
import { ensureOasisAssetColumns } from "@/lib/oasis/ensure-asset-columns";
import { resolveElementToAsset } from "@/lib/oasis/asset-resolver";

function requireAdmin(req: NextRequest) {
  const token = req.cookies.get("admin-token")?.value;
  if (!token) return null;
  const decoded = verifyToken(token);
  return decoded?.isAdmin ? decoded : null;
}

async function checkUrlReachable(absoluteUrl: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(absoluteUrl, { method: "HEAD", cache: "no-store" });
    if (res.ok) return { ok: true };
    return { ok: false, error: `${res.status}` };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const short = msg.length > 120 ? msg.slice(0, 120) + "…" : msg;
    return { ok: false, error: short };
  }
}

export async function POST(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const db = await getDb();
    await ensureOasisAssetColumns(db);

    const elements = await db
      .select({
        id: oasisWorldElements.id,
        name: oasisWorldElements.name,
        assetUri: oasisWorldElements.assetUri,
        assetBounds: oasisWorldElements.assetBounds,
        defaultScale: oasisWorldElements.defaultScale,
        colliderType: oasisWorldElements.colliderType,
        tags: oasisWorldElements.tags,
        resolvedUrl: oasisWorldElements.resolvedUrl,
      })
      .from(oasisWorldElements)
      .where(and(isNotNull(oasisWorldElements.assetUri), ne(oasisWorldElements.assetUri, "")));

    const now = new Date();
    let ready = 0;
    let notReady = 0;

    for (const el of elements) {
      if (!el.assetUri || (!el.assetUri.endsWith(".glb") && !el.assetUri.endsWith(".gltf") && !el.assetUri.startsWith("ipfs://"))) {
        await db
          .update(oasisWorldElements)
          .set({
            isReady: false,
            lastVerifiedAt: now,
            lastError: "unsupported format",
          })
          .where(eq(oasisWorldElements.id, el.id));
        notReady++;
        continue;
      }

      const resolved = resolveElementToAsset(el as any);
      const pathPart = resolved.url.startsWith("http") ? new URL(resolved.url).pathname : resolved.url;
      const baseUrl =
        process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const absolute = resolved.url.startsWith("http")
        ? resolved.url
        : `${baseUrl}${pathPart.startsWith("/") ? pathPart : `/${pathPart}`}`;

      const { ok, error } = await checkUrlReachable(absolute);

      await db
        .update(oasisWorldElements)
        .set({
          isReady: ok,
          lastVerifiedAt: now,
          lastError: ok ? null : (error || "unknown"),
        })
        .where(eq(oasisWorldElements.id, el.id));

      if (ok) ready++;
      else notReady++;
    }

    return NextResponse.json({
      ok: true,
      total: elements.length,
      ready,
      notReady,
      verifiedAt: now.toISOString(),
    });
  } catch (err) {
    console.error("[oasis/elements/verify]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Verification failed" },
      { status: 500 }
    );
  }
}
