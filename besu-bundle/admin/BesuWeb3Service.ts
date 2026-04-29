/**
 * Besu Web3 Service
 * 
 * Complete Web3 integration layer for TroothHurtz with Hyperledger Besu.
 * Handles contract interactions, transactions, and blockchain operations.
 */

import { ethers } from 'ethers';
import crypto from 'crypto';

// ============================================================================
// Types
// ============================================================================

export interface BesuConfig {
  rpcUrl: string;
  chainId: number;
  gasPrice?: string;
  gasLimit?: string;
  confirmations?: number;
}

export interface TransactionResult {
  hash: string;
  blockNumber: number;
  status: 'success' | 'failed';
  gasUsed: string;
  timestamp: Date;
}

export interface DocumentNotarization {
  documentHash: string;
  notaryAddress: string;
  timestamp: Date;
  documentType: string;
  isValid: boolean;
}

export interface TrustRecord {
  trustId: string;
  assetId: string;
  value: string;
  trustee: string;
  beneficiary: string;
  maturityDate: Date;
  isActive: boolean;
}

export interface ComplianceReport {
  reportId: string;
  submittedBy: string;
  reportType: string;
  timestamp: Date;
  isVerified: boolean;
}

export interface DigitalIdentityRecord {
  owner: string;
  kycLevel: number;
  verifiedAt: Date;
  isActive: boolean;
}

export interface LegalInstrumentRecord {
  instrumentId: number;
  type: string;
  issuer: string;
  payee: string;
  amount: string;
  maturityDate: Date;
  isPaid: boolean;
}

// ============================================================================
// Besu Web3 Service
// ============================================================================

export class BesuWeb3Service {
  private provider: ethers.JsonRpcProvider;
  private signer: ethers.Signer | null = null;
  private config: BesuConfig;
  private contracts: Map<string, ethers.Contract> = new Map();
  private eventListeners: Map<string, Function[]> = new Map();

  constructor(config: BesuConfig) {
    this.config = {
      confirmations: 1,
      ...config,
    };

    this.provider = new ethers.JsonRpcProvider(this.config.rpcUrl);
  }

  /**
   * Connect wallet with private key
   */
  async connectWallet(privateKey: string): Promise<string> {
    try {
      this.signer = new ethers.Wallet(privateKey, this.provider);
      const address = await this.signer.getAddress();
      console.log(`Wallet connected: ${address}`);
      return address;
    } catch (error) {
      throw new Error(`Failed to connect wallet: ${error}`);
    }
  }

  /**
   * Get wallet balance
   */
  async getBalance(address: string): Promise<string> {
    try {
      const balance = await this.provider.getBalance(address);
      return ethers.formatEther(balance);
    } catch (error) {
      throw new Error(`Failed to get balance: ${error}`);
    }
  }

  /**
   * Deploy contract
   */
  async deployContract(
    abi: ethers.InterfaceAbi,
    bytecode: string,
    args: any[] = []
  ): Promise<string> {
    if (!this.signer) {
      throw new Error('Wallet not connected');
    }

    try {
      const factory = new ethers.ContractFactory(abi, bytecode, this.signer);
      const contract = await factory.deploy(...args);
      await contract.waitForDeployment();

      const address = await contract.getAddress();
      console.log(`Contract deployed at: ${address}`);

      return address;
    } catch (error) {
      throw new Error(`Failed to deploy contract: ${error}`);
    }
  }

  /**
   * Get contract instance
   */
  getContractInstance(
    contractName: string,
    address: string,
    abi: ethers.InterfaceAbi
  ): ethers.Contract {
    const key = `${contractName}_${address}`;

    if (!this.contracts.has(key)) {
      const contract = new ethers.Contract(
        address,
        abi,
        this.signer || this.provider
      );
      this.contracts.set(key, contract);
    }

    return this.contracts.get(key)!;
  }

  // ========================================================================
  // Document Notary Functions
  // ========================================================================

  /**
   * Notarize a document
   */
  async notarizeDocument(
    notaryAddress: string,
    documentData: Buffer,
    documentType: string,
    metadata: string,
    abi: ethers.InterfaceAbi
  ): Promise<TransactionResult> {
    if (!this.signer) {
      throw new Error('Wallet not connected');
    }

    try {
      // Calculate document hash
      const documentHash = this.calculateDocumentHash(documentData);

      // Get contract instance
      const contract = this.getContractInstance('DocumentNotary', notaryAddress, abi);

      // Call notarizeDocument
      const tx = await contract.notarizeDocument(
        documentHash,
        documentType,
        metadata
      );

      // Wait for confirmation
      const receipt = await tx.wait(this.config.confirmations);

      return {
        hash: receipt.hash,
        blockNumber: receipt.blockNumber,
        status: receipt.status === 1 ? 'success' : 'failed',
        gasUsed: receipt.gasUsed.toString(),
        timestamp: new Date(),
      };
    } catch (error) {
      throw new Error(`Failed to notarize document: ${error}`);
    }
  }

  /**
   * Verify a document
   */
  async verifyDocument(
    notaryAddress: string,
    documentData: Buffer,
    abi: ethers.InterfaceAbi
  ): Promise<DocumentNotarization> {
    try {
      const documentHash = this.calculateDocumentHash(documentData);
      const contract = this.getContractInstance('DocumentNotary', notaryAddress, abi);

      const [isValid, notary, timestamp, documentType] = await contract.verifyDocument(
        documentHash
      );

      return {
        documentHash,
        notaryAddress: notary,
        timestamp: new Date(Number(timestamp) * 1000),
        documentType,
        isValid,
      };
    } catch (error) {
      throw new Error(`Failed to verify document: ${error}`);
    }
  }

  /**
   * Calculate document hash
   */
  private calculateDocumentHash(documentData: Buffer): string {
    const hash = crypto.createHash('sha256').update(documentData).digest();
    return '0x' + hash.toString('hex');
  }

  // ========================================================================
  // Ecclesiastical Trust Functions
  // ========================================================================

  /**
   * Create trust
   */
  async createTrust(
    trustAddress: string,
    assetId: string,
    value: string,
    beneficiary: string,
    maturityDate: Date,
    terms: string,
    abi: ethers.InterfaceAbi
  ): Promise<TransactionResult> {
    if (!this.signer) {
      throw new Error('Wallet not connected');
    }

    try {
      const contract = this.getContractInstance('EcclesiasticalTrust', trustAddress, abi);

      const maturityTimestamp = Math.floor(maturityDate.getTime() / 1000);
      const valueWei = ethers.parseEther(value);

      const tx = await contract.createTrust(
        assetId,
        valueWei,
        beneficiary,
        maturityTimestamp,
        terms
      );

      const receipt = await tx.wait(this.config.confirmations);

      return {
        hash: receipt.hash,
        blockNumber: receipt.blockNumber,
        status: receipt.status === 1 ? 'success' : 'failed',
        gasUsed: receipt.gasUsed.toString(),
        timestamp: new Date(),
      };
    } catch (error) {
      throw new Error(`Failed to create trust: ${error}`);
    }
  }

  /**
   * Get trust details
   */
  async getTrustDetails(
    trustAddress: string,
    trustId: string,
    abi: ethers.InterfaceAbi
  ): Promise<TrustRecord> {
    try {
      const contract = this.getContractInstance('EcclesiasticalTrust', trustAddress, abi);

      const trust = await contract.getTrustDetails(trustId);

      return {
        trustId,
        assetId: trust.assetId,
        value: ethers.formatEther(trust.value),
        trustee: trust.trustee,
        beneficiary: trust.beneficiary,
        maturityDate: new Date(Number(trust.maturityDate) * 1000),
        isActive: trust.isActive,
      };
    } catch (error) {
      throw new Error(`Failed to get trust details: ${error}`);
    }
  }

  /**
   * Distribute trust
   */
  async distributeTrust(
    trustAddress: string,
    trustId: string,
    amount: string,
    reason: string,
    abi: ethers.InterfaceAbi
  ): Promise<TransactionResult> {
    if (!this.signer) {
      throw new Error('Wallet not connected');
    }

    try {
      const contract = this.getContractInstance('EcclesiasticalTrust', trustAddress, abi);

      const amountWei = ethers.parseEther(amount);
      const tx = await contract.distributeTrust(trustId, amountWei, reason);

      const receipt = await tx.wait(this.config.confirmations);

      return {
        hash: receipt.hash,
        blockNumber: receipt.blockNumber,
        status: receipt.status === 1 ? 'success' : 'failed',
        gasUsed: receipt.gasUsed.toString(),
        timestamp: new Date(),
      };
    } catch (error) {
      throw new Error(`Failed to distribute trust: ${error}`);
    }
  }

  // ========================================================================
  // NFA Compliance Functions
  // ========================================================================

  /**
   * Submit compliance report
   */
  async submitComplianceReport(
    complianceAddress: string,
    reportType: string,
    ipfsHash: string,
    abi: ethers.InterfaceAbi
  ): Promise<TransactionResult> {
    if (!this.signer) {
      throw new Error('Wallet not connected');
    }

    try {
      const contract = this.getContractInstance('NFACompliance', complianceAddress, abi);

      const tx = await contract.submitComplianceReport(reportType, ipfsHash);
      const receipt = await tx.wait(this.config.confirmations);

      return {
        hash: receipt.hash,
        blockNumber: receipt.blockNumber,
        status: receipt.status === 1 ? 'success' : 'failed',
        gasUsed: receipt.gasUsed.toString(),
        timestamp: new Date(),
      };
    } catch (error) {
      throw new Error(`Failed to submit compliance report: ${error}`);
    }
  }

  /**
   * Check if address is authorized signer
   */
  async isAuthorizedSigner(
    complianceAddress: string,
    signerAddress: string,
    abi: ethers.InterfaceAbi
  ): Promise<boolean> {
    try {
      const contract = this.getContractInstance('NFACompliance', complianceAddress, abi);
      return await contract.isAuthorizedSigner(signerAddress);
    } catch (error) {
      throw new Error(`Failed to check authorized signer: ${error}`);
    }
  }

  // ========================================================================
  // Digital Identity Functions
  // ========================================================================

  /**
   * Register identity
   */
  async registerIdentity(
    identityAddress: string,
    identityHash: string,
    kycLevel: number,
    metadata: string,
    abi: ethers.InterfaceAbi
  ): Promise<TransactionResult> {
    if (!this.signer) {
      throw new Error('Wallet not connected');
    }

    try {
      const contract = this.getContractInstance('DigitalIdentity', identityAddress, abi);

      const tx = await contract.registerIdentity(identityHash, kycLevel, metadata);
      const receipt = await tx.wait(this.config.confirmations);

      return {
        hash: receipt.hash,
        blockNumber: receipt.blockNumber,
        status: receipt.status === 1 ? 'success' : 'failed',
        gasUsed: receipt.gasUsed.toString(),
        timestamp: new Date(),
      };
    } catch (error) {
      throw new Error(`Failed to register identity: ${error}`);
    }
  }

  /**
   * Get KYC level
   */
  async getKYCLevel(
    identityAddress: string,
    userAddress: string,
    abi: ethers.InterfaceAbi
  ): Promise<number> {
    try {
      const contract = this.getContractInstance('DigitalIdentity', identityAddress, abi);
      return await contract.getKYCLevel(userAddress);
    } catch (error) {
      throw new Error(`Failed to get KYC level: ${error}`);
    }
  }

  /**
   * Get identity details
   */
  async getIdentity(
    identityAddress: string,
    userAddress: string,
    abi: ethers.InterfaceAbi
  ): Promise<DigitalIdentityRecord> {
    try {
      const contract = this.getContractInstance('DigitalIdentity', identityAddress, abi);
      const identity = await contract.getIdentity(userAddress);

      return {
        owner: identity.owner,
        kycLevel: identity.kycLevel,
        verifiedAt: new Date(Number(identity.verifiedAt) * 1000),
        isActive: identity.isActive,
      };
    } catch (error) {
      throw new Error(`Failed to get identity: ${error}`);
    }
  }

  // ========================================================================
  // Legal Instrument Functions
  // ========================================================================

  /**
   * Issue legal instrument
   */
  async issueLegalInstrument(
    instrumentAddress: string,
    instrumentType: string,
    payee: string,
    amount: string,
    maturityDate: Date,
    terms: string,
    documentHash: string,
    abi: ethers.InterfaceAbi
  ): Promise<TransactionResult> {
    if (!this.signer) {
      throw new Error('Wallet not connected');
    }

    try {
      const contract = this.getContractInstance('LegalInstrument', instrumentAddress, abi);

      const maturityTimestamp = Math.floor(maturityDate.getTime() / 1000);
      const amountWei = ethers.parseEther(amount);

      const tx = await contract.issueInstrument(
        instrumentType,
        payee,
        amountWei,
        maturityTimestamp,
        terms,
        documentHash
      );

      const receipt = await tx.wait(this.config.confirmations);

      return {
        hash: receipt.hash,
        blockNumber: receipt.blockNumber,
        status: receipt.status === 1 ? 'success' : 'failed',
        gasUsed: receipt.gasUsed.toString(),
        timestamp: new Date(),
      };
    } catch (error) {
      throw new Error(`Failed to issue legal instrument: ${error}`);
    }
  }

  /**
   * Record payment for instrument
   */
  async recordInstrumentPayment(
    instrumentAddress: string,
    instrumentId: number,
    amount: string,
    transactionReference: string,
    abi: ethers.InterfaceAbi
  ): Promise<TransactionResult> {
    if (!this.signer) {
      throw new Error('Wallet not connected');
    }

    try {
      const contract = this.getContractInstance('LegalInstrument', instrumentAddress, abi);

      const amountWei = ethers.parseEther(amount);
      const tx = await contract.recordPayment(instrumentId, amountWei, transactionReference);

      const receipt = await tx.wait(this.config.confirmations);

      return {
        hash: receipt.hash,
        blockNumber: receipt.blockNumber,
        status: receipt.status === 1 ? 'success' : 'failed',
        gasUsed: receipt.gasUsed.toString(),
        timestamp: new Date(),
      };
    } catch (error) {
      throw new Error(`Failed to record payment: ${error}`);
    }
  }

  /**
   * Get legal instrument details
   */
  async getLegalInstrument(
    instrumentAddress: string,
    instrumentId: number,
    abi: ethers.InterfaceAbi
  ): Promise<LegalInstrumentRecord> {
    try {
      const contract = this.getContractInstance('LegalInstrument', instrumentAddress, abi);
      const instrument = await contract.getInstrument(instrumentId);

      return {
        instrumentId,
        type: instrument.instrumentType,
        issuer: instrument.issuer,
        payee: instrument.payee,
        amount: ethers.formatEther(instrument.amount),
        maturityDate: new Date(Number(instrument.maturityDate) * 1000),
        isPaid: instrument.isPaid,
      };
    } catch (error) {
      throw new Error(`Failed to get legal instrument: ${error}`);
    }
  }

  // ========================================================================
  // Network Functions
  // ========================================================================

  /**
   * Get current block number
   */
  async getBlockNumber(): Promise<number> {
    try {
      return await this.provider.getBlockNumber();
    } catch (error) {
      throw new Error(`Failed to get block number: ${error}`);
    }
  }

  /**
   * Get gas price
   */
  async getGasPrice(): Promise<string> {
    try {
      const gasPrice = await this.provider.getGasPrice();
      return ethers.formatUnits(gasPrice, 'gwei');
    } catch (error) {
      throw new Error(`Failed to get gas price: ${error}`);
    }
  }

  /**
   * Get network info
   */
  async getNetworkInfo(): Promise<{
    chainId: number;
    blockNumber: number;
    gasPrice: string;
  }> {
    try {
      const [blockNumber, gasPrice] = await Promise.all([
        this.provider.getBlockNumber(),
        this.provider.getGasPrice(),
      ]);

      return {
        chainId: this.config.chainId,
        blockNumber,
        gasPrice: ethers.formatUnits(gasPrice, 'gwei'),
      };
    } catch (error) {
      throw new Error(`Failed to get network info: ${error}`);
    }
  }

  /**
   * Listen to contract events
   */
  on(eventName: string, callback: Function): void {
    if (!this.eventListeners.has(eventName)) {
      this.eventListeners.set(eventName, []);
    }
    this.eventListeners.get(eventName)!.push(callback);
  }

  /**
   * Emit event
   */
  private emit(eventName: string, data: any): void {
    const callbacks = this.eventListeners.get(eventName) || [];
    callbacks.forEach((callback) => callback(data));
  }

  /**
   * Dispose service
   */
  dispose(): void {
    this.contracts.clear();
    this.eventListeners.clear();
    this.signer = null;
  }
}

export default BesuWeb3Service;
