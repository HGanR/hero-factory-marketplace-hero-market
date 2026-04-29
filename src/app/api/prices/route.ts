import "server-only";

import { NextResponse } from "next/server";

type PricesResponse = {
  ts: number;
  usd: {
    ETH: number;
    MATIC: number;
    SOL: number;
    XRP: number;
  };
};

let _cache: PricesResponse | null = null;
let _cacheAt = 0;
const TTL_MS = 60_000;

async function fetchJsonWithTimeout(url: string, ms: number) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try {
    const res = await fetch(url, {
      headers: { accept: "application/json" },
      signal: ac.signal,
      cache: "no-store",
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
    return text ? JSON.parse(text) : null;
  } finally {
    clearTimeout(t);
  }
}

export async function GET() {
  const now = Date.now();
  if (_cache && now - _cacheAt < TTL_MS) {
    return NextResponse.json(_cache);
  }

  // CoinGecko simple price (no key)
  // ids: ethereum, matic-network, solana, ripple
  const url =
    "https://api.coingecko.com/api/v3/simple/price" +
    "?ids=ethereum,matic-network,solana,ripple&vs_currencies=usd";

  try {
    const data = await fetchJsonWithTimeout(url, 8000);
    const eth = Number(data?.ethereum?.usd);
    const matic = Number(data?.["matic-network"]?.usd);
    const sol = Number(data?.solana?.usd);
    const xrp = Number(data?.ripple?.usd);

    if (![eth, matic, sol, xrp].every((n) => Number.isFinite(n) && n > 0)) {
      throw new Error("Invalid price feed response");
    }

    _cache = {
      ts: now,
      usd: { ETH: eth, MATIC: matic, SOL: sol, XRP: xrp },
    };
    _cacheAt = now;

    return NextResponse.json(_cache);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Price feed error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}













