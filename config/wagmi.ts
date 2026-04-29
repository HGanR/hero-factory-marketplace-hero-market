// config/wagmi.ts
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { mainnet, polygon, sepolia, polygonAmoy } from '@reown/appkit/networks';
import { http } from 'viem';

export const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_ID || 'fallback-project-id';
if (!process.env.NEXT_PUBLIC_WALLETCONNECT_ID) {
  console.warn('Missing NEXT_PUBLIC_WALLETCONNECT_ID in .env.local - using fallback');
}

// Configure networks with fallback RPC providers
const networksWithRPC = [
  {
    ...mainnet,
    rpcUrls: {
      default: {
        http: [
          'https://eth.llamarpc.com',
          'https://rpc.ankr.com/eth',
          'https://ethereum.publicnode.com',
          'https://eth-mainnet.public.blastapi.io',
        ],
      },
    },
  },
  {
    ...polygon,
    rpcUrls: {
      default: {
        http: [
          'https://polygon.llamarpc.com',
          'https://rpc.ankr.com/polygon',
          'https://polygon-rpc.com',
          'https://polygon-mainnet.public.blastapi.io',
        ],
      },
    },
  },
  {
    ...sepolia,
    rpcUrls: {
      default: {
        http: [
          'https://rpc.sepolia.org',
          'https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161',
        ],
      },
    },
  },
  {
    ...polygonAmoy,
    rpcUrls: {
      default: {
        http: [
          'https://rpc.ankr.com/polygon_amoy',
          'https://polygon-amoy.public.blastapi.io',
        ],
      },
    },
  },
];

export const networks = networksWithRPC;

export const wagmiAdapter = new WagmiAdapter({
  ssr: true,
  projectId,
  networks,
  transports: {
    [mainnet.id]: http(),
    [polygon.id]: http(),
    [sepolia.id]: http(),
    [polygonAmoy.id]: http(),
  },
  // Note: wallets and storage properties removed - WagmiAdapter will use defaults
  // The wallets configuration is handled in AppKitProvider via createAppKit
  // Storage defaults are SSR-safe and handle window.localStorage automatically
});

export const wagmiConfig = wagmiAdapter.wagmiConfig;