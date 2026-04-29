import { NextRequest, NextResponse } from "next/server";
import { getMeetAvatarNfts } from "@/lib/meet/avatar-nfts/get-avatar-nfts";

function parseBool(param: string | null, defaultVal: boolean): boolean {
  if (param === null || param === "") return defaultVal;
  const v = param.toLowerCase();
  if (v === "false" || v === "0" || v === "no") return false;
  if (v === "true" || v === "1" || v === "yes") return true;
  return defaultVal;
}

function parseLimit(raw: string | null): number {
  const n = parseInt(String(raw ?? "20"), 10);
  if (Number.isNaN(n) || n < 1) return 20;
  return Math.min(n, 50);
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const walletAddress = searchParams.get("walletAddress")?.trim();
    const walletTypeRaw = searchParams.get("walletType")?.trim().toLowerCase();

    if (!walletAddress) {
      return NextResponse.json(
        { error: "walletAddress is required" },
        { status: 400 }
      );
    }

    if (walletTypeRaw !== "evm" && walletTypeRaw !== "phantom") {
      return NextResponse.json(
        { error: 'walletType must be "evm" or "phantom"' },
        { status: 400 }
      );
    }

    const walletType = walletTypeRaw as "evm" | "phantom";

    if (walletType === "evm" && !walletAddress.startsWith("0x")) {
      return NextResponse.json(
        { error: "walletAddress must be a 0x-prefixed EVM address when walletType is evm" },
        { status: 400 }
      );
    }

    const limit = parseLimit(searchParams.get("limit"));
    const includeHero = parseBool(searchParams.get("includeHero"), true);
    const includeMarketplace = parseBool(searchParams.get("includeMarketplace"), true);

    const body = await getMeetAvatarNfts({
      walletAddress,
      walletType,
      limit,
      includeHero,
      includeMarketplace,
    });

    return NextResponse.json(body);
  } catch (e) {
    console.error("[api/meet/avatar-nfts] GET error:", e);
    return NextResponse.json(
      { error: "Failed to load avatar NFTs" },
      { status: 500 }
    );
  }
}
