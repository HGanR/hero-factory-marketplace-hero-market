import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { marketClusters, clusterSymbols } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

// GET /api/market/clusters - Get all active clusters with their symbols
// POST /api/market/clusters - Create new cluster (admin only)

const DEFAULT_CLUSTERS = [
  {
    name: "large-cap",
    displayName: "Large Cap",
    description: "Market capitalization over $10B",
    color: "#10b981",
    symbols: ["BTC", "ETH", "BNB", "ADA", "SOL", "XRP", "DOT", "LINK", "AVAX"]
  },
  {
    name: "defi",
    displayName: "DeFi",
    description: "Decentralized Finance protocols",
    color: "#3b82f6",
    symbols: ["UNI", "AAVE", "SUSHI", "COMP", "MKR", "BAL", "CRV", "REN"]
  },
  {
    name: "layer-1",
    displayName: "Layer 1",
    description: "Blockchain infrastructure networks",
    color: "#8b5cf6",
    symbols: ["BTC", "ETH", "ADA", "SOL", "DOT", "AVAX", "LINK", "TRX"]
  },
  {
    name: "meme",
    displayName: "Meme Coins",
    description: "Community-driven meme cryptocurrencies",
    color: "#f59e0b",
    symbols: ["DOGE", "SHIB", "LTC"]
  },
  {
    name: "stablecoins",
    displayName: "Stablecoins",
    description: "Pegged to stable assets like USD",
    color: "#6b7280",
    symbols: ["USDT", "USDC", "BUSD", "DAI"]
  }
];

export async function GET(request: NextRequest) {
  try {
    const db = await getDb();

    // Ensure default clusters exist
    for (const cluster of DEFAULT_CLUSTERS) {
      const existing = await db
        .select()
        .from(marketClusters)
        .where(eq(marketClusters.name, cluster.name))
        .limit(1);

      if (existing.length === 0) {
        // Create cluster
        await db
          .insert(marketClusters)
          .values({
            name: cluster.name,
            displayName: cluster.displayName,
            description: cluster.description,
            color: cluster.color,
            isActive: true,
            sortOrder: DEFAULT_CLUSTERS.indexOf(cluster)
          });

        // Get the created cluster
        const createdClusters = await db
          .select()
          .from(marketClusters)
          .where(eq(marketClusters.name, cluster.name))
          .limit(1);

        if (createdClusters.length === 0) continue;

        // Add symbols
        const symbolInserts = cluster.symbols.map(symbol => ({
          clusterId: createdClusters[0].id,
          symbol
        }));

        await db.insert(clusterSymbols).values(symbolInserts);
      }
    }

    // Get all active clusters with symbols
    const clusters = await db
      .select()
      .from(marketClusters)
      .where(eq(marketClusters.isActive, true))
      .orderBy(marketClusters.sortOrder);

    const clustersWithSymbols = await Promise.all(
      clusters.map(async (cluster) => {
        const symbols = await db
          .select()
          .from(clusterSymbols)
          .where(eq(clusterSymbols.clusterId, cluster.id));

        return {
          ...cluster,
          symbols: symbols.map(s => s.symbol)
        };
      })
    );

    return NextResponse.json({
      success: true,
      clusters: clustersWithSymbols
    });
  } catch (error) {
    console.error("Error fetching clusters:", error);
    return NextResponse.json(
      { error: "Failed to fetch clusters" },
      { status: 500 }
    );
  }
}