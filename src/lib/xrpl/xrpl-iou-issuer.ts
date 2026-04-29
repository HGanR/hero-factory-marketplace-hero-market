import "server-only";

/**
 * XRPL IOU Issuer Service
 *
 * Manages issuance and queries for IOUs (issued currencies) on the XRP Ledger.
 *
 * Note on signing:
 * - Issuance is signed by the issuer account.
 * - Transfers/burns are signed by the sending account (holder), so those APIs require a sender/holder seed.
 */

import { Client, IssuedCurrencyAmount, Payment, Wallet, isValidAddress } from "xrpl";
import { Logger } from "./logger";

export interface IOUIssuanceConfig {
  amount: string;
  currency: string;
  recipient: string;
  memo?: string;
  memoType?: string;
}

export interface IOUTransferConfig {
  amount: string;
  currency: string;
  sender: string;
  recipient: string;
  issuer: string;
  memo?: string;
  /**
   * Seed for the sender account (required to sign transfer).
   */
  senderSeed: string;
}

export interface IOUBalance {
  account: string;
  currency: string;
  issuer: string;
  balance: string;
  limit: string;
  limitPeer: string;
}

export interface TransactionResult {
  hash: string;
  ledgerIndex: number | null;
  status: string;
  timestamp: string;
}

export interface AccountInfo {
  address: string;
  xrpBalance: string;
  accountSequence: number;
  flags: number;
}

export class XRPLIOUIssuer {
  private client: Client;
  private issuerWallet: Wallet;
  private logger: Logger;
  private maxRetries = 3;
  private retryDelayMs = 1000;

  constructor(rpcUrl: string, issuerSeed: string, logger?: Logger) {
    this.client = new Client(rpcUrl);
    this.issuerWallet = Wallet.fromSeed(issuerSeed);
    this.logger = logger || new Logger("XRPLIOUIssuer");
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

  async issueIOUs(config: IOUIssuanceConfig): Promise<string> {
    try {
      this.validateAddress(config.recipient);
      this.validateCurrency(config.currency);
      this.validateAmount(config.amount);

      await this.connect();

      const amount: IssuedCurrencyAmount = {
        currency: config.currency,
        value: config.amount,
        issuer: this.issuerWallet.address,
      };

      const payment: Payment = {
        Account: this.issuerWallet.address,
        Destination: config.recipient,
        Amount: amount,
        TransactionType: "Payment",
      };

      if (config.memo) {
        payment.Memos = [
          {
            Memo: {
              MemoData: Buffer.from(config.memo).toString("hex"),
              MemoType: config.memoType ? Buffer.from(config.memoType).toString("hex") : undefined,
            },
          },
        ];
      }

      const result = await this.submitTransactionWithRetry(payment, this.issuerWallet);
      return result.hash;
    } catch (error) {
      this.logger.error("Failed to issue IOUs", error);
      throw error;
    }
  }

  async transferIOUs(config: IOUTransferConfig): Promise<string> {
    try {
      this.validateAddress(config.sender);
      this.validateAddress(config.recipient);
      this.validateAddress(config.issuer);
      this.validateCurrency(config.currency);
      this.validateAmount(config.amount);

      const senderWallet = Wallet.fromSeed(config.senderSeed);
      if (senderWallet.address !== config.sender) {
        throw new Error("senderSeed does not match sender address");
      }

      await this.connect();

      const amount: IssuedCurrencyAmount = {
        currency: config.currency,
        value: config.amount,
        issuer: config.issuer,
      };

      const payment: Payment = {
        Account: config.sender,
        Destination: config.recipient,
        Amount: amount,
        TransactionType: "Payment",
      };

      if (config.memo) {
        payment.Memos = [
          {
            Memo: {
              MemoData: Buffer.from(config.memo).toString("hex"),
            },
          },
        ];
      }

      const result = await this.submitTransactionWithRetry(payment, senderWallet);
      return result.hash;
    } catch (error) {
      this.logger.error("Failed to transfer IOUs", error);
      throw error;
    }
  }

  async burnIOUs(amount: string, currency: string, holder: string, holderSeed: string, memo?: string): Promise<string> {
    try {
      this.validateAddress(holder);
      this.validateCurrency(currency);
      this.validateAmount(amount);

      const holderWallet = Wallet.fromSeed(holderSeed);
      if (holderWallet.address !== holder) {
        throw new Error("holderSeed does not match holder address");
      }

      await this.connect();

      const iouAmount: IssuedCurrencyAmount = {
        currency,
        value: amount,
        issuer: this.issuerWallet.address,
      };

      const payment: Payment = {
        Account: holder,
        Destination: this.issuerWallet.address,
        Amount: iouAmount,
        TransactionType: "Payment",
      };

      if (memo) {
        payment.Memos = [
          {
            Memo: {
              MemoData: Buffer.from(memo).toString("hex"),
            },
          },
        ];
      }

      const result = await this.submitTransactionWithRetry(payment, holderWallet);
      return result.hash;
    } catch (error) {
      this.logger.error("Failed to burn IOUs", error);
      throw error;
    }
  }

  async getIOUBalance(account: string, currency: string): Promise<string> {
    try {
      this.validateAddress(account);
      this.validateCurrency(currency);

      await this.connect();

      const lines = await this.client.request({
        command: "account_lines",
        account,
        ledger_index: "validated",
      });

      const line = lines.result.lines.find(
        (l: any) => l.currency === currency && l.account === this.issuerWallet.address
      );

      return line ? line.balance : "0";
    } catch (error) {
      this.logger.error("Failed to get IOU balance", error);
      throw error;
    }
  }

  async getAllIOUBalances(account: string): Promise<IOUBalance[]> {
    try {
      this.validateAddress(account);
      await this.connect();

      const lines = await this.client.request({
        command: "account_lines",
        account,
        ledger_index: "validated",
      });

      return lines.result.lines
        .filter((line: any) => line.account === this.issuerWallet.address)
        .map((line: any) => ({
          account,
          currency: line.currency,
          issuer: line.account,
          balance: line.balance,
          limit: line.limit,
          limitPeer: line.limit_peer,
        }));
    } catch (error) {
      this.logger.error("Failed to get all IOU balances", error);
      throw error;
    }
  }

  async getTotalSupply(currency: string): Promise<string> {
    try {
      this.validateCurrency(currency);
      await this.connect();

      const lines = await this.client.request({
        command: "account_lines",
        account: this.issuerWallet.address,
        ledger_index: "validated",
      });

      let totalSupply = 0;
      lines.result.lines.forEach((line: any) => {
        if (line.currency === currency) totalSupply += Math.abs(parseFloat(line.balance));
      });

      return totalSupply.toString();
    } catch (error) {
      this.logger.error("Failed to get total supply", error);
      throw error;
    }
  }

  async getAccountInfo(): Promise<AccountInfo> {
    try {
      await this.connect();

      const response = await this.client.request({
        command: "account_info",
        account: this.issuerWallet.address,
        ledger_index: "validated",
      });

      const accountData = response.result.account_data as any;
      const xrpBalance = (parseInt(accountData.Balance, 10) / 1_000_000).toString();

      return {
        address: this.issuerWallet.address,
        xrpBalance,
        accountSequence: accountData.Sequence,
        flags: accountData.Flags,
      };
    } catch (error) {
      this.logger.error("Failed to get account info", error);
      throw error;
    }
  }

  async getTransactionHistory(limit: number = 10): Promise<string[]> {
    try {
      await this.connect();

      const response = await this.client.request({
        command: "account_tx",
        account: this.issuerWallet.address,
        ledger_index_min: -1,
        ledger_index_max: -1,
        limit,
      });

      return response.result.transactions.map((tx: any) => tx.tx.hash);
    } catch (error) {
      this.logger.error("Failed to get transaction history", error);
      throw error;
    }
  }

  async hasSufficientBalance(account: string, currency: string, requiredAmount: string): Promise<boolean> {
    const balance = await this.getIOUBalance(account, currency);
    return parseFloat(balance) >= parseFloat(requiredAmount);
  }

  async getTrustLineCount(): Promise<number> {
    await this.connect();
    const lines = await this.client.request({
      command: "account_lines",
      account: this.issuerWallet.address,
      ledger_index: "validated",
    });
    return lines.result.lines.length;
  }

  private async submitTransactionWithRetry(transaction: Payment, wallet: Wallet): Promise<TransactionResult> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const result = await this.client.submitAndWait(transaction as any, { wallet });
        const txResult = (result as any)?.result?.meta?.TransactionResult;
        if (txResult !== "tesSUCCESS") throw new Error(`Transaction failed: ${String(txResult)}`);

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
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    }

    throw new Error(`Transaction failed after ${this.maxRetries} attempts: ${lastError?.message}`);
  }

  private validateAddress(address: string): void {
    if (!isValidAddress(address)) throw new Error(`Invalid XRPL address: ${address}`);
  }

  private validateCurrency(currency: string): void {
    const isValidISO = /^[A-Z0-9]{3}$/.test(currency);
    const isValidHex = /^[0-9A-F]{40}$/.test(currency);
    if (!isValidISO && !isValidHex) throw new Error(`Invalid currency code: ${currency}`);
  }

  private validateAmount(amount: string): void {
    const num = parseFloat(amount);
    if (Number.isNaN(num) || num < 0) throw new Error(`Invalid amount: ${amount}`);
  }
}

export default XRPLIOUIssuer;


