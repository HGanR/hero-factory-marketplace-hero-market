# Smart Contracts

This directory contains the smart contracts for the NFT Marketplace.

## Contracts

### TrooNFT.sol
ERC-721 NFT contract with:
- Built-in minting fees (0.001 ETH default)
- Royalty support (ERC2981)
- Creator tracking
- Platform wallet for fee collection

### TrooMarketplace.sol
NFT Marketplace contract with:
- Listing and buying functionality
- Platform fees (2.5% default, 1.5% for TROO token holders)
- Automatic royalty distribution
- TROO token holder discounts

## Deployment

Use the deployment script in `scripts/deploy-evm.js`:

```bash
# Set environment variables
export PLATFORM_WALLET=0x...
export TROO_TOKEN_ADDRESS=0x... # Optional

# Deploy to network
npx hardhat run scripts/deploy-evm.js --network <network>
```

## Environment Variables

After deployment, update your `.env` file:

```
NEXT_PUBLIC_ETHEREUM_NFT_CONTRACT=0x...
NEXT_PUBLIC_ETHEREUM_MARKETPLACE_CONTRACT=0x...
NEXT_PUBLIC_POLYGON_NFT_CONTRACT=0x...
NEXT_PUBLIC_POLYGON_MARKETPLACE_CONTRACT=0x...
NEXT_PUBLIC_METALLICUS_NFT_CONTRACT=0x...
NEXT_PUBLIC_METALLICUS_MARKETPLACE_CONTRACT=0x...
```

## Features

### TrooNFT
- **Minting Fee**: 0.001 ETH (configurable by owner)
- **Royalties**: Up to 100% (in basis points)
- **Creator Tracking**: Each NFT tracks its creator for royalty distribution

### TrooMarketplace
- **Platform Fee**: 2.5% (250 basis points)
- **Discounted Fee**: 1.5% (150 basis points) for TROO token holders
- **Minimum TROO Balance**: 10M TROO tokens required for discount
- **Royalty Distribution**: Automatically distributes royalties to creators on sale
