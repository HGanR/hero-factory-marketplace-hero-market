#!/bin/bash

# NFT Marketplace Installation Script
# This script installs all dependencies and sets up the project

echo "🚀 Installing NFT Marketplace Dependencies..."
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

echo "✅ Node.js version: $(node --version)"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

echo "✅ npm version: $(npm --version)"
echo ""

# Install dependencies
echo "📦 Installing npm packages..."
npm install

# Install additional blockchain dependencies
echo ""
echo "📦 Installing blockchain-specific packages..."
npm install ethers@^6.9.0 @solana/web3.js@^1.87.0 @metaplex-foundation/js@^0.19.0 xrpl@^3.0.0

# Install database dependencies
echo ""
echo "📦 Installing database packages..."
npm install mysql2@^3.6.0

# Install IPFS dependencies
echo ""
echo "📦 Installing IPFS/Pinata packages..."
npm install axios@^1.6.0 form-data@^4.0.0

# Install smart contract development tools
echo ""
echo "📦 Installing Hardhat and OpenZeppelin..."
npm install --save-dev hardhat@^2.19.0 @nomicfoundation/hardhat-toolbox@^4.0.0
npm install @openzeppelin/contracts@^5.0.0

# Install utility packages
echo ""
echo "📦 Installing utility packages..."
npm install dotenv@^16.3.0 bs58@^5.0.0

echo ""
echo "✅ All dependencies installed successfully!"
echo ""
echo "📝 Next steps:"
echo "1. Copy .env.example to .env.local and fill in your credentials"
echo "2. Run the database migration script"
echo "3. Deploy smart contracts (if using EVM chains)"
echo "4. Start the development server with: npm run dev"
echo ""
echo "For detailed instructions, see README.md"
