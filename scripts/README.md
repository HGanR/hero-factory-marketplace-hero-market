# Deployment Scripts

## deploy-evm.js

Deployment script for EVM-compatible chains (Ethereum, Polygon, Metallicus).

### Prerequisites

1. Install Hardhat dependencies:
```bash
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox
```

2. Set up Hardhat config (`hardhat.config.js`):
```javascript
require("@nomicfoundation/hardhat-toolbox");

module.exports = {
  solidity: "0.8.20",
  networks: {
    ethereum: {
      url: process.env.ETHEREUM_RPC_URL,
      accounts: [process.env.PRIVATE_KEY],
    },
    polygon: {
      url: process.env.POLYGON_RPC_URL,
      accounts: [process.env.PRIVATE_KEY],
    },
    metallicus: {
      url: process.env.METALLICUS_RPC_URL,
      accounts: [process.env.PRIVATE_KEY],
    },
  },
};
```

### Usage

1. Set environment variables (Hardhat reads `.env`):
```bash
export PLATFORM_WALLET=0x...  # Wallet to receive fees
export TROO_TOKEN_ADDRESS=0x...  # Optional: TROO token for discounts
export PRIVATE_KEY=...  # Deployer private key (no 0x prefix)
export ETHEREUM_RPC_URL=https://...
export POLYGON_RPC_URL=https://polygon-rpc.com
export AMOY_RPC_URL=https://rpc-amoy.polygon.technology
```

2. Deploy to network:
```bash
# Ethereum
npx hardhat run scripts/deploy-evm.js --network ethereum

# Polygon
npx hardhat run scripts/deploy-evm.js --network polygon

# Metallicus
npx hardhat run scripts/deploy-evm.js --network metallicus
```

3. After deployment, update your Next.js `.env.local` file with the contract addresses:
```
NEXT_PUBLIC_ETHEREUM_NFT_CONTRACT=0x...
NEXT_PUBLIC_ETHEREUM_MARKETPLACE_CONTRACT=0x...
NEXT_PUBLIC_POLYGON_NFT_CONTRACT=0x...
NEXT_PUBLIC_POLYGON_MARKETPLACE_CONTRACT=0x...
NEXT_PUBLIC_METALLICUS_NFT_CONTRACT=0x...
NEXT_PUBLIC_METALLICUS_MARKETPLACE_CONTRACT=0x...
```

### Deployment Output

The script will:
- Deploy TrooNFT contract
- Deploy TrooMarketplace contract
- Save deployment info to `deployments/{network}.json`
- Display verification commands
- Show configuration details

### Verification

After deployment, verify contracts on block explorer:
```bash
npx hardhat verify --network ethereum <NFT_CONTRACT_ADDRESS> "Troo NFT" "TROONFT" <PLATFORM_WALLET>
npx hardhat verify --network ethereum <MARKETPLACE_CONTRACT_ADDRESS> <PLATFORM_WALLET> <TROO_TOKEN_ADDRESS>
```
