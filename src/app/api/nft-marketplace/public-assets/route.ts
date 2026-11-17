import { NextRequest, NextResponse } from "next/server";
import { getConnection } from "@/lib/db";

function isVisible(attributes: string | null): boolean {
  if (!attributes) return true;
  try {
    const parsed = JSON.parse(attributes);
    if (!Array.isArray(parsed)) return true;
    const vis = parsed.find((a) => String(a?.trait_type || "").toLowerCase() === "visibility");
    if (!vis) return true;
    const val = String(vis.value || "").toLowerCase();
    return val !== "hidden";
  } catch {
    return true;
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const chain = searchParams.get("chain") || "all";
    const query = (searchParams.get("q") || "").trim();
    const sort = searchParams.get("sort") || "newest";
    const collectionId = searchParams.get("collectionId") || "all";
    const limit = parseInt(searchParams.get("limit") || "100");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Use the existing database tables directly. The shared Drizzle schema does not
    // export NFT models at runtime, so references to nftCollections.isPublic
    // previously threw before any query could execute.
    const connection = await getConnection();
    const [columnRows] = await connection.query(
      "SELECT TABLE_NAME AS tableName, COLUMN_NAME AS columnName FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('nfts', 'nft_collections')"
    );
    const columns = Array.isArray(columnRows) ? columnRows as Array<{ tableName: string; columnName: string }> : [];
    const has = (table: string, column: string) =>
      columns.some((row) => row.tableName === table && row.columnName === column);
    if (!has("nfts", "id") || !has("nft_collections", "id")) {
      return NextResponse.json({ ok: false, error: { code: "NFT_SCHEMA_UNAVAILABLE", message: "NFT inventory tables are unavailable in the selected database." } }, { status: 503 });
    }

    const where: string[] = [];
    const params: Array<string | number> = [];
    if (has("nft_collections", "isPublic")) where.push("c.\`isPublic\` = 1");
    if (chain !== "all") {
      where.push("n.\`chain\` = ?");
      params.push(chain);
    }
    if (collectionId !== "all") {
      where.push("n.\`collectionId\` = ?");
      params.push(collectionId);
    }
    if (query) {
      where.push("(n.\`name\` LIKE ? OR n.\`description\` LIKE ? OR c.\`name\` LIKE ?)");
      params.push(...Array(3).fill(`%${query}%`));
    }
    const order = sort === "price_low" ? "n.\`listPrice\` ASC" :
      sort === "price_high" ? "n.\`listPrice\` DESC" :
      sort === "name" ? "n.\`name\` ASC" : "n.\`mintedAt\` DESC";
    const pageLimit = Number.isFinite(limit) ? Math.max(1, Math.min(limit, 100)) : 100;
    const pageOffset = Number.isFinite(offset) ? Math.max(0, offset) : 0;
    const [resultRows] = await connection.query(
      `SELECT n.*, c.\`name\` AS collectionName, c.\`symbol\` AS collectionSymbol,
        c.\`contractAddress\` AS collectionContractAddress
        FROM \`nfts\` n INNER JOIN \`nft_collections\` c ON n.\`collectionId\` = c.\`id\`
        ${where.length ? "WHERE " + where.join(" AND ") : ""}
        ORDER BY ${order} LIMIT ? OFFSET ?`,
      [...params, pageLimit, pageOffset]
    );
    const rows = Array.isArray(resultRows) ? resultRows as Array<Record<string, any>> : [];
    const parseAttributes = (value: unknown) => {
      if (!value) return null;
      if (typeof value !== "string") return value;
      try { return JSON.parse(value); } catch { return null; }
    };
    const items = rows.filter((row) => isVisible(typeof row.attributes === "string" ? row.attributes : JSON.stringify(row.attributes ?? null))).map((row) => ({
      id: row.id,
      tokenId: row.tokenId,
      name: row.name,
      description: row.description,
      imageUrl: row.imageUrl,
      chain: row.chain,
      ownerAddress: row.ownerAddress,
      isListed: Boolean(row.isListed),
      listPrice: row.listPrice ? Number(row.listPrice) : 0,
      listCurrency: row.listCurrency ?? "",
      contractAddress: row.contractAddress ?? null,
      attributes: parseAttributes(row.attributes),
      collection: {
        id: row.collectionId,
        name: row.collectionName,
        symbol: row.collectionSymbol,
        contractAddress: row.collectionContractAddress,
      },
    }));

    return NextResponse.json({
      ok: true,
      nfts: items,
      count: items.length,
    });
  } catch (error: any) {
    console.error("Public assets error:", error);
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: error?.message || "Failed to fetch public assets" } },
      { status: 500 }
    );
  }
}
