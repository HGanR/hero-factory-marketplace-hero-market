"use client";

import Image from "next/image";
import { useState } from "react";

interface ChainIconProps {
  chain: string;
  size?: number;
  className?: string;
}

const CHAIN_ICONS: Record<string, { icon: string; name: string }> = {
  ethereum: {
    icon: "https://cryptologos.cc/logos/ethereum-eth-logo.png",
    name: "Ethereum",
  },
  polygon: {
    icon: "https://cryptologos.cc/logos/polygon-matic-logo.png",
    name: "Polygon",
  },
  solana: {
    icon: "https://cryptologos.cc/logos/solana-sol-logo.png",
    name: "Solana",
  },
  xrpl: {
    icon: "https://assets.coingecko.com/coins/images/52/small/XRP-symbol-white-128.png",
    name: "XRP Ledger",
  },
  metallicus: {
    icon: "https://assets.coingecko.com/coins/images/29995/small/Metallicus.png",
    name: "Metallicus",
  },
};

export function ChainIcon({ chain, size = 32, className = "" }: ChainIconProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const chainData = CHAIN_ICONS[chain.toLowerCase()];

  if (!chainData) {
    return (
      <div
        className={`flex items-center justify-center rounded-full bg-slate-700 text-slate-300 text-xs font-semibold relative group ${className}`}
        style={{ width: size, height: size }}
        title={chain}
      >
        {chain.charAt(0).toUpperCase()}
      </div>
    );
  }

  return (
    <div
      className={`relative inline-block ${className}`}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div 
        className="relative overflow-hidden rounded-full flex-shrink-0" 
        style={{ width: size, height: size, minWidth: size, minHeight: size, maxWidth: size, maxHeight: size }}
      >
        <Image
          src={chainData.icon}
          alt={chainData.name}
          width={size}
          height={size}
          className="rounded-full cursor-pointer transition-transform hover:scale-110"
          style={{ 
            width: `${size}px`, 
            height: `${size}px`, 
            objectFit: "cover",
            display: "block",
            flexShrink: 0
          }}
          unoptimized
          onError={(e) => {
            // Fallback to text if image fails
            const target = e.target as HTMLImageElement;
            target.style.display = "none";
            const parent = target.parentElement;
            if (parent && !parent.querySelector(".fallback-icon")) {
              const fallback = document.createElement("div");
              fallback.className = "fallback-icon flex items-center justify-center rounded-full bg-slate-700 text-slate-300 text-xs font-semibold absolute inset-0";
              fallback.style.width = `${size}px`;
              fallback.style.height = `${size}px`;
              fallback.textContent = chainData.name.charAt(0);
              parent.appendChild(fallback);
            }
          }}
        />
      </div>
      {/* Custom Tooltip */}
      {showTooltip && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1.5 bg-slate-900 text-white text-sm rounded-lg shadow-lg z-50 whitespace-nowrap border border-cyan-500/30">
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
            <div className="w-2 h-2 bg-slate-900 border-r border-b border-cyan-500/30 transform rotate-45"></div>
          </div>
          {chainData.name}
        </div>
      )}
    </div>
  );
}
