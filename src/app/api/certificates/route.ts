import { NextRequest, NextResponse } from "next/server";
import { getConnection } from "@/lib/db";

import { engineRouteActor, requireSameOrigin, EngineAccessError, VERIFIED_CERTIFICATE_WALLET_SQL, type EngineRouteActor } from "@/lib/security/engine-route-access";

export const dynamic = "force-dynamic";
const privateHeaders = { "Cache-Control": "private, no-store", "Vary": "Cookie" };

async function requireWalletAccess(actor: EngineRouteActor, wallet: string, conn: Awaited<ReturnType<typeof getConnection>>) {
  if (actor.admin) return;
  const [rows] = await conn.execute(VERIFIED_CERTIFICATE_WALLET_SQL, [actor.userId, wallet]);
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new EngineAccessError("A verified wallet link belonging to this account is required", 403);
  }
}
function errorResponse(error: unknown) {
  if (error instanceof EngineAccessError) return NextResponse.json({ error: error.message }, { status: error.status, headers: privateHeaders });
  return NextResponse.json({ error: "Certificate operation unavailable" }, { status: 503, headers: privateHeaders });
}

export async function GET(req: NextRequest) {
  try {
    const actor = await engineRouteActor(req);
    const wallet = req.nextUrl.searchParams.get("wallet")?.toLowerCase();
    if (!wallet) {
      return NextResponse.json({ error: "wallet required" }, { status: 400 });
    }

    const conn = await getConnection();
    await requireWalletAccess(actor, wallet, conn);

    const [rows] = await conn.execute(
      "SELECT id, wallet_address, asset_address_url, seal_data, watermark_data, qr_data, barcode_data, notice_qr_data, render_data, certificate_json, created_at FROM dashboard_certificates WHERE wallet_address = ? ORDER BY created_at DESC",
      [wallet]
    );

    return NextResponse.json({ ok: true, items: rows }, { headers: privateHeaders });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await engineRouteActor(req);
    requireSameOrigin(req);
    const body = await req.json();
    const {
      walletAddress,
      assetAddressUrl,
      sealDataUrl,
      watermarkDataUrl,
      qrDataUrl,
      barcodeDataUrl,
      noticeQrDataUrl,
      renderDataUrl,
      certificateJson,
    } = body || {};

    if (!walletAddress || typeof walletAddress !== "string") {
      return NextResponse.json({ error: "walletAddress is required" }, { status: 400 });
    }

    if (!sealDataUrl || !watermarkDataUrl || !qrDataUrl || !barcodeDataUrl || !noticeQrDataUrl) {
      return NextResponse.json({ error: "All images (seal, watermark, qr, barcode, noticeQr) are required" }, { status: 400 });
    }

    const conn = await getConnection();
    await requireWalletAccess(actor, walletAddress.toLowerCase(), conn);

    await conn.execute(
      "INSERT INTO dashboard_certificates (wallet_address, asset_address_url, seal_data, watermark_data, qr_data, barcode_data, notice_qr_data, render_data, certificate_json) VALUES (?,?,?,?,?,?,?,?,?)",
      [
        walletAddress.toLowerCase(),
        assetAddressUrl ?? "",
        sealDataUrl,
        watermarkDataUrl,
        qrDataUrl,
        barcodeDataUrl,
        noticeQrDataUrl,
        renderDataUrl ?? null,
        typeof certificateJson === "string" ? certificateJson : null,
      ]
    );

    return NextResponse.json({ ok: true }, { headers: privateHeaders });
  } catch (err) {
    return errorResponse(err);
  }
}

