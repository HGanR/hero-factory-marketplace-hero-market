// config/wagmi.ts
// NOTE: Keep this config SSR-safe and avoid bundling WalletConnect/AppKit internals
// into the server build. (Those packages can pull in optional/test-only files.)
import { createConfig, http } from "wagmi";
import { polygon, mainnet, sepolia, polygonAmoy } from "wagmi/chains";
import { injected } from "@wagmi/core";

export const projectId = (process.env.NEXT_PUBLIC_WALLETCONNECT_ID || "").trim();

export const wagmiConfig = createConfig({
  chains: [mainnet, polygon, sepolia, polygonAmoy],
  connectors: [injected()],
  transports: {
    [mainnet.id]: http("https://rpc.ankr.com/eth"),
    [polygon.id]: http("https://polygon-bor-rpc.publicnode.com"),
    [sepolia.id]: http("https://rpc.sepolia.org"),
    [polygonAmoy.id]: http("https://rpc.ankr.com/polygon_amoy"),
  },
  ssr: true,
});