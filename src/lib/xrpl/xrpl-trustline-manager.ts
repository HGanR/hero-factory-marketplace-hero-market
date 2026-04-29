import "server-only";

/**
 * XRPL Trust Line Manager Service
 *
 * Manages trust lines between accounts on the XRP Ledger.
 * TrustSet transactions MUST be signed by the trust line holder account.
 */

import { Client, TrustSet, Wallet, isValidAddress } from "xrpl";
import { Logger } from "./logger";

/**
 * Configuration for creating/updating a trust line
 */
export interface TrustLineConfig {
  issuer: string; // Address of the IOU issuer
  currency: string; // Currency code (3-letter ISO or 160-bit hex)
  limit: string; // Maximum IOU amount as string (e.g., "1000000")
  qualityIn?: number; // Exchange rate for incoming payments (default: 1000000000)
  qualityOut?: number; // Exchange rate for outgoing payments (default: 1000000000)
  memo?: string; // Optional memo for the transaction
}

export interface TrustLineDetails {
  account: string;
  issuer: string;
  currency: string;
  balance: string;
  limit: string;
  limitPeer: string;
  qualityIn: number;
  qualityOut: number;
  noRipple: boolean;
  noRipplePeer: boolean;
  frozen: boolean;
  frozenPeer: boolean;
}

export interface TransactionResult {
  hash: string;
  ledgerIndex: number | null;
  status: string;
  timestamp: string;
}

/**
 * XRPLTrustLineManager
 *
 * Handles trust line operations:
 * - Create/update trust lines (requires holder seed)
 * - Query trust line details (no signing required)
 */
export class XRPLTrustLineManager {
  private client: Client;
  private logger: Logger;
  private maxRetries = 3;
  private retryDelayMs = 1000;

  constructor(rpcUrl: string, logger?: Logger) {
    this.client = new Client(rpcUrl);
    this.logger = logger || new Logger("XRPLTrustLineManager");
  }

  async connect(): Promise<void> {
    try {
      if (!this.client.isConnected()) {
        await this.client.connect();
        this.logger.info("Connected to XRPL network");
      }
    } catch (error) {
      this.logger.error("Failed to connect to XRPL", error);
      throw new Error(`XRPL connection failed: ${String(error)}`);
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.client.isConnected()) {
        await this.client.disconnect();
        this.logger.info("Disconnected from XRPL network");
      }
    } catch (error) {
      this.logger.error("Failed to disconnect from XRPL", error);
    }
  }

  /**
   * Create a trust line for a holder account (requires holder seed for signing).
   */
  async createTrustLine(holderSeed: string, config: TrustLineConfig): Promise<string> {
    try {
      const holderWallet = Wallet.fromSeed(holderSeed);
      this.validateAddress(holderWallet.address);
      this.validateAddress(config.issuer);
      this.validateCurrency(config.currency);
      this.validateAmount(config.limit);

      await this.connect();

      const trustSetTx: TrustSet = {
        Account: holderWallet.address,
        TransactionType: "TrustSet",
        LimitAmount: {
          currency: config.currency,
          issuer: config.issuer,
          value: config.limit,
        },
        QualityIn: config.qualityIn || 1000000000,
        QualityOut: config.qualityOut || 1000000000,
      };

      if (config.memo) {
        trustSetTx.Memos = [
          {
            Memo: {
              MemoData: Buffer.from(config.memo).toString("hex"),
            },
          },
        ];
      }

      const result = await this.submitTransactionWithRetry(trustSetTx, holderWallet);
      this.logger.info(`Trust line created successfully: ${result.hash}`, {
        holder: holderWallet.address,
        issuer: config.issuer,
        currency: config.currency,
        limit: config.limit,
      });
      return result.hash;
    } catch (error) {
      this.logger.error("Failed to create trust line", error);
      throw error;
    }
  }

  async getTrustLine(account: string, issuer: string, currency: string): Promise<TrustLineDetails | null> {
    try {
      this.validateAddress(account);
      this.validateAddress(issuer);
      this.validateCurrency(currency);

      await this.connect();

      const response = await this.client.request({
        command: "account_lines",
        account,
        ledger_index: "validated",
      });

      const trustLine = response.result.lines.find(
        (line: any) => line.account === issuer && line.currency === currency
      );

      if (!trustLine) return null;

      return {
        account,
        issuer,
        currency,
        balance: trustLine.balance,
        limit: trustLine.limit,
        limitPeer: trustLine.limit_peer,
        qualityIn: trustLine.quality_in,
        qualityOut: trustLine.quality_out,
        noRipple: trustLine.no_ripple || false,
        noRipplePeer: trustLine.no_ripple_peer || false,
        frozen: trustLine.freeze || false,
        frozenPeer: trustLine.freeze_peer || false,
      };
    } catch (error) {
      this.logger.error("Failed to get trust line", error);
      throw error;
    }
  }

  async getAllTrustLines(account: string): Promise<TrustLineDetails[]> {
    try {
      this.validateAddress(account);
      await this.connect();

      const response = await this.client.request({
        command: "account_lines",
        account,
        ledger_index: "validated",
      });

      const trustLines: TrustLineDetails[] = response.result.lines.map((line: any) => ({
        account,
        issuer: line.account,
        currency: line.currency,
        balance: line.balance,
        limit: line.limit,
        limitPeer: line.limit_peer,
        qualityIn: line.quality_in,
        qualityOut: line.quality_out,
        noRipple: line.no_ripple || false,
        noRipplePeer: line.no_ripple_peer || false,
        frozen: line.freeze || false,
        frozenPeer: line.freeze_peer || false,
      }));

      return trustLines;
    } catch (error) {
      this.logger.error("Failed to get all trust lines", error);
      throw error;
    }
  }

  async updateTrustLineLimit(holderSeed: string, issuer: string, currency: string, newLimit: string): Promise<string> {
    try {
      const holderWallet = Wallet.fromSeed(holderSeed);
      this.validateAddress(holderWallet.address);
      this.validateAddress(issuer);
      this.validateCurrency(currency);
      this.validateAmount(newLimit);

      await this.connect();

      const trustSetTx: TrustSet = {
        Account: holderWallet.address,
        TransactionType: "TrustSet",
        LimitAmount: {
          currency,
          issuer,
          value: newLimit,
        },
      };

      const result = await this.submitTransactionWithRetry(trustSetTx, holderWallet);
      return result.hash;
    } catch (error) {
      this.logger.error("Failed to update trust line limit", error);
      throw error;
    }
  }

  async disableTrustLine(holderSeed: string, issuer: string, currency: string): Promise<string> {
    try {
      const holderWallet = Wallet.fromSeed(holderSeed);
      this.validateAddress(holderWallet.address);
      this.validateAddress(issuer);
      this.validateCurrency(currency);

      const trustLine = await this.getTrustLine(holderWallet.address, issuer, currency);
      if (trustLine && parseFloat(trustLine.balance) !== 0) {
        throw new Error(`Cannot disable trust line with non-zero balance: ${trustLine.balance}`);
      }

      await this.connect();

      const trustSetTx: TrustSet = {
        Account: holderWallet.address,
        TransactionType: "TrustSet",
        LimitAmount: {
          currency,
          issuer,
          value: "0",
        },
      };

      const result = await this.submitTransactionWithRetry(trustSetTx, holderWallet);
      return result.hash;
    } catch (error) {
      this.logger.error("Failed to disable trust line", error);
      throw error;
    }
  }

  async trustLineExists(account: string, issuer: string, currency: string): Promise<boolean> {
    const trustLine = await this.getTrustLine(account, issuer, currency);
    return trustLine !== null;
  }

  async getTrustLineBalance(account: string, issuer: string, currency: string): Promise<string> {
    const trustLine = await this.getTrustLine(account, issuer, currency);
    return trustLine ? trustLine.balance : "0";
  }

  async getTrustLineLimit(account: string, issuer: string, currency: string): Promise<string> {
    const trustLine = await this.getTrustLine(account, issuer, currency);
    return trustLine ? trustLine.limit : "0";
  }

  private async submitTransactionWithRetry(transaction: TrustSet, wallet: Wallet): Promise<TransactionResult> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const result = await this.client.submitAndWait(transaction as any, { wallet });

        const txResult = (result as any)?.result?.meta?.TransactionResult;
        if (txResult !== "tesSUCCESS") {
          throw new Error(`Transaction failed: ${String(txResult)}`);
        }

        return {
          hash: result.result.hash,
          ledgerIndex: result.result.ledger_index ?? null,
          status: txResult || "unknown",
          timestamp: new Date().toISOString(),
        };
      } catch (error) {
        lastError = error as Error;
        this.logger.warn(`Transaction submission failed (attempt ${attempt}/${this.maxRetries})`, error);
        if (attempt < this.maxRetries) {
          const delay = this.retryDelayMs * Math.pow(2, attempt - 1);
          await this.sleep(delay);
        }
      }
    }

    throw new Error(`Transaction failed after ${this.maxRetries} attempts: ${lastError?.message}`);
  }

  private validateAddress(address: string): void {
    if (!isValidAddress(address)) {
      throw new Error(`Invalid XRPL address: ${address}`);
    }
  }

  private validateCurrency(currency: string): void {
    const isValidISO = /^[A-Z0-9]{3}$/.test(currency);
    const isValidHex = /^[0-9A-F]{40}$/.test(currency);
    if (!isValidISO && !isValidHex) {
      throw new Error(`Invalid currency code: ${currency}`);
    }
  }

  private validateAmount(amount: string): void {
    const num = parseFloat(amount);
    if (Number.isNaN(num) || num < 0) {
      throw new Error(`Invalid amount: ${amount}`);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export default XRPLTrustLineManager;


