"use client";

import { useState, useEffect } from "react";

interface CryptoBubble {
  id: string;
  currency: string;
  symbol: string;
  name: string;
  displayOrder: number;
  color?: string;
  icon?: string;
  isEnabled: boolean;
  priceUSD?: number | null;
  priceChange24h?: number | null;
}

interface MarketCoin {
  id: string;
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  marketCap: number;
  volume: number;
  image: string;
}

interface CryptoBubblesProps {
  limit?: number;
  animated?: boolean;
  showPrices?: boolean;
  className?: string;
  bubbles?: CryptoBubble[];
  marketCoins?: MarketCoin[];
  onBubbleClick?: (bubble: CryptoBubble, marketData?: MarketCoin) => void;
  containerSize?: { width: number; height: number };
  sizeByValue?: boolean;
}

export default function CryptoBubbles({
  limit = 8,
  animated = true,
  showPrices = false,
  className = "",
  bubbles: externalBubbles,
  marketCoins: externalMarketCoins,
  onBubbleClick,
  containerSize = { width: 800, height: 400 },
  sizeByValue = false
}: CryptoBubblesProps) {
  const [bubbles, setBubbles] = useState<CryptoBubble[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (externalBubbles && externalMarketCoins) {
      // Use external data if provided
      const enabledBubbles = externalBubbles.filter(b => b.isEnabled);
      const mergedBubbles = enabledBubbles.map(bubble => {
        const marketData = externalMarketCoins.find(coin => coin.symbol === bubble.currency);
        return {
          ...bubble,
          priceUSD: marketData?.price || null,
          priceChange24h: marketData?.change24h || null,
        };
      });
      setBubbles(mergedBubbles);
      setLoading(false);
    } else {
      // Fallback to API fetch if no external data provided
      fetchBubbles();
    }
  }, [externalBubbles, externalMarketCoins, limit]);

  const fetchBubbles = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/crypto/bubbles?limit=${limit}`);
      const data = await response.json();

      if (response.ok) {
        setBubbles(data.bubbles || []);
      } else {
        setError(data.error || "Failed to load crypto data");
      }
    } catch (err) {
      console.error("Error fetching bubbles:", err);
      setError("Failed to load crypto bubbles");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center ${className}`} style={{ width: containerSize.width, height: containerSize.height }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <div className="text-slate-400">Loading market data...</div>
        </div>
      </div>
    );
  }

  if (error || bubbles.length === 0) {
    return null; // Don't show anything if there's an error or no bubbles
  }

  // Calculate bubble sizes and positions based on market cap
  const displayedBubbles = bubbles.slice(0, limit);
  const maxMarketCap = Math.max(...displayedBubbles.map(b => {
    const marketData = externalMarketCoins?.find(coin => coin.symbol === b.currency);
    return marketData?.marketCap || 1000000000; // Default fallback
  }));

  const minMarketCap = Math.min(...displayedBubbles.map(b => {
    const marketData = externalMarketCoins?.find(coin => coin.symbol === b.currency);
    return marketData?.marketCap || 100000000; // Default fallback
  }));

  const calculateBubbleSize = (bubble: CryptoBubble) => {
    if (!sizeByValue) return 64; // Default 64px (w-16 h-16)

    const marketData = externalMarketCoins?.find(coin => coin.symbol === bubble.currency);
    const marketCap = marketData?.marketCap || 1000000000;

    // Size range: 32px to 96px based on market cap
    const sizeRange = 64; // 96 - 32
    const capRange = Math.max(maxMarketCap - minMarketCap, 1000000000);
    const normalizedSize = (marketCap - minMarketCap) / capRange;

    return 32 + (normalizedSize * sizeRange); // 32px to 96px
  };

  // Generate positions for bubbles (simple grid layout within container)
  const generatePositions = (bubbleCount: number) => {
    const positions = [];
    const cols = Math.ceil(Math.sqrt(bubbleCount));
    const rows = Math.ceil(bubbleCount / cols);

    const cellWidth = containerSize.width / cols;
    const cellHeight = containerSize.height / rows;

    for (let i = 0; i < bubbleCount; i++) {
      const row = Math.floor(i / cols);
      const col = i % cols;

      // Add some random offset to make it look more natural
      const randomOffsetX = (Math.random() - 0.5) * (cellWidth * 0.3);
      const randomOffsetY = (Math.random() - 0.5) * (cellHeight * 0.3);

      positions.push({
        x: col * cellWidth + cellWidth / 2 + randomOffsetX,
        y: row * cellHeight + cellHeight / 2 + randomOffsetY
      });
    }

    return positions;
  };

  const positions = generatePositions(displayedBubbles.length);

  return (
    <div className={`relative ${className}`} style={{ width: containerSize.width, height: containerSize.height }}>
      {displayedBubbles.map((bubble, index) => {
        const size = calculateBubbleSize(bubble);
        const position = positions[index];
        const marketData = externalMarketCoins?.find(coin => coin.symbol === bubble.currency);

        return (
          <div
            key={bubble.id}
            className={`absolute group ${
              animated ? `animate-float-${(index % 3) + 1}` : ""
            }`}
            style={{
              left: `${position.x - size/2}px`,
              top: `${position.y - size/2}px`,
              animationDelay: animated ? `${index * 0.2}s` : undefined,
            }}
            onClick={() => {
              if (onBubbleClick) {
                onBubbleClick(bubble, marketData);
              }
            }}
          >
            <div
              className="rounded-full flex items-center justify-center font-bold cursor-pointer transition-all duration-300 hover:scale-110 hover:shadow-lg border-2 border-transparent hover:border-current"
              style={{
                width: `${size}px`,
                height: `${size}px`,
                backgroundColor: bubble.color ? bubble.color + '20' : '#6366f120',
                color: bubble.color || '#6366f1',
                boxShadow: bubble.color ? `0 0 20px ${bubble.color}30` : undefined,
                fontSize: `${Math.max(12, size / 4)}px`
              }}
              title={`${bubble.name} (${bubble.currency})${marketData ? ` - $${marketData.price.toLocaleString()}` : ''}`}
            >
              {bubble.symbol}
            </div>

            {/* Enhanced Tooltip */}
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-black/90 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10 max-w-xs">
              <div className="font-semibold">{bubble.name}</div>
              <div className="text-slate-300">{bubble.currency}</div>
              {marketData && (
                <div className="text-xs mt-1 space-y-1">
                  <div>Price: ${marketData.price.toLocaleString()}</div>
                  <div>Market Cap: ${(marketData.marketCap / 1000000000).toFixed(2)}B</div>
                  <div className={marketData.change24h >= 0 ? "text-green-400" : "text-red-400"}>
                    24h: {marketData.change24h >= 0 ? "+" : ""}{marketData.change24h.toFixed(2)}%
                  </div>
                </div>
              )}
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-black/90"></div>
            </div>
          </div>
        );
      })}
    </div>
  );
}