/**
 * TROO Token configuration for Polygon
 * Contract: 0xa7927231898293377Ce676CFC9bbD551Cb845695
 * Decimals: 18
 */

export const TROO_TOKEN_ADDRESS =
  (process.env.NEXT_PUBLIC_TROO_TOKEN_ADDRESS || "0xa7927231898293377Ce676CFC9bbD551Cb845695") as `0x${string}`;

export const TROO_TREASURY_WALLET =
  (process.env.NEXT_PUBLIC_TROO_TREASURY_WALLET || process.env.PLATFORM_WALLET || "") as `0x${string}`;

export const TROO_DECIMALS = 18;
export const POLYGON_CHAIN_ID = 137;
