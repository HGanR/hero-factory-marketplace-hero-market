import { NextRequest, NextResponse } from "next/server";

const OPENSEA_API_KEY = process.env.OPENSEA_API_KEY || "";

async function fetchOpenSea(url: string) {
  const headers: HeadersInit = { Accept: "application/json" };
  if (OPENSEA_API_KEY) headers["X-API-KEY"] = OPENSEA_API_KEY;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`OpenSea API ${res.status}: ${text || "Request failed"}`);
  }
  return res.json();
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get("slug");
    const limit = parseInt(searchParams.get("limit") || "40");

    if (!slug) {
      return NextResponse.json(
        { ok: false, error: { code: "BAD_REQUEST", message: "slug is required" } },
        { status: 400 }
      );
    }

    const collectionUrl = `https://api.opensea.io/api/v2/collection/${slug}`;
    const nftsUrl = `https://api.opensea.io/api/v2/collection/${slug}/nfts?limit=${limit}`;

    const [collectionRes, nftsRes] = await Promise.all([
      fetchOpenSea(collectionUrl),
      fetchOpenSea(nftsUrl),
    ]);

    const collection = collectionRes?.collection || collectionRes;
    const nfts = Array.isArray(nftsRes?.nfts) ? nftsRes.nfts : [];

    const normalizedNfts = nfts.map((nft: any) => {
      const contract = nft?.contract || nft?.contract_address || nft?.asset_contract?.address || "";
      const tokenId = String(nft?.identifier ?? nft?.token_id ?? "");
      const chain = nft?.chain || collection?.chain || "polygon";
      return {
        id: `${contract}-${tokenId}`,
        tokenId,
        name: nft?.name || `#${tokenId}`,
        description: nft?.description || "",
        imageUrl: nft?.image_url || nft?.imageUrl || "",
        chain,
        contractAddress: contract,
        collection: collection?.name || slug,
        openseaUrl: nft?.opensea_url || (contract && tokenId ? `https://opensea.io/assets/${contract}/${tokenId}` : ""),
        tokenStandard: nft?.token_standard || "ERC-721",
      };
    });

    return NextResponse.json({
      ok: true,
      collection: {
        name: collection?.name || slug,
        description: collection?.description || "",
        imageUrl: collection?.image_url || collection?.imageUrl || "",
        bannerImageUrl: collection?.banner_image_url || collection?.bannerImageUrl || "",
        chain: collection?.chain || "polygon",
        externalUrl: collection?.external_url || "",
        openseaUrl: `https://opensea.io/collection/${slug}`,
        slug,
      },
      nfts: normalizedNfts,
    });
  } catch (error: any) {
    console.error("OpenSea collection fetch error:", error);
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: error?.message || "Failed to fetch collection" } },
      { status: 500 }
    );
  }
}
