import type { Abi } from "viem";

/** Polygon Hero ERC-1155 (same as Meet gate) */
export const HERO_1155_CONTRACT = "0x7202cd71cb52ce0d71b9a13f2dacc4599b6cb13a" as const;
export const HERO_1155_CHAIN_ID = 137;
export const HERO_1155_TOKEN_IDS: readonly bigint[] = [
  0n, 1n, 2n, 3n, 4n, 5n, 6n, 7n, 8n, 9n,
];

export const ERC1155_BALANCE_URI_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [
      { name: "account", type: "address" },
      { name: "id", type: "uint256" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "uri",
    stateMutability: "view",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [{ name: "", type: "string" }],
  },
] as const satisfies Abi;

export const POLYGON_RPC_CANDIDATES = [
  (process.env.NEXT_PUBLIC_POLYGON_RPC || "").trim(),
  "https://polygon-bor-rpc.publicnode.com",
  "https://1rpc.io/polygon",
  "https://rpc.ankr.com/polygon",
  "https://polygon-rpc.com",
].filter(Boolean);
