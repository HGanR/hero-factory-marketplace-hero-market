import { getDb } from "../src/lib/db";
import {
  userWallets,
  cryptoTransactions,
  currencyPrices,
  exchangeTransactions
} from "../src/lib/db/schema";

async function seedCryptoData() {
  const db = await getDb();

  console.log("🌱 Seeding crypto data...");

  // Sample user address
  const userAddress = "0x742d35Cc6B8E4F4b3c4A4A4A4A4A4A4A4A4A4A4A";

  try {
    // Insert sample currency prices
    await db.insert(currencyPrices).values([
      {
        currency: "BTC",
        priceUSD: "645256.15",
        priceChange24h: "5.80",
        volume24h: "28500000000",
        marketCap: "1250000000000",
      },
      {
        currency: "ETH",
        priceUSD: "3425.50",
        priceChange24h: "3.20",
        volume24h: "15200000000",
        marketCap: "410000000000",
      },
      {
        currency: "USDT",
        priceUSD: "1.00",
        priceChange24h: "0.01",
        volume24h: "45000000000",
        marketCap: "95000000000",
      },
    ]);

    console.log("✅ Currency prices inserted");

    // Insert sample user wallets
    await db.insert(userWallets).values([
      {
        userAddress,
        currency: "BTC",
        balance: "0.25645",
        lockedBalance: "0.00000",
        walletAddress: "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
        chain: "bitcoin",
      },
      {
        userAddress,
        currency: "USDT",
        balance: "12000.00",
        lockedBalance: "0.00000",
        walletAddress: "0x742d35Cc6B8E4F4b3c4A4A4A4A4A4A4A4A4A4A4A",
        chain: "ethereum",
      },
      {
        userAddress,
        currency: "ETH",
        balance: "2.5",
        lockedBalance: "0.00000",
        walletAddress: "0x742d35Cc6B8E4F4b3c4A4A4A4A4A4A4A4A4A4A4A",
        chain: "ethereum",
      },
    ]);

    console.log("✅ User wallets inserted");

    // Insert sample transactions
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

    await db.insert(cryptoTransactions).values([
      {
        transactionId: "DEP001",
        userAddress,
        transactionType: "deposit",
        currency: "BTC",
        amount: "0.1",
        fee: "0.0001",
        status: "completed",
        txHash: "0x123456789abcdef",
        fromAddress: "external_wallet",
        chain: "bitcoin",
        completedAt: twoDaysAgo,
      },
      {
        transactionId: "WDR001",
        userAddress,
        transactionType: "withdraw",
        currency: "BTC",
        amount: "-0.05",
        fee: "0.00005",
        status: "completed",
        txHash: "0xabcdef123456789",
        toAddress: "external_wallet",
        chain: "bitcoin",
        completedAt: yesterday,
      },
      {
        transactionId: "EXC001_FROM",
        userAddress,
        transactionType: "exchange",
        currency: "BTC",
        amount: "-0.01",
        fee: "0.000001",
        status: "completed",
        completedAt: now,
      },
      {
        transactionId: "EXC001_TO",
        userAddress,
        transactionType: "exchange",
        currency: "USDT",
        amount: "408.00",
        status: "completed",
        completedAt: now,
      },
    ]);

    console.log("✅ Crypto transactions inserted");

    // Insert sample exchange transaction
    await db.insert(exchangeTransactions).values({
      userAddress,
      fromCurrency: "BTC",
      toCurrency: "USDT",
      fromAmount: "0.01",
      toAmount: "408.00",
      exchangeRate: "40800.00",
      fee: "0.000001",
      status: "completed",
      transactionId: "EXC001",
      completedAt: now,
    });

    console.log("✅ Exchange transactions inserted");
    console.log("🎉 Crypto data seeding completed!");

  } catch (error) {
    console.error("❌ Error seeding crypto data:", error);
    throw error;
  }
}

// Run the seeder
seedCryptoData()
  .then(() => {
    console.log("✅ Seeding completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  });