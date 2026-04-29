require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const {
  MAINNET_RPC_URL,        // full HTTPS RPC URL (Alchemy/Infura/etc)
  SEPOLIA_RPC_URL,        // optional; only used if provided
  PRIVATE_KEY,            // 0x-prefixed deployer key
  ETHERSCAN_API_KEY,      // optional; for verify
} = process.env;

const ACCOUNTS = PRIVATE_KEY ? [PRIVATE_KEY] : [];

const networks = {
  mainnet: { url: MAINNET_RPC_URL, accounts: ACCOUNTS, chainId: 1 },
};
// Only add Sepolia if you actually set SEPOLIA_RPC_URL in .env
if (SEPOLIA_RPC_URL) {
  networks.sepolia = { url: SEPOLIA_RPC_URL, accounts: ACCOUNTS, chainId: 11155111 };
}

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: { version: "0.8.24", settings: { optimizer: { enabled: true, runs: 200 } } },
  networks,
  etherscan: { apiKey: ETHERSCAN_API_KEY || "" },
};