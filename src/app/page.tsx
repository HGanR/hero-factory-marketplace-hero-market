// src/app/page.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";

export default function Home() {
  const router = useRouter();
  const welcomeMenuRef = useRef<HTMLDetailsElement | null>(null);
  const [isRegistering, setIsRegistering] = useState(true);
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    try {
      const hasUser = !!localStorage.getItem("user");
      const hasAdmin = localStorage.getItem("adminLoggedIn") === "true";
      setIsLoggedIn(hasUser || hasAdmin);
    } catch {
      setIsLoggedIn(false);
    }
  }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch("/api/marketplace/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, username }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error);
      } else {
        setMessage(data.message);
        setEmail("");
        setUsername("");
        setIsRegistering(false);
      }
    } catch (err) {
      setError("Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/marketplace/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error);
      } else {
        localStorage.setItem("user", JSON.stringify(data.user));
        setIsLoggedIn(true);
        router.push("/dashboard");
      }
    } catch (err) {
      setError("Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore network errors; still clear local state
    } finally {
      try {
        localStorage.removeItem("user");
        localStorage.removeItem("adminLoggedIn");
      } catch {}
      setIsLoggedIn(false);
      setLoading(false);
      router.push("/");
      router.refresh();
    }
  };

  const LINK_PILL =
    "relative inline-flex items-center px-3 py-1 rounded-full border border-cyan-400 text-cyan-100 font-semibold " +
    "shadow-[0_0_10px_rgba(56,189,248,0.6)] hover:shadow-[0_0_16px_rgba(56,189,248,0.9)] " +
    "transition-all duration-200 hover:animate-pulse";

  function closeWelcomeMenu() {
    welcomeMenuRef.current?.removeAttribute("open");
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background Video */}
      <video
        className="absolute inset-0 h-full w-full object-cover"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        aria-hidden="true"
      >
        <source src="/hero-background.mp4" type="video/mp4" />
      </video>
      {/* Keep existing theme as an overlay for readability */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900/80 via-purple-900/70 to-slate-900/80" />

      <div className="relative z-10">
      {/* Navigation */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold text-white">Hero Market</span>
        </div>
        <details ref={welcomeMenuRef} className="relative">
          <summary
            className={`${LINK_PILL} list-none cursor-pointer select-none`}
            aria-label="Open Welcome menu"
          >
            Welcome
          </summary>

          {/* Dropdown */}
          <div
            className="absolute right-0 mt-3 w-56 rounded-xl border border-white/10 bg-black/70 backdrop-blur-md p-2 shadow-[0_0_28px_rgba(56,189,248,0.15)]"
            role="menu"
          >
            <a
              href="https://www.paypal.com/ncp/payment/F2TG6ELW8M2B4"
              target="_blank"
              rel="noreferrer"
              className={`${LINK_PILL} w-full justify-center`}
              onClick={closeWelcomeMenu}
              role="menuitem"
            >
              JOIN COMMUNITY
            </a>

            <Link
              href="/consultations"
              className={`${LINK_PILL} w-full justify-center`}
              onClick={closeWelcomeMenu}
              role="menuitem"
            >
              Consultations
            </Link>

            <Link
              href="/admin"
              className={`${LINK_PILL} w-full justify-center`}
              onClick={closeWelcomeMenu}
              role="menuitem"
            >
              🔒 Admin Login
            </Link>

            <div className="my-3 border-t border-white/10" />

            <button
              type="button"
              onClick={async () => {
                closeWelcomeMenu();
                await handleLogout();
              }}
              disabled={loading || !isLoggedIn}
              className={`${LINK_PILL} w-full justify-center disabled:opacity-40 disabled:cursor-not-allowed`}
              aria-disabled={loading || !isLoggedIn}
              title={isLoggedIn ? "Log out" : "Not logged in"}
              role="menuitem"
            >
              Logout
            </button>
          </div>
        </details>
      </nav>

      {/* Main Content */}
      <main className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md bg-black/50 backdrop-blur-sm rounded-lg p-8 border border-white/10">
          <h1 className="text-3xl font-bold text-white text-center mb-2">
            Welcome to Hero Market
          </h1>
          <p className="text-slate-400 text-center mb-6">
            Your gateway to exclusive token-gated content
          </p>

          {/* Tab Buttons */}
          <div className="flex mb-6">
            <button
              onClick={() => setIsRegistering(true)}
              className={`flex-1 py-2 text-center rounded-l-lg transition-colors ${
                isRegistering
                  ? "bg-cyan-500 text-black font-semibold"
                  : "bg-slate-800 text-slate-400"
              }`}
            >
              Register
            </button>
            <button
              onClick={() => setIsRegistering(false)}
              className={`flex-1 py-2 text-center rounded-r-lg transition-colors ${
                !isRegistering
                  ? "bg-cyan-500 text-black font-semibold"
                  : "bg-slate-800 text-slate-400"
              }`}
            >
              Login
            </button>
          </div>

          {message && (
            <div className="mb-4 p-3 bg-green-500/20 border border-green-500 rounded text-green-400 text-sm">
              {message}
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500 rounded text-red-400 text-sm">
              {error}
            </div>
          )}

          {isRegistering ? (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-lg bg-slate-800 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  placeholder="your@email.com"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">
                  Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-lg bg-slate-800 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  placeholder="Choose a username"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-cyan-500 hover:bg-cyan-400 text-black font-semibold rounded-lg transition-colors disabled:opacity-50"
              >
                {loading ? "Creating..." : "Create Account"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">
                  Email or Username
                </label>
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-lg bg-slate-800 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  placeholder="Enter email or username"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full px-4 py-3 pr-12 rounded-lg bg-slate-800 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-cyan-500 hover:bg-cyan-400 text-black font-semibold rounded-lg transition-colors disabled:opacity-50"
              >
                {loading ? "Logging in..." : "Login"}
              </button>
            </form>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-slate-400 text-sm border-t border-white/10">
        <div className="flex items-center justify-center gap-3 pb-3">
          <a
            href="https://www.youtube.com/@officialtroothhurtz"
            target="_blank"
            rel="noreferrer"
            className={LINK_PILL}
            aria-label="Visit the official Trooth Hurtz YouTube channel"
          >
            YouTube
          </a>
        </div>
        <p>© 2024 Hero Market. All rights reserved.</p>
      </footer>
      </div>
    </div>
  );
}
