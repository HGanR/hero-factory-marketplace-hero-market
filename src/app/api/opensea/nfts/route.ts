import { NextRequest, NextResponse } from "next/server";

/**
 * OpenSea API Route
 * Fetches NFTs from OpenSea for a given wallet address
 */

const OPENSEA_API_KEY = process.env.OPENSEA_API_KEY || "";

interface OpenSeaNFT {
  identifier: string;
  collection: string;
  contract: string;
  token_standard: string;
  name: string;
  description: string;
  image_url: string;
  metadata_url: string;
  opensea_url: string;
  updated_at: string;
  is_disabled: boolean;
  is_nsfw: boolean;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const address = searchParams.get("address");
    const chain = searchParams.get("chain") || "ethereum"; // ethereum or polygon
    const limit = parseInt(searchParams.get("limit") || "20");

    if (!address) {
      return NextResponse.json(
        { ok: false, error: { code: "BAD_REQUEST", message: "Address parameter is required" } },
        { status: 400 }
      );
    }

    // OpenSea API v2 endpoint
    const chainParam = chain === "polygon" ? "matic" : "ethereum";
    const url = `https://api.opensea.io/api/v2/chain/${chainParam}/account/${address}/nfts?limit=${limit}`;

    const headers: HeadersInit = {
      "Accept": "application/json",
    };

    if (OPENSEA_API_KEY) {
      headers["X-API-KEY"] = OPENSEA_API_KEY;
    }

    const response = await fetch(url, {
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenSea API error:", response.status, errorText);
      
      // Return empty array if API key is missing or rate limited
      if (response.status === 401 || response.status === 403 || response.status === 429) {
        return NextResponse.json({
          ok: true,
          nfts: [],
          message: "OpenSea API key not configured or rate limited",
        });
      }

      return NextResponse.json(
        { ok: false, error: { code: "OPENSEA_ERROR", message: `OpenSea API error: ${response.status}` } },
        { status: response.status }
      );
    }

    const data = await response.json();
    const nfts: OpenSeaNFT[] = data.nfts || [];

    // Transform OpenSea NFTs to our format
    const transformedNFTs = nfts.map((nft) => ({
      id: `${nft.contract}-${nft.identifier}`,
      tokenId: nft.identifier,
      name: nft.name || `#${nft.identifier}`,
      description: nft.description || "",
      imageUrl: nft.image_url || "",
      chain: chain,
      contractAddress: nft.contract,
      collection: nft.collection,
      openseaUrl: nft.opensea_url,
      tokenStandard: nft.token_standard,
    }));

    return NextResponse.json({
      ok: true,
      nfts: transformedNFTs,
      count: transformedNFTs.length,
    });
  } catch (error: any) {
    console.error("OpenSea fetch error:", error);
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: error?.message || "Failed to fetch OpenSea NFTs" } },
      { status: 500 }
    );
  }
}
