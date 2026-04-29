/**
 * Besu Transaction Service
 * 
 * Handles recording trust records on Hyperledger Besu blockchain.
 * Manages transaction creation, submission, and confirmation.
 */

import { ethers } from 'ethers';
import { createHash } from 'crypto';

// ============================================================================
// Types
// ============================================================================

interface RecordTrustInput {
  trustId: string;
  name: string;
  amount: string;
  beneficiary: string;
  maturityDate: Date;
  terms: string;
}

interface TransactionReceipt {
  transactionHash: string;
  blockNumber: number;
  gasUsed: string;
  status: number;
  from: string;
  to: string;
}

interface TransactionOptions {
  gasLimit?: string;
  gasPrice?: string;
  nonce?: number;
}

// ============================================================================
// Besu Transaction Service
// ============================================================================

export class BesuTransactionService {
  private rpcUrl: string;
  private contractAddress: string;
  private privateKey: string;
  private contractAbi: any;
  private provider: ethers.Provider | null = null;
  private signer: ethers.Wallet | null = null;
  private contract: ethers.Contract | null = null;

  constructor(
    rpcUrl: string,
    contractAddress: string,
    privateKey: string,
    contractAbi: any
  ) {
    this.rpcUrl = rpcUrl;
    this.contractAddress = contractAddress;
    this.privateKey = privateKey;
    this.contractAbi = contractAbi;
  }

  // ========================================================================
  // Initialization
  // ========================================================================

  /**
   * Initialize connection and signer
   */
  async initialize(): Promise<void> {
    try {
      // Create provider
      this.provider = new ethers.JsonRpcProvider(this.rpcUrl);

      // Create signer from private key
      this.signer = new ethers.Wallet(this.privateKey, this.provider);

      // Create contract instance with signer (for write operations)
      this.contract = new ethers.Contract(
        this.contractAddress,
        this.contractAbi,
        this.signer
      );

      // Verify connection
      const network = await this.provider.getNetwork();
      console.log(`BesuTransactionService initialized on chain ${network.chainId}`);

      // Verify signer
      const signerAddress = await this.signer.getAddress();
      console.log(`Signer address: ${signerAddress}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to initialize BesuTransactionService: ${message}`);
    }
  }

  // ========================================================================
  // Trust Recording
  // ========================================================================

  /**
   * Record trust on blockchain
   */
  async recordTrustOnBlockchain(input: RecordTrustInput): Promise<string> {
    try {
      if (!this.contract || !this.signer) {
        throw new Error('Service not initialized');
      }

      console.log(`[BesuTx] Recording trust on blockchain: ${input.trustId}`);

      // 1. Create document hash
      const documentHash = this.createDocumentHash(input);
      console.log(`[BesuTx] Document hash: ${documentHash}`);

      // 2. Prepare transaction data
      const txData = {
        trustId: input.trustId,
        name: input.name,
        amount: ethers.parseUnits(input.amount, 18),
        beneficiary: input.beneficiary,
        maturityDate: Math.floor(input.maturityDate.getTime() / 1000),
        terms: input.terms,
        documentHash,
      };

      console.log(`[BesuTx] Transaction data prepared:`, {
        trustId: txData.trustId,
        name: txData.name,
        amount: txData.amount.toString(),
        beneficiary: txData.beneficiary,
        maturityDate: txData.maturityDate,
      });

      // 3. Estimate gas
      const gasEstimate = await this.estimateGas(txData);
      console.log(`[BesuTx] Estimated gas: ${gasEstimate}`);

      // 4. Get gas price
      const feeData = await this.provider!.getFeeData();
      const gasPrice = feeData.gasPrice || ethers.parseUnits('1', 'gwei');
      console.log(`[BesuTx] Gas price: ${ethers.formatUnits(gasPrice, 'gwei')} gwei`);

      // 5. Create transaction options
      const txOptions: TransactionOptions = {
        gasLimit: (BigInt(gasEstimate) * 120n / 100n).toString(), // Add 20% buffer
        gasPrice: gasPrice.toString(),
      };

      console.log(`[BesuTx] Transaction options:`, {
        gasLimit: txOptions.gasLimit,
        gasPrice: txOptions.gasPrice,
      });

      // 6. Submit transaction
      console.log(`[BesuTx] Submitting transaction to blockchain`);

      const tx = await this.contract.recordTrust(
        input.trustId,
        input.name,
        ethers.parseUnits(input.amount, 18),
        input.beneficiary,
        Math.floor(input.maturityDate.getTime() / 1000),
        input.terms,
        documentHash,
        txOptions
      );

      const transactionHash = tx.hash;
      console.log(`[BesuTx] Transaction submitted: ${transactionHash}`);

      return transactionHash;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[BesuTx] Failed to record trust:`, error);
      throw new Error(`Failed to record trust on blockchain: ${message}`);
    }
  }

  /**
   * Record payment on blockchain
   */
  async recordPaymentOnBlockchain(
    trustId: string,
    amount: string,
    transactionReference: string
  ): Promise<string> {
    try {
      if (!this.contract || !this.signer) {
        throw new Error('Service not initialized');
      }

      console.log(`[BesuTx] Recording payment on blockchain: ${trustId}`);

      // Estimate gas
      const gasEstimate = await this.estimateGasForPayment(trustId, amount);

      // Get gas price
      const feeData = await this.provider!.getFeeData();
      const gasPrice = feeData.gasPrice || ethers.parseUnits('1', 'gwei');

      // Create transaction options
      const txOptions: TransactionOptions = {
        gasLimit: (BigInt(gasEstimate) * 120n / 100n).toString(),
        gasPrice: gasPrice.toString(),
      };

      // Submit transaction
      const tx = await this.contract.recordPayment(
        trustId,
        ethers.parseUnits(amount, 18),
        transactionReference,
        txOptions
      );

      console.log(`[BesuTx] Payment transaction submitted: ${tx.hash}`);
      return tx.hash;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[BesuTx] Failed to record payment:`, error);
      throw new Error(`Failed to record payment: ${message}`);
    }
  }

  // ========================================================================
  // Transaction Confirmation
  // ========================================================================

  /**
   * Wait for transaction confirmation
   */
  async waitForTransactionConfirmation(
    transactionHash: string,
    timeoutMs: number = 300000 // 5 minutes
  ): Promise<TransactionReceipt> {
    try {
      if (!this.provider) {
        throw new Error('Provider not initialized');
      }

      console.log(
        `[BesuTx] Waiting for transaction confirmation: ${transactionHash}`
      );

      // Poll for receipt
      const startTime = Date.now();
      const pollInterval = 2000; // 2 seconds

      while (Date.now() - startTime < timeoutMs) {
        const receipt = await this.provider.getTransactionReceipt(transactionHash);

        if (receipt) {
          console.log(`[BesuTx] Transaction confirmed in block ${receipt.blockNumber}`);

          return {
            transactionHash: receipt.hash,
            blockNumber: receipt.blockNumber,
            gasUsed: receipt.gasUsed?.toString() || '0',
            status: receipt.status || 0,
            from: receipt.from,
            to: receipt.to || '',
          };
        }

        // Wait before polling again
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
      }

      throw new Error(
        `Transaction confirmation timeout after ${timeoutMs / 1000} seconds`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[BesuTx] Transaction confirmation failed:`, error);
      throw new Error(`Failed to confirm transaction: ${message}`);
    }
  }

  /**
   * Get transaction receipt
   */
  async getTransactionReceipt(transactionHash: string): Promise<TransactionReceipt | null> {
    try {
      if (!this.provider) {
        throw new Error('Provider not initialized');
      }

      const receipt = await this.provider.getTransactionReceipt(transactionHash);

      if (!receipt) {
        return null;
      }

      return {
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed?.toString() || '0',
        status: receipt.status || 0,
        from: receipt.from,
        to: receipt.to || '',
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[BesuTx] Failed to get transaction receipt:`, error);
      throw new Error(`Failed to get transaction receipt: ${message}`);
    }
  }

  // ========================================================================
  // Gas Estimation
  // ========================================================================

  /**
   * Estimate gas for recording trust
   */
  private async estimateGas(txData: any): Promise<string> {
    try {
      if (!this.contract) {
        throw new Error('Contract not initialized');
      }

      const gasEstimate = await this.contract.recordTrust.estimateGas(
        txData.trustId,
        txData.name,
        txData.amount,
        txData.beneficiary,
        txData.maturityDate,
        txData.terms,
        txData.documentHash
      );

      return gasEstimate.toString();
    } catch (error) {
      console.warn('Gas estimation failed, using default:', error);
      return '300000'; // Default gas limit
    }
  }

  /**
   * Estimate gas for recording payment
   */
  private async estimateGasForPayment(
    trustId: string,
    amount: string
  ): Promise<string> {
    try {
      if (!this.contract) {
        throw new Error('Contract not initialized');
      }

      const gasEstimate = await this.contract.recordPayment.estimateGas(
        trustId,
        ethers.parseUnits(amount, 18),
        'payment'
      );

      return gasEstimate.toString();
    } catch (error) {
      console.warn('Gas estimation failed, using default:', error);
      return '150000'; // Default gas limit for payment
    }
  }

  // ========================================================================
  // Document Hashing
  // ========================================================================

  /**
   * Create document hash from trust data
   */
  private createDocumentHash(input: RecordTrustInput): string {
    const dataString = JSON.stringify({
      trustId: input.trustId,
      name: input.name,
      amount: input.amount,
      beneficiary: input.beneficiary,
      maturityDate: input.maturityDate.toISOString(),
      terms: input.terms,
    });

    const hash = createHash('sha256').update(dataString).digest('hex');
    return '0x' + hash;
  }

  // ========================================================================
  // Network Information
  // ========================================================================

  /**
   * Get current network information
   */
  async getNetworkInfo(): Promise<{
    chainId: number;
    blockNumber: number;
    gasPrice: string;
    signerAddress: string;
  }> {
    try {
      if (!this.provider || !this.signer) {
        throw new Error('Service not initialized');
      }

      const network = await this.provider.getNetwork();
      const blockNumber = await this.provider.getBlockNumber();
      const feeData = await this.provider.getFeeData();
      const signerAddress = await this.signer.getAddress();

      return {
        chainId: network.chainId,
        blockNumber,
        gasPrice: ethers.formatUnits(feeData.gasPrice || 0, 'gwei'),
        signerAddress,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to get network info: ${message}`);
    }
  }

  /**
   * Get signer balance
   */
  async getSignerBalance(): Promise<string> {
    try {
      if (!this.provider || !this.signer) {
        throw new Error('Service not initialized');
      }

      const signerAddress = await this.signer.getAddress();
      const balance = await this.provider.getBalance(signerAddress);

      return ethers.formatEther(balance);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to get signer balance: ${message}`);
    }
  }

  // ========================================================================
  // Nonce Management
  // ========================================================================

  /**
   * Get next nonce for signer
   */
  async getNextNonce(): Promise<number> {
    try {
      if (!this.provider || !this.signer) {
        throw new Error('Service not initialized');
      }

      const signerAddress = await this.signer.getAddress();
      const nonce = await this.provider.getTransactionCount(signerAddress);

      return nonce;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to get nonce: ${message}`);
    }
  }

  // ========================================================================
  // Transaction Status
  // ========================================================================

  /**
   * Get transaction status
   */
  async getTransactionStatus(transactionHash: string): Promise<{
    status: 'pending' | 'confirmed' | 'failed' | 'not_found';
    blockNumber?: number;
    gasUsed?: string;
    confirmations?: number;
  }> {
    try {
      if (!this.provider) {
        throw new Error('Provider not initialized');
      }

      // Get transaction
      const tx = await this.provider.getTransaction(transactionHash);

      if (!tx) {
        return { status: 'not_found' };
      }

      // Get receipt
      const receipt = await this.provider.getTransactionReceipt(transactionHash);

      if (!receipt) {
        return { status: 'pending' };
      }

      // Get current block
      const currentBlock = await this.provider.getBlockNumber();
      const confirmations = currentBlock - receipt.blockNumber;

      return {
        status: receipt.status === 1 ? 'confirmed' : 'failed',
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed?.toString(),
        confirmations,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[BesuTx] Failed to get transaction status:`, error);
      throw new Error(`Failed to get transaction status: ${message}`);
    }
  }

  // ========================================================================
  // Cleanup
  // ========================================================================

  /**
   * Disconnect from blockchain
   */
  async disconnect(): Promise<void> {
    this.provider = null;
    this.signer = null;
    this.contract = null;
  }
}

export default BesuTransactionService;
