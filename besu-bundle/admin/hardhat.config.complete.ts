/**
 * Hardhat Configuration
 * 
 * File: hardhat.config.ts
 * 
 * Complete Hardhat configuration for deploying and managing smart contracts
 * on Hyperledger Besu blockchain network.
 * 
 * Features:
 * - Besu network configuration (local and remote)
 * - Solidity compiler settings
 * - Gas optimization
 * - Network-specific settings
 * - Plugin configuration
 * - Task definitions
 */

import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
import '@nomicfoundation/hardhat-verify';
import '@nomiclabs/hardhat-ethers';
import '@nomiclabs/hardhat-etherscan';
import '@openzeppelin/hardhat-upgrades';
import 'hardhat-gas-reporter';
import 'solidity-coverage';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config();
dotenv.config({ path: path.join(__dirname, '.env.local') });

// ============================================================================
// Environment Variables
// ============================================================================

const BESU_RPC_URL = process.env.BESU_RPC_URL || 'http://localhost:8545';
const BESU_CHAIN_ID = parseInt(process.env.BESU_CHAIN_ID || '1337');
const BESU_EXPLORER_URL = process.env.BESU_EXPLORER_URL || 'http://localhost:4000';

const ISSUER_PRIVATE_KEY =
  process.env.ISSUER_PRIVATE_KEY || '0x' + '0'.repeat(64);

const DEPLOYER_PRIVATE_KEY =
  process.env.DEPLOYER_PRIVATE_KEY || ISSUER_PRIVATE_KEY;

const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || '';

const GAS_REPORTER_ENABLED = process.env.GAS_REPORTER_ENABLED === 'true';
const COVERAGE_ENABLED = process.env.COVERAGE_ENABLED === 'true';

// ============================================================================
// Hardhat Configuration
// ============================================================================

const config: HardhatUserConfig = {
  // ========================================================================
  // Solidity Compiler Configuration
  // ========================================================================

  solidity: {
    version: '0.8.19',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200, // Optimize for deployment size
      },
      viaIR: false,
      outputSelection: {
        '*': {
          '*': ['abi', 'evm.bytecode', 'evm.deployedBytecode', 'metadata'],
        },
      },
    },
  },

  // ========================================================================
  // Networks Configuration
  // ========================================================================

  networks: {
    // Local Hardhat Network (for testing)
    hardhat: {
      chainId: 1337,
      forking: {
        enabled: false,
        // Uncomment to fork Besu
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
      gasPrice: 1000000000, // 1 gwei
      initialBaseFeePerGas: 0,
    },

    // Besu Local Network
    besu: {
      url: BESU_RPC_URL,
      chainId: BESU_CHAIN_ID,
      accounts: DEPLOYER_PRIVATE_KEY ? [DEPLOYER_PRIVATE_KEY] : [],
      gasPrice: 1000000000, // 1 gwei
      gas: 8000000,
      timeout: 60000,
    },

    // Besu Staging Network
    'besu-staging': {
      url: process.env.BESU_STAGING_RPC_URL || BESU_RPC_URL,
      chainId: parseInt(process.env.BESU_STAGING_CHAIN_ID || '1337'),
      accounts: process.env.BESU_STAGING_PRIVATE_KEY
        ? [process.env.BESU_STAGING_PRIVATE_KEY]
        : [],
      gasPrice: 1000000000,
      gas: 8000000,
      timeout: 60000,
    },

    // Besu Production Network
    'besu-production': {
      url: process.env.BESU_PRODUCTION_RPC_URL || BESU_RPC_URL,
      chainId: parseInt(process.env.BESU_PRODUCTION_CHAIN_ID || '1337'),
      accounts: process.env.BESU_PRODUCTION_PRIVATE_KEY
        ? [process.env.BESU_PRODUCTION_PRIVATE_KEY]
        : [],
      gasPrice: 1000000000,
      gas: 8000000,
      timeout: 60000,
    },

    // Ethereum Mainnet (for reference)
    mainnet: {
      url: process.env.MAINNET_RPC_URL || '',
      chainId: 1,
      accounts: process.env.MAINNET_PRIVATE_KEY
        ? [process.env.MAINNET_PRIVATE_KEY]
        : [],
    },

    // Sepolia Testnet
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || '',
      chainId: 11155111,
      accounts: process.env.SEPOLIA_PRIVATE_KEY
        ? [process.env.SEPOLIA_PRIVATE_KEY]
        : [],
    },
  },

  // ========================================================================
  // Gas Reporter Configuration
  // ========================================================================

  gasReporter: {
    enabled: GAS_REPORTER_ENABLED,
    currency: 'USD',
    coinmarketcap: process.env.COINMARKETCAP_API_KEY,
    outputFile: 'gas-report.txt',
    noColors: false,
    excludeContracts: [],
    src: './contracts',
  },

  // ========================================================================
  // Coverage Configuration
  // ========================================================================

  coverage: {
    enabled: COVERAGE_ENABLED,
    provider: 'hardhat',
    reports: ['text', 'text-summary', 'html', 'lcov'],
    exclude: [
      'contracts/mocks/**',
      'contracts/test/**',
      'node_modules/**',
    ],
  },

  // ========================================================================
  // Etherscan Configuration (for contract verification)
  // ========================================================================

  etherscan: {
    apiKey: {
      mainnet: ETHERSCAN_API_KEY,
      sepolia: ETHERSCAN_API_KEY,
      besu: BESU_EXPLORER_URL, // Custom explorer
    },
    customChains: [
      {
        network: 'besu',
        chainId: BESU_CHAIN_ID,
        urls: {
          apiURL: `${BESU_EXPLORER_URL}/api`,
          browserURL: BESU_EXPLORER_URL,
        },
      },
    ],
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
  // Mocha Test Configuration
  // ========================================================================

  mocha: {
    timeout: 200000,
    bail: false,
    reporter: 'spec',
    reporterOptions: {
      reportDir: './test-results',
      reportFilename: 'test-results.json',
    },
  },

  // ========================================================================
  // TypeChain Configuration (for TypeScript types)
  // ========================================================================

  typechain: {
    outDir: 'typechain-types',
    target: 'ethers-v6',
    alwaysGenerateOverloads: false,
    externalArtifacts: ['externalArtifacts/*.json'],
    dontOverwriteCompiled: false,
  },
};

export default config;

// ============================================================================
// Custom Tasks
// ============================================================================

import { task } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

/**
 * Task: Get account balance
 * Usage: npx hardhat balance --account 0x...
 */
task('balance', 'Prints an account\'s ETH balance')
  .addParam('account', 'The account address')
  .setAction(async (taskArgs: { account: string }, hre: HardhatRuntimeEnvironment) => {
    const balance = await hre.ethers.provider.getBalance(taskArgs.account);
    console.log(hre.ethers.formatEther(balance), 'ETH');
  });

/**
 * Task: Get network information
 * Usage: npx hardhat network-info --network besu
 */
task('network-info', 'Prints network information')
  .setAction(async (_, hre: HardhatRuntimeEnvironment) => {
    const network = await hre.ethers.provider.getNetwork();
    const blockNumber = await hre.ethers.provider.getBlockNumber();
    const gasPrice = await hre.ethers.provider.getGasPrice();

    console.log('Network Information:');
    console.log(`  Name: ${network.name}`);
    console.log(`  Chain ID: ${network.chainId}`);
    console.log(`  Block Number: ${blockNumber}`);
    console.log(`  Gas Price: ${hre.ethers.formatUnits(gasPrice, 'gwei')} gwei`);
  });

/**
 * Task: Deploy contract
 * Usage: npx hardhat deploy-contract --contract TrustVerification --network besu
 */
task('deploy-contract', 'Deploys a contract')
  .addParam('contract', 'Contract name to deploy')
  .setAction(async (taskArgs: { contract: string }, hre: HardhatRuntimeEnvironment) => {
    const [deployer] = await hre.ethers.getSigners();
    console.log(`Deploying ${taskArgs.contract} with account: ${deployer.address}`);

    const ContractFactory = await hre.ethers.getContractFactory(taskArgs.contract);
    const contract = await ContractFactory.deploy();
    await contract.waitForDeployment();

    const address = await contract.getAddress();
    console.log(`${taskArgs.contract} deployed to: ${address}`);
  });

/**
 * Task: Verify contract on explorer
 * Usage: npx hardhat verify-contract --address 0x... --contract TrustVerification --network besu
 */
task('verify-contract', 'Verifies contract on explorer')
  .addParam('address', 'Contract address')
  .addParam('contract', 'Contract name')
  .setAction(async (taskArgs: { address: string; contract: string }, hre: HardhatRuntimeEnvironment) => {
    console.log(`Verifying ${taskArgs.contract} at ${taskArgs.address}...`);

    try {
      await hre.run('verify:verify', {
        address: taskArgs.address,
        contract: `contracts/${taskArgs.contract}.sol:${taskArgs.contract}`,
      });
      console.log('Contract verified successfully!');
    } catch (error) {
      console.error('Verification failed:', error);
    }
  });

/**
 * Task: List accounts
 * Usage: npx hardhat accounts --network besu
 */
task('accounts', 'Prints the list of accounts')
  .setAction(async (_, hre: HardhatRuntimeEnvironment) => {
    const accounts = await hre.ethers.getSigners();
    for (const account of accounts) {
      const balance = await hre.ethers.provider.getBalance(account.address);
      console.log(`${account.address} - ${hre.ethers.formatEther(balance)} ETH`);
    }
  });

/**
 * Task: Get transaction details
 * Usage: npx hardhat tx-details --hash 0x... --network besu
 */
task('tx-details', 'Gets transaction details')
  .addParam('hash', 'Transaction hash')
  .setAction(async (taskArgs: { hash: string }, hre: HardhatRuntimeEnvironment) => {
    const tx = await hre.ethers.provider.getTransaction(taskArgs.hash);
    const receipt = await hre.ethers.provider.getTransactionReceipt(taskArgs.hash);

    console.log('Transaction Details:');
    console.log(`  Hash: ${tx?.hash}`);
    console.log(`  From: ${tx?.from}`);
    console.log(`  To: ${tx?.to}`);
    console.log(`  Value: ${hre.ethers.formatEther(tx?.value || 0)} ETH`);
    console.log(`  Gas: ${tx?.gasLimit}`);
    console.log(`  Gas Price: ${hre.ethers.formatUnits(tx?.gasPrice || 0, 'gwei')} gwei`);
    console.log(`  Block: ${receipt?.blockNumber}`);
    console.log(`  Status: ${receipt?.status === 1 ? 'Success' : 'Failed'}`);
  });

/**
 * Task: Send transaction
 * Usage: npx hardhat send-tx --to 0x... --amount 1 --network besu
 */
task('send-tx', 'Sends a transaction')
  .addParam('to', 'Recipient address')
  .addParam('amount', 'Amount in ETH')
  .setAction(async (taskArgs: { to: string; amount: string }, hre: HardhatRuntimeEnvironment) => {
    const [signer] = await hre.ethers.getSigners();

    const tx = await signer.sendTransaction({
      to: taskArgs.to,
      value: hre.ethers.parseEther(taskArgs.amount),
    });

    console.log(`Transaction sent: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`Transaction confirmed in block: ${receipt?.blockNumber}`);
  });
