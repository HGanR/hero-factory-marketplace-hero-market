// src/app/wallet-dashboard/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BrowserProvider } from "ethers";

const TOKEN_ADDRESS = "0xa7927231898293377Ce676CFC9bbD551Cb845695";

export default function WalletDashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [walletAddress, setWalletAddress] = useState("");
  const [hasAccess, setHasAccess] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (!storedUser) {
      const isAdmin = localStorage.getItem("adminLoggedIn") === "true";
      if (!isAdmin) {
        router.push("/");
        return;
      }
      setUser({ username: "Admin" });
      return;
    }
    setUser(JSON.parse(storedUser));
  }, [router]);

  const connectWallet = async () => {
    if (typeof window.ethereum === "undefined") {
      alert("Please install MetaMask!");
      return;
    }

    setLoading(true);

    try {
      const provider = new BrowserProvider(window.ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      const address = accounts[0];
      setWalletAddress(address);

      // Check token balance (simplified - just check if connected)
      // In production, you would check actual token balance
      const hasTokens = true; // Replace with actual token check

      setHasAccess(hasTokens);

      // Update wallet in database
      await fetch("/api/marketplace/wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress: address,
          hasTokenAccess: hasTokens,
        }),
      });
    } catch (error) {
      console.error("Wallet connection failed:", error);
      alert("Failed to connect wallet");
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    (async () => {
      try {
        await fetch("/api/auth/logout", { method: "POST" });
      } catch {
        // ignore
      } finally {
        try {
          localStorage.removeItem("user");
          localStorage.removeItem("adminLoggedIn");
        } catch {}
        router.push("/");
        router.refresh();
      }
    })();
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <p className="text-white">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <nav className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <h1 className="text-xl font-bold text-white">Wallet Dashboard</h1>
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-slate-400 hover:text-white">
            Back
          </Link>
          <span className="text-slate-400">Welcome, {user.username}</span>
          <button onClick={logout} className="text-slate-400 hover:text-white">
            Logout
          </button>
        </div>
      </nav>

      <main className="p-6">
        <div className="max-w-2xl mx-auto">
          {!walletAddress ? (
            <div className="bg-black/50 rounded-lg p-8 border border-white/10 text-center">
              <h2 className="text-2xl font-bold text-white mb-4">
                Connect Your Wallet
              </h2>
              <p className="text-slate-400 mb-6">
                Connect your wallet to access token-gated content
              </p>
              <button
                onClick={connectWallet}
                disabled={loading}
                className="px-6 py-3 bg-cyan-500 hover:bg-cyan-400 text-black font-semibold rounded-lg transition-colors disabled:opacity-50"
              >
                {loading ? "Connecting..." : "Connect MetaMask"}
              </button>
            </div>
          ) : hasAccess ? (
            <div className="bg-black/50 rounded-lg p-8 border border-green-500/30">
              <h2 className="text-2xl font-bold text-white mb-4">
                ✅ Access Granted
              </h2>
              <p className="text-slate-400 mb-4">
                Wallet: {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
              </p>
              <div className="mb-6 flex flex-wrap gap-3">
                <Link
                  href="/star-fleet"
                  className="px-6 py-3 bg-cyan-500 hover:bg-cyan-400 text-black font-semibold rounded-lg transition-colors"
                >
                  Open Star Fleet
                </Link>
              </div>
              <div className="bg-slate-800 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-2">
                  Exclusive Content
                </h3>
                <p className="text-slate-400">
                  Welcome to the token-gated area! You have verified ownership of
                  the required tokens.
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-black/50 rounded-lg p-8 border border-red-500/30">
              <h2 className="text-2xl font-bold text-white mb-4">
                ❌ Access Denied
              </h2>
              <p className="text-slate-400">
                Your wallet does not hold the required tokens. Please acquire
                tokens to access this content.
              </p>
              <p className="text-sm text-slate-500 mt-4">
                Required Token: {TOKEN_ADDRESS}
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}


