import "server-only";

import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const apiKey = (process.env.XUMM_API_KEY || "").trim();
  const apiSecret = (process.env.XUMM_API_SECRET || "").trim();
  if (!apiKey || !apiSecret) {
    return NextResponse.json(
      { error: "XUMM is not configured (set XUMM_API_KEY and XUMM_API_SECRET)." },
      { status: 500 }
    );
  }

  const uuid = req.nextUrl.searchParams.get("uuid") || "";
  if (!uuid) return NextResponse.json({ error: "Missing uuid" }, { status: 400 });

  try {
    const resp = await fetch(`https://xumm.app/api/v1/platform/payload/${encodeURIComponent(uuid)}`, {
      method: "GET",
      headers: {
        accept: "application/json",
        "X-API-Key": apiKey,
        "X-API-Secret": apiSecret,
      },
      cache: "no-store",
    });
    const txt = await resp.text();
    const data = txt ? JSON.parse(txt) : {};
    if (!resp.ok) {
      return NextResponse.json(
        { error: data?.message || data?.error || `XUMM HTTP ${resp.status}` },
        { status: 502 }
      );
    }

    const resolved = Boolean(data?.meta?.resolved);
    const signed = Boolean(data?.meta?.signed);
    const cancelled = Boolean(data?.meta?.cancelled);
    const txid = data?.response?.txid || data?.response?.transaction?.hash || null;

    return NextResponse.json({ uuid, resolved, signed, cancelled, txid, raw: data?.meta ? undefined : data });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to reach XUMM" },
      { status: 502 }
    );
  }
}













