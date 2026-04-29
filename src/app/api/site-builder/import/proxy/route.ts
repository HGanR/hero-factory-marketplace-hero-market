import { NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { isBlockedHost } from "@/lib/site-builder/site-import/fetch-remote-html";

const MAX_BYTES = 4_000_000;

/**
 * Authenticated image proxy for import workflows (reduces some hotlink breakages).
 * Only image/* responses are returned; HTML and non-http(s) URLs are rejected.
 */
export async function GET(req: Request) {
  const userId = await getAuthedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const raw = new URL(req.url).searchParams.get("url")?.trim() ?? "";
  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }
  if (target.protocol !== "http:" && target.protocol !== "https:") {
    return NextResponse.json({ error: "Unsupported protocol" }, { status: 400 });
  }
  if (isBlockedHost(target.hostname)) {
    return NextResponse.json({ error: "Host not allowed" }, { status: 403 });
  }

  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 20_000);
  try {
    const res = await fetch(target.toString(), {
      method: "GET",
      redirect: "follow",
      signal: ac.signal,
      headers: {
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        "User-Agent": "HeroFactorySiteBuilderImportProxy/1.0 (+https://hero.factory)",
      },
    });
    clearTimeout(t);
    if (!res.ok) {
      return NextResponse.json({ error: `Upstream ${res.status}` }, { status: 422 });
    }
    const ct = res.headers.get("content-type") || "";
    if (!/^image\//i.test(ct)) {
      return NextResponse.json({ error: "Not an image" }, { status: 422 });
    }
    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) {
      return NextResponse.json({ error: "Image too large" }, { status: 422 });
    }
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": ct.split(";")[0]!.trim(),
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (e) {
    clearTimeout(t);
    const msg = e instanceof Error ? e.message : "Fetch failed";
    return NextResponse.json({ error: msg.includes("abort") ? "Timeout" : msg }, { status: 422 });
  }
}
