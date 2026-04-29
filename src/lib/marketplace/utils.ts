/**
 * Marketplace Utility Functions
 * Helper functions for the NFT marketplace
 */

/**
 * Format price with currency symbol
 */
export function formatPrice(price: number, currency: string): string {
  const currencySymbols: { [key: string]: string } = {
    ETH: "Ξ",
    SOL: "◎",
    XRP: "XRP",
    MATIC: "MATIC",
    METAL: "METAL",
  };

  const symbol = currencySymbols[currency] || currency;
  return `${symbol} ${price.toLocaleString()}`;
}

/**
 * Calculate platform fee
 */
export function calculatePlatformFee(price: number, feePercentage: number = 2.5): number {
  return (price * feePercentage) / 100;
}

/**
 * Calculate royalty amount
 */
export function calculateRoyalty(price: number, royaltyPercentage: number): number {
  return (price * royaltyPercentage) / 100;
}

/**
 * Calculate seller proceeds
 */
export function calculateSellerProceeds(
  price: number,
  platformFeePercentage: number = 2.5,
  royaltyPercentage: number = 0
): number {
  const platformFee = calculatePlatformFee(price, platformFeePercentage);
  const royalty = calculateRoyalty(price, royaltyPercentage);
  return price - platformFee - royalty;
}

/**
 * Shorten address for display
 */
export function shortenAddress(address: string, chars: number = 4): string {
  if (!address) return "";
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

/**
 * Get explorer URL for transaction
 */
export function getExplorerUrl(chain: string, txHash: string): string {
  const explorers: { [key: string]: string } = {
    ethereum: `https://etherscan.io/tx/${txHash}`,
    polygon: `https://polygonscan.com/tx/${txHash}`,
    metallicus: `https://explorer.metall2.com/tx/${txHash}`,
    solana: `https://solscan.io/tx/${txHash}`,
    xrpl: `https://livenet.xrpl.org/transactions/${txHash}`,
  };

  return explorers[chain] || "#";
}

/**
 * Get explorer URL for address
 */
export function getAddressExplorerUrl(chain: string, address: string): string {
  const explorers: { [key: string]: string } = {
    ethereum: `https://etherscan.io/address/${address}`,
    polygon: `https://polygonscan.com/address/${address}`,
    metallicus: `https://explorer.metall2.com/address/${address}`,
    solana: `https://solscan.io/account/${address}`,
    xrpl: `https://livenet.xrpl.org/accounts/${address}`,
  };

  return explorers[chain] || "#";
}

/**
 * Validate Ethereum address
 */
export function isValidEthAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Validate Solana address
 */
export function isValidSolanaAddress(address: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
}

/**
 * Validate XRPL address
 */
export function isValidXRPLAddress(address: string): boolean {
  return /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(address);
}

/**
 * Validate address based on chain
 */
export function isValidAddress(address: string, chain: string): boolean {
  switch (chain) {
    case "ethereum":
    case "polygon":
    case "metallicus":
      return isValidEthAddress(address);
    case "solana":
      return isValidSolanaAddress(address);
    case "xrpl":
      return isValidXRPLAddress(address);
    default:
      return false;
  }
}

/**
 * Format time ago
 */
export function timeAgo(date: Date | string): string {
  const now = new Date();
  const past = new Date(date);
  const seconds = Math.floor((now.getTime() - past.getTime()) / 1000);

  const intervals = {
    year: 31536000,
    month: 2592000,
    week: 604800,
    day: 86400,
    hour: 3600,
    minute: 60,
  };

  for (const [unit, secondsInUnit] of Object.entries(intervals)) {
    const interval = Math.floor(seconds / secondsInUnit);
    if (interval >= 1) {
      return `${interval} ${unit}${interval > 1 ? "s" : ""} ago`;
    }
  }

  return "just now";
}

/**
 * Parse attributes from JSON string
 */
export function parseAttributes(attributesJson: string | any): any[] {
  if (typeof attributesJson === "string") {
    try {
      return JSON.parse(attributesJson);
    } catch {
      return [];
    }
  }
  return attributesJson || [];
}

/**
 * Get chain icon
 */
export function getChainIcon(chain: string): string {
  const icons: { [key: string]: string } = {
    ethereum: "⟠",
    polygon: "⬡",
    metallicus: "M",
    solana: "◎",
    xrpl: "X",
  };

  return icons[chain] || "?";
}

/**
 * Get chain name
 */
export function getChainName(chain: string): string {
  const names: { [key: string]: string } = {
    ethereum: "Ethereum",
    polygon: "Polygon",
    metallicus: "Metal L2",
    solana: "Solana",
    xrpl: "XRP Ledger",
  };

  return names[chain] || chain;
}

/**
 * Get currency for chain
 */
export function getCurrencyForChain(chain: string): string {
  const currencies: { [key: string]: string } = {
    ethereum: "ETH",
    polygon: "MATIC",
    metallicus: "METAL",
    solana: "SOL",
    xrpl: "XRP",
  };

  return currencies[chain] || "UNKNOWN";
}

/**
 * Format file size
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

/**
 * Validate image file
 */
export function isValidImageFile(file: File): boolean {
  const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
  const maxSize = 10 * 1024 * 1024; // 10MB

  return validTypes.includes(file.type) && file.size <= maxSize;
}

/**
 * Generate random ID
 */
export function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

/**
 * Sleep utility
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
