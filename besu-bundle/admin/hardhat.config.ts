/**
 * Hardhat Configuration for Hyperledger Besu
 * 
 * This configuration enables deployment of smart contracts to a private
 * Hyperledger Besu network using Hardhat.
 * 
 * File: hardhat.config.ts
 * 
 * Features:
 * - Besu network configuration
 * - Local development network
 * - Contract compilation
 * - Deployment scripts
 * - Gas optimization
 */

import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
import '@nomicfoundation/hardhat-ethers';
import 'hardhat-gas-reporter';
import 'solidity-coverage';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// ============================================================================
// Environment Variables
// ============================================================================

const BESU_RPC_URL = process.env.BESU_RPC_URL || 'http://localhost:8545';
const BESU_CHAIN_ID = parseInt(process.env.BESU_CHAIN_ID || '1337');
const ISSUER_PRIVATE_KEY = process.env.ISSUER_PRIVATE_KEY || '0x' + '0'.repeat(64);
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || '';

// ============================================================================
// Hardhat Configuration
// ============================================================================

const config: HardhatUserConfig = {
  // ========================================================================
  // Solidity Compiler Configuration
  // ========================================================================

  solidity: {
    version: '0.8.20',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },

  // ========================================================================
  // Networks Configuration
  // ========================================================================

  networks: {
    // ====================================================================
    // Hardhat Local Network (for testing)
    // ====================================================================

    hardhat: {
      chainId: 1337,
      forking: {
        enabled: false,
        // Uncomment to fork from Besu
        // url: BESU_RPC_URL,
      },
      accounts: {
        mnemonic:
          'test test test test test test test test test test test junk',
        path: "m/44'/60'/0'/0",
        initialIndex: 0,
        count: 20,
      },
      mining: {
        auto: true,
        interval: 0,
      },
    },

    // ====================================================================
    // Localhost Network (for local Hardhat node)
    // ====================================================================

    localhost: {
      url: 'http://127.0.0.1:8545',
      chainId: 1337,
    },

    // ====================================================================
    // Hyperledger Besu Private Network
    // ====================================================================

    besu: {
      url: BESU_RPC_URL,
      chainId: BESU_CHAIN_ID,
      accounts: [ISSUER_PRIVATE_KEY],
      gasPrice: 'auto',
      timeout: 40000, // 40 seconds
      httpHeaders: {
        // Optional: Add custom headers if needed
      },
    },

    // ====================================================================
    // Besu Development Network (IBFT 2.0)
    // ====================================================================

    besuDev: {
      url: 'http://localhost:8545',
      chainId: 1337,
      accounts: [ISSUER_PRIVATE_KEY],
      gasPrice: 1000000000, // 1 gwei
    },

    // ====================================================================
    // Besu Testnet (if applicable)
    // ====================================================================

    besuTestnet: {
      url: process.env.BESU_TESTNET_RPC_URL || 'http://localhost:8545',
      chainId: parseInt(process.env.BESU_TESTNET_CHAIN_ID || '1337'),
      accounts: [ISSUER_PRIVATE_KEY],
      gasPrice: 'auto',
    },
  },

  // ========================================================================
  // Paths Configuration
  // ========================================================================

  paths: {
    sources: './contracts',
    tests: './test',
    cache: './cache',
    artifacts: './artifacts',
  },

  // ========================================================================
  // Gas Reporter Configuration
  // ========================================================================

  gasReporter: {
    enabled: process.env.REPORT_GAS === 'true',
    currency: 'USD',
    coinmarketcap: process.env.COINMARKETCAP_API_KEY,
    outputFile: 'gas-report.txt',
    noColors: true,
  },

  // ========================================================================
  // Etherscan Configuration (for block explorer verification)
  // ========================================================================

  etherscan: {
    apiKey: {
      mainnet: ETHERSCAN_API_KEY,
      // Add Besu explorer if available
      besu: 'unused', // Besu explorers typically don't require API keys
    },
    customChains: [
      {
        network: 'besu',
        chainId: BESU_CHAIN_ID,
        urls: {
          apiURL: process.env.BESU_EXPLORER_API_URL || 'http://localhost:4000/api',
          browserURL: process.env.BESU_EXPLORER_URL || 'http://localhost:4000',
        },
      },
    ],
  },

  // ========================================================================
  // Mocha Test Configuration
  // ========================================================================

  mocha: {
    timeout: 40000, // 40 seconds
    reporter: 'spec',
    reporterOptions: {
      reportDir: './test-results',
      reportFilename: 'report.json',
    },
  },

  // ========================================================================
  // TypeScript Configuration
  // ========================================================================

  typechain: {
    outDir: 'typechain-types',
    target: 'ethers-v6',
  },
};

export default config;
