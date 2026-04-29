/**
 * Blockchain Verification Service
 * 
 * Handles verification of trust records on Hyperledger Besu blockchain.
 * Provides methods to verify trust authenticity, check payment status,
 * and retrieve blockchain verification details.
 */

import { ethers } from 'ethers';
import { createHash } from 'crypto';
import {
  BlockchainVerification,
  BlockchainNetworkStatus,
  TrustRecord,
  BlockchainStatus,
} from '@/types/CertificateTypes';

// ============================================================================
// Types
// ============================================================================

interface VerificationResult {
  isValid: boolean;
  trustId: string;
  transactionHash: string;
  blockNumber: number;
  verificationTimestamp: Date;
  details: {
    instrumentExists: boolean;
    issuerAuthorized: boolean;
    documentHashMatches: boolean;
    paymentRecorded: boolean;
    notRevoked: boolean;
    contractValid: boolean;
  };
  message: string;
}

interface BlockchainState {
  connected: boolean;
  provider: ethers.Provider | null;
  contract: ethers.Contract | null;
  network: ethers.Network | null;
  error?: string;
}

// ============================================================================
// Blockchain Verification Service
// ============================================================================

export class BlockchainVerificationService {
  private rpcUrl: string;
  private contractAddress: string;
  private contractAbi: any;
  private provider: ethers.Provider | null = null;
  private contract: ethers.Contract | null = null;
  private state: BlockchainState = {
    connected: false,
    provider: null,
    contract: null,
    network: null,
  };

  constructor(
    rpcUrl: string,
    contractAddress: string,
    contractAbi: any
  ) {
    this.rpcUrl = rpcUrl;
    this.contractAddress = contractAddress;
    this.contractAbi = contractAbi;
  }

  // ========================================================================
  // Connection Management
  // ========================================================================

  /**
   * Initialize connection to Besu node
   */
  async initialize(): Promise<void> {
    try {
      // Create provider
      this.provider = new ethers.JsonRpcProvider(this.rpcUrl);

      // Test connection
      const network = await this.provider.getNetwork();
      console.log(`Connected to Besu network: ${network.name} (Chain ID: ${network.chainId})`);

      // Create contract instance (read-only)
      this.contract = new ethers.Contract(
        this.contractAddress,
        this.contractAbi,
        this.provider
      );

      // Update state
      this.state = {
        connected: true,
        provider: this.provider,
        contract: this.contract,
        network,
      };

      console.log('BlockchainVerificationService initialized successfully');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.state.error = message;
      throw new Error(`Failed to initialize blockchain service: ${message}`);
    }
  }

  /**
   * Check if connected to blockchain
   */
  isConnected(): boolean {
    return this.state.connected;
  }

  /**
   * Get current network status
   */
  async getNetworkStatus(): Promise<BlockchainNetworkStatus> {
    try {
      if (!this.provider) {
        throw new Error('Provider not initialized');
      }

      const blockNumber = await this.provider.getBlockNumber();
      const feeData = await this.provider.getFeeData();
      const network = await this.provider.getNetwork();

      return {
        connected: true,
        chainId: network.chainId,
        blockNumber,
        gasPrice: ethers.formatUnits(feeData.gasPrice || 0, 'gwei'),
        rpcUrl: this.rpcUrl,
        lastUpdated: new Date(),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        connected: false,
        error: message,
      };
    }
  }

  /**
   * Disconnect from blockchain
   */
  async disconnect(): Promise<void> {
    this.provider = null;
    this.contract = null;
    this.state = {
      connected: false,
      provider: null,
      contract: null,
      network: null,
    };
  }

  // ========================================================================
  // Trust Verification
  // ========================================================================

  /**
   * Verify a trust record on blockchain
   */
  async verifyTrust(
    trustId: string,
    trustData: {
      name: string;
      amount: string;
      beneficiary: string;
      maturityDate: Date;
      terms: string;
    }
  ): Promise<VerificationResult> {
    try {
      if (!this.contract) {
        throw new Error('Contract not initialized');
      }

      // 1. Create document hash from trust data
      const documentHash = this.createDocumentHash(trustData);
      console.log(`Document hash for trust ${trustId}: ${documentHash}`);

      // 2. Query instrument from smart contract
      const instrumentId = await this.getInstrumentIdByHash(documentHash);
      if (!instrumentId) {
        throw new Error('Instrument not found on blockchain');
      }

      console.log(`Found instrument ID: ${instrumentId}`);

      // 3. Get instrument details
      const instrument = await this.contract.getInstrument(instrumentId);
      console.log('Instrument details retrieved');

      // 4. Verify instrument data
      const details = await this.verifyInstrumentDetails(
        instrument,
        trustData,
        documentHash
      );

      // 5. Get transaction receipt
      const txHash = await this.getInstrumentTransactionHash(instrumentId);
      const receipt = await this.getTransactionReceipt(txHash);

      if (!receipt) {
        throw new Error('Transaction receipt not found');
      }

      // 6. Verify issuer authorization
      const issuerAuthorized = await this.verifyIssuerAuthorization(
        instrument.issuer
      );

      // 7. Check if instrument is revoked
      const notRevoked = instrument.isActive === true;

      // 8. Verify contract validity
      const contractValid = await this.verifyContractValidity();

      // 9. Compile verification result
      const isValid =
        details.instrumentExists &&
        details.documentHashMatches &&
        issuerAuthorized &&
        notRevoked &&
        contractValid;

      const result: VerificationResult = {
        isValid,
        trustId,
        transactionHash: txHash,
        blockNumber: receipt.blockNumber,
        verificationTimestamp: new Date(),
        details: {
          instrumentExists: details.instrumentExists,
          issuerAuthorized,
          documentHashMatches: details.documentHashMatches,
          paymentRecorded: details.paymentRecorded,
          notRevoked,
          contractValid,
        },
        message: isValid
          ? 'Trust record verified successfully on blockchain'
          : 'Trust record verification failed',
      };

      console.log('Trust verification result:', result);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Trust verification failed: ${message}`);
    }
  }

  /**
   * Create document hash from trust data
   */
  private createDocumentHash(trustData: any): string {
    // Create consistent string representation of trust data
    const dataString = JSON.stringify({
      name: trustData.name,
      amount: trustData.amount,
      beneficiary: trustData.beneficiary,
      maturityDate: trustData.maturityDate.toISOString(),
      terms: trustData.terms,
    });

    // Calculate SHA256 hash
    const hash = createHash('sha256').update(dataString).digest('hex');
    return '0x' + hash;
  }

  /**
   * Get instrument ID by document hash
   */
  private async getInstrumentIdByHash(documentHash: string): Promise<string | null> {
    try {
      if (!this.contract) {
        throw new Error('Contract not initialized');
      }

      // Query contract for instrument by document hash
      // This assumes the contract has a mapping: documentHash => instrumentId
      const instrumentId = await this.contract.documentHashToInstrument(documentHash);

      if (instrumentId === 0n || instrumentId === '0') {
        return null;
      }

      return instrumentId.toString();
    } catch (error) {
      console.error('Error getting instrument ID:', error);
      return null;
    }
  }

  /**
   * Verify instrument details match trust data
   */
  private async verifyInstrumentDetails(
    instrument: any,
    trustData: any,
    documentHash: string
  ): Promise<{
    instrumentExists: boolean;
    documentHashMatches: boolean;
    paymentRecorded: boolean;
  }> {
    const instrumentExists = instrument && instrument.id !== 0n;

    const documentHashMatches =
      instrument.documentHash.toLowerCase() === documentHash.toLowerCase();

    // Check if any payments have been recorded
    const paymentCount = await this.contract?.getPaymentCount(instrument.id);
    const paymentRecorded = paymentCount && paymentCount > 0n;

    return {
      instrumentExists,
      documentHashMatches,
      paymentRecorded: !!paymentRecorded,
    };
  }

  /**
   * Get transaction hash for instrument creation
   */
  private async getInstrumentTransactionHash(instrumentId: string): Promise<string> {
    try {
      if (!this.provider) {
        throw new Error('Provider not initialized');
      }

      // Query contract events to find the transaction hash
      const filter = this.contract?.filters?.InstrumentIssued(instrumentId);
      const events = await this.contract?.queryFilter(filter);

      if (!events || events.length === 0) {
        throw new Error('Instrument creation event not found');
      }

      // Get the transaction hash from the first event
      const event = events[0];
      return event.transactionHash;
    } catch (error) {
      console.error('Error getting instrument transaction hash:', error);
      throw error;
    }
  }

  /**
   * Get transaction receipt
   */
  private async getTransactionReceipt(
    txHash: string
  ): Promise<ethers.TransactionReceipt | null> {
    try {
      if (!this.provider) {
        throw new Error('Provider not initialized');
      }

      const receipt = await this.provider.getTransactionReceipt(txHash);
      return receipt;
    } catch (error) {
      console.error('Error getting transaction receipt:', error);
      return null;
    }
  }

  /**
   * Verify issuer is authorized
   */
  private async verifyIssuerAuthorization(issuerAddress: string): Promise<boolean> {
    try {
      if (!this.contract) {
        throw new Error('Contract not initialized');
      }

      // Check if issuer is authorized
      const isAuthorized = await this.contract.isAuthorizedSigner(issuerAddress);
      return !!isAuthorized;
    } catch (error) {
      console.error('Error verifying issuer authorization:', error);
      return false;
    }
  }

  /**
   * Verify contract is valid
   */
  private async verifyContractValidity(): Promise<boolean> {
    try {
      if (!this.contract) {
        throw new Error('Contract not initialized');
      }

      // Try to call a simple read function to verify contract is valid
      const owner = await this.contract.owner();
      return !!owner;
    } catch (error) {
      console.error('Error verifying contract validity:', error);
      return false;
    }
  }

  // ========================================================================
  // Payment Verification
  // ========================================================================

  /**
   * Verify payment recorded on blockchain
   */
  async verifyPayment(
    instrumentId: string,
    expectedAmount: string
  ): Promise<{
    isVerified: boolean;
    amountPaid: string;
    paymentCount: number;
    lastPaymentDate: Date | null;
  }> {
    try {
      if (!this.contract) {
        throw new Error('Contract not initialized');
      }

      // Get instrument details
      const instrument = await this.contract.getInstrument(instrumentId);

      // Get payment records
      const paymentRecords = await this.contract.getPaymentRecords(instrumentId);

      // Verify amount paid
      const amountPaid = ethers.formatUnits(instrument.amountPaid, 18);
      const isVerified = parseFloat(amountPaid) >= parseFloat(expectedAmount);

      // Get last payment date
      let lastPaymentDate: Date | null = null;
      if (paymentRecords.length > 0) {
        const lastRecord = paymentRecords[paymentRecords.length - 1];
        lastPaymentDate = new Date(Number(lastRecord.timestamp) * 1000);
      }

      return {
        isVerified,
        amountPaid,
        paymentCount: paymentRecords.length,
        lastPaymentDate,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Payment verification failed: ${message}`);
    }
  }

  /**
   * Get payment history for instrument
   */
  async getPaymentHistory(instrumentId: string): Promise<
    Array<{
      amount: string;
      paidBy: string;
      timestamp: Date;
      transactionReference: string;
    }>
  > {
    try {
      if (!this.contract) {
        throw new Error('Contract not initialized');
      }

      const paymentRecords = await this.contract.getPaymentRecords(instrumentId);

      return paymentRecords.map((record: any) => ({
        amount: ethers.formatUnits(record.amount, 18),
        paidBy: record.paidBy,
        timestamp: new Date(Number(record.timestamp) * 1000),
        transactionReference: record.transactionReference,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to get payment history: ${message}`);
    }
  }

  // ========================================================================
  // Blockchain Verification Data
  // ========================================================================

  /**
   * Create BlockchainVerification object from verification result
   */
  async createBlockchainVerification(
    verificationResult: VerificationResult,
    explorerUrl: string
  ): Promise<BlockchainVerification> {
    try {
      if (!this.provider) {
        throw new Error('Provider not initialized');
      }

      const network = await this.provider.getNetwork();
      const receipt = await this.provider.getTransactionReceipt(
        verificationResult.transactionHash
      );

      return {
        transactionHash: verificationResult.transactionHash,
        blockNumber: verificationResult.blockNumber,
        verificationTimestamp: verificationResult.verificationTimestamp,
        explorerUrl: `${explorerUrl}/tx/${verificationResult.transactionHash}`,
        chainId: network.chainId,
        gasUsed: receipt?.gasUsed?.toString(),
        contractAddress: this.contractAddress,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to create blockchain verification: ${message}`);
    }
  }

  /**
   * Get full verification details for trust record
   */
  async getVerificationDetails(trustRecord: TrustRecord): Promise<{
    blockchainVerification: BlockchainVerification;
    verificationResult: VerificationResult;
    status: BlockchainStatus;
  }> {
    try {
      // Verify trust on blockchain
      const verificationResult = await this.verifyTrust(trustRecord.id, {
        name: trustRecord.name,
        amount: trustRecord.amount,
        beneficiary: trustRecord.beneficiary,
        maturityDate: trustRecord.maturityDate,
        terms: trustRecord.terms,
      });

      // Create blockchain verification object
      const blockchainVerification = await this.createBlockchainVerification(
        verificationResult,
        process.env.BESU_EXPLORER_URL || 'http://localhost:4000'
      );

      // Determine status
      const status: BlockchainStatus = verificationResult.isValid ? 'verified' : 'failed';

      return {
        blockchainVerification,
        verificationResult,
        status,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to get verification details: ${message}`);
    }
  }

  // ========================================================================
  // Instrument Status
  // ========================================================================

  /**
   * Get instrument status
   */
  async getInstrumentStatus(instrumentId: string): Promise<{
    status: 'ACTIVE' | 'PAID' | 'MATURED' | 'REVOKED';
    remainingAmount: string;
    isMatured: boolean;
    isVerified: boolean;
  }> {
    try {
      if (!this.contract) {
        throw new Error('Contract not initialized');
      }

      const result = await this.contract.getInstrumentStatus(instrumentId);

      return {
        status: result.status,
        remainingAmount: ethers.formatUnits(result.remainingAmount, 18),
        isMatured: result.isMatured,
        isVerified: result.isVerified,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to get instrument status: ${message}`);
    }
  }

  // ========================================================================
  // Statistics
  // ========================================================================

  /**
   * Get blockchain statistics
   */
  async getStatistics(): Promise<{
    totalInstruments: number;
    totalAmount: string;
    totalAmountPaid: string;
    paidInstrumentCount: number;
    activeInstrumentCount: number;
  }> {
    try {
      if (!this.contract) {
        throw new Error('Contract not initialized');
      }

      const [
        totalInstruments,
        totalAmount,
        totalAmountPaid,
        paidCount,
        activeCount,
      ] = await Promise.all([
        this.contract.getTotalInstruments(),
        this.contract.getTotalAmount(),
        this.contract.getTotalAmountPaid(),
        this.contract.getPaidInstrumentCount(),
        this.contract.getActiveInstrumentCount(),
      ]);

      return {
        totalInstruments: Number(totalInstruments),
        totalAmount: ethers.formatUnits(totalAmount, 18),
        totalAmountPaid: ethers.formatUnits(totalAmountPaid, 18),
        paidInstrumentCount: Number(paidCount),
        activeInstrumentCount: Number(activeCount),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to get statistics: ${message}`);
    }
  }

  // ========================================================================
  // Monitoring
  // ========================================================================

  /**
   * Watch for instrument events
   */
  watchInstrumentEvents(
    callback: (event: {
      type: 'issued' | 'paid' | 'verified' | 'revoked';
      instrumentId: string;
      timestamp: Date;
      details: any;
    }) => void
  ): () => void {
    if (!this.contract) {
      throw new Error('Contract not initialized');
    }

    // Listen to InstrumentIssued events
    this.contract.on('InstrumentIssued', (id, type, issuer, payee, amount) => {
      callback({
        type: 'issued',
        instrumentId: id.toString(),
        timestamp: new Date(),
        details: { type, issuer, payee, amount: ethers.formatUnits(amount, 18) },
      });
    });

    // Listen to PaymentRecorded events
    this.contract.on('PaymentRecorded', (id, amount, paidBy) => {
      callback({
        type: 'paid',
        instrumentId: id.toString(),
        timestamp: new Date(),
        details: { amount: ethers.formatUnits(amount, 18), paidBy },
      });
    });

    // Listen to InstrumentRevoked events
    this.contract.on('InstrumentRevoked', (id) => {
      callback({
        type: 'revoked',
        instrumentId: id.toString(),
        timestamp: new Date(),
        details: {},
      });
    });

    // Return unsubscribe function
    return () => {
      this.contract?.removeAllListeners();
    };
  }

  /**
   * Poll for verification status
   */
  async pollVerificationStatus(
    trustId: string,
    trustData: any,
    maxAttempts: number = 30,
    intervalMs: number = 2000
  ): Promise<VerificationResult> {
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        const result = await this.verifyTrust(trustId, trustData);
        if (result.isValid) {
          return result;
        }
      } catch (error) {
        console.log(`Verification attempt ${attempts + 1} failed, retrying...`);
      }

      attempts++;
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }

    throw new Error(
      `Verification failed after ${maxAttempts} attempts (${(maxAttempts * intervalMs) / 1000}s)`
    );
  }
}

export default BlockchainVerificationService;
