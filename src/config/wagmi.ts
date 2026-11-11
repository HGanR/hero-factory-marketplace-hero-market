// config/wagmi.ts
// WalletConnect is initialized by its connector on demand; SSR remains enabled.
import { createConfig, http } from "wagmi";
import { polygon, mainnet, sepolia, polygonAmoy } from "wagmi/chains";
import { injected, walletConnect } from "wagmi/connectors";

export const projectId = (process.env.NEXT_PUBLIC_WALLETCONNECT_ID || "").trim();

export const wagmiConfig = createConfig({
  chains: [mainnet, polygon, sepolia, polygonAmoy],
  connectors: [injected(), ...(projectId ? [walletConnect({projectId, showQrModal: true,
    metadata: {name:"TROOTHHURTZ World Explorer",description:"Connect your Polygon wallet to buy library assets with TROO.",url:"https://troothhurtz.app",icons:["https://troothhurtz.app/favicon.png"]}
  })] : [])],
  transports: {
    [mainnet.id]: http("https://rpc.ankr.com/eth"),
    [polygon.id]: http("https://polygon-bor-rpc.publicnode.com"),
    [sepolia.id]: http("https://rpc.sepolia.org"),
    [polygonAmoy.id]: http("https://rpc.ankr.com/polygon_amoy"),
  },
  ssr: true,
});
