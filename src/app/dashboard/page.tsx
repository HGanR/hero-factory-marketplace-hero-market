// src/app/dashboard/page.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import MobileWalletButton from "@/components/MobileWalletButton";
import { useHeroAccess } from "@/hooks/useHeroAccess";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DashboardParticleBackground } from "@/components/dashboard/DashboardParticleBackground";
import { HolographicCard, HOLO_TILE_SM } from "@/components/dashboard/HolographicCard";
import { EntrepreneurStructureAssessment } from "@/components/dashboard/EntrepreneurStructureAssessment";
import { DashboardMissionControl } from "@/components/dashboard/DashboardMissionControl";
import { DashboardToolModules } from "@/components/dashboard/DashboardToolModules";
import { DashboardProgressHUD } from "@/components/dashboard/DashboardProgressHUD";
import { DashboardAIGuide } from "@/components/dashboard/DashboardAIGuide";
import { WorkspaceSelector } from "@/components/dashboard/WorkspaceSelector";
import { DashboardMicroTerminal } from "@/components/dashboard/DashboardMicroTerminal";

const ELECTRIC_BLUE = "#00D1FF";

type Chain = "All" | "Ethereum" | "Polygon" | "Solana" | "XRP";

/** Helpers for banner storage keyed by wallet address */
const BANNER_KEY_PREFIX = "hf_banner_data_";
const getBannerKey = (address: string) =>
  `${BANNER_KEY_PREFIX}${address.toLowerCase()}`;

/** Convert a File to a base64 data URL (persists across reloads on same browser). */
function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const rd = new FileReader();
    rd.onload = () => resolve(String(rd.result));
    rd.onerror = reject;
    rd.readAsDataURL(file);
  });
}

export default function DashboardPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();

  // Session (adapted to current app: marketplace localStorage + admin flag)
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [userInfo, setUserInfo] = useState<{ email?: string; username: string } | null>(
    null
  );

  // Token gating (lightweight hook)
  const { passesTokenGate, isCheckingTokens, isWalletConnected, onPolygon, tokenGateError } =
    useHeroAccess();

  useEffect(() => {
    try {
      const storedUser = localStorage.getItem("user");
      if (storedUser) {
        const parsed = JSON.parse(storedUser);
        setIsLoggedIn(true);
        setUserInfo({
          email: parsed?.email,
          username: parsed?.username || "User",
        });
      } else if (localStorage.getItem("adminLoggedIn") === "true") {
        setIsLoggedIn(true);
        setUserInfo({ username: "Admin" });
      } else {
        setIsLoggedIn(false);
        router.push("/");
      }
    } catch {
      setIsLoggedIn(false);
      router.push("/");
    } finally {
      setIsCheckingSession(false);
    }
  }, [router]);

  // Banner state - keyed by wallet address
  const [bannerDataUrl, setBannerDataUrl] = useState<string | null>(null);

  // Accessibility: message state
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Entrepreneur Structure Assessment
  const [assessmentOpen, setAssessmentOpen] = useState(false);

  // Gallery
  const [filter, setFilter] = useState<Chain>("All");
  const [gallery, setGallery] = useState<
    Array<{ name: string; image: string; chain: string; link?: string }>
  >([]);
  const [showCertificates, setShowCertificates] = useState(false);
  const [showMeetings, setShowMeetings] = useState(false);
  const [certificates, setCertificates] = useState<
    Array<{
      id: number;
      trust_id?: string | null;
      asset_address_url: string;
      seal_data: string;
      watermark_data: string;
      qr_data: string;
      barcode_data: string;
      notice_qr_data: string;
      render_data?: string;
      certificate_json?: string;
      created_at: string;
    }>
  >([]);
  const [certLoading, setCertLoading] = useState(false);
  const [certError, setCertError] = useState<string | null>(null);
  const [deletingCertId, setDeletingCertId] = useState<number | null>(null);

  // Meetings
  const [meetings, setMeetings] = useState<
    Array<{
      id: string;
      wallet_address: string;
      title: string;
      meeting_date: string;
      attendees: string | null;
      location: string | null;
      agenda: string | null;
      notes: string | null;
      resolutions: string | null;
      seal_data: string | null;
      watermark_data: string | null;
      qr_data: string | null;
      barcode_data: string | null;
      notice_qr_data: string | null;
      render_data: string | null;
      created_at: string;
    }>
  >([]);
  const [meetingsLoading, setMeetingsLoading] = useState(false);
  const [meetingsError, setMeetingsError] = useState<string | null>(null);

  function safeParseCertificateSnapshot(json?: string) {
    if (!json || typeof json !== "string") return null as any;
    try {
      return JSON.parse(json);
    } catch {
      return null as any;
    }
  }

  const [openCertificate, setOpenCertificate] = useState<(typeof certificates)[number] | null>(null);
  const fullCertificateRef = useRef<HTMLDivElement | null>(null);

  function formatUSD(n: unknown) {
    const num = typeof n === "number" ? n : Number.NaN;
    if (!Number.isFinite(num)) return "";
    return num.toLocaleString(undefined, { style: "currency", currency: "USD" });
  }

  function downloadText(filename: string, text: string, mime = "application/json") {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function downloadFullCertificatePng() {
    if (!openCertificate) return;
    try {
      // If we have a saved render image already, prefer downloading that directly.
      if (openCertificate.render_data && String(openCertificate.render_data).startsWith("data:image/")) {
        const a = document.createElement("a");
        a.href = String(openCertificate.render_data);
        a.download = `certificate-${openCertificate.id}.png`;
        a.click();
        return;
      }

      // Otherwise, capture what the modal is rendering.
      const html2canvas = (await import("html2canvas")).default;
      if (!fullCertificateRef.current) throw new Error("Certificate not ready to export");
      const canvas = await html2canvas(fullCertificateRef.current, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
      });
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = `certificate-${openCertificate.id}.png`;
      a.click();
    } catch (err) {
      console.error("Download PNG failed", err);
      alert("Failed to download PNG. Please try again.");
    }
  }

  function downloadFullCertificateJson() {
    if (!openCertificate) return;
    const snap = safeParseCertificateSnapshot(openCertificate.certificate_json);
    const json = snap ? JSON.stringify(snap, null, 2) : JSON.stringify(openCertificate, null, 2);
    downloadText(`certificate-${openCertificate.id}.json`, json, "application/json");
  }

  // Load banner when wallet address changes
  useEffect(() => {
    if (!address) {
      setBannerDataUrl(null);
      return;
    }
    try {
      const bannerKey = getBannerKey(address);
      const data = localStorage.getItem(bannerKey);
      setBannerDataUrl(data || null);
    } catch {
      setBannerDataUrl(null);
    }
  }, [address]);

  // Load gallery
  useEffect(() => {
    try {
      const raw = localStorage.getItem("hf_gallery");
      if (raw) setGallery(JSON.parse(raw));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      if (!showCertificates || !address) return;
      setCertLoading(true);
      setCertError(null);
      try {
        const res = await fetch(`/api/certificates?wallet=${address.toLowerCase()}`);
        if (!res.ok) {
          throw new Error("Failed to load certificates");
        }
        const data = await res.json();
        setCertificates(data.items ?? []);
      } catch (err) {
        console.error(err);
        setCertError("Could not load certificates");
      } finally {
        setCertLoading(false);
      }
    };
    load();
  }, [showCertificates, address]);

  useEffect(() => {
    const load = async () => {
      if (!showMeetings || !address) return;
      setMeetingsLoading(true);
      setMeetingsError(null);
      try {
        const res = await fetch(`/api/meetings?wallet=${address.toLowerCase()}`);
        if (!res.ok) {
          throw new Error("Failed to load meetings");
        }
        const data = await res.json();
        setMeetings(data.items ?? []);
      } catch (err) {
        console.error(err);
        setMeetingsError("Could not load meetings");
      } finally {
        setMeetingsLoading(false);
      }
    };
    load();
  }, [showMeetings, address]);

  // Derive gallery by chain filter
  const shown = useMemo(() => {
    if (filter === "All") return gallery;
    return gallery.filter((n) => n.chain === filter);
  }, [gallery, filter]);

  async function onPickBanner(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // allow selecting the same file again
    e.currentTarget.value = "";
    if (!file) return;

    setErrorMessage(null);
    setSuccessMessage(null);

    const okTypes = ["image/jpeg", "image/jpg", "image/png", "image/svg+xml"];
    if (!okTypes.includes(file.type)) {
      const msg = "Please upload JPEG, JPG, PNG or SVG";
      setErrorMessage(msg);
      setTimeout(() => setErrorMessage(null), 5000);
      return;
    }

    try {
      const dataUrl = await fileToDataURL(file);
      const bannerKey = address ? getBannerKey(address) : "hf_banner_guest";
      localStorage.setItem(bannerKey, dataUrl);
      setBannerDataUrl(dataUrl);
      setSuccessMessage("Banner uploaded successfully!");
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err) {
      console.error(err);
      const msg = "Failed to load banner. Please try a different image.";
      setErrorMessage(msg);
      setTimeout(() => setErrorMessage(null), 5000);
    }
  }

  const cyanPulseBtn =
    "pulse-blue btn-sparkle rounded-full h-11 px-5 flex items-center font-extrabold " +
    "transition-all hover:brightness-110 focus:ring-2 focus:ring-cyan-300 outline-none relative overflow-hidden";

  if (isCheckingSession) {
    return (
      <div
        className="min-h-screen text-white flex items-center justify-center"
        style={{ background: "#0a0e1a" }}
      >
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  if (!isLoggedIn) return null;

  return (
    <div
      className="min-h-screen text-white relative overflow-x-hidden"
      style={{
        background:
          "linear-gradient(180deg, #0a0e1a 0%, #0d1220 30%, #0a0e1a 70%, #060a12 100%)",
      }}
    >
      <DashboardParticleBackground />
      {/* Layered transparent gradient overlays for depth */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        aria-hidden
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(0,209,255,0.04) 0%, transparent 50%), " +
            "radial-gradient(ellipse 60% 40% at 80% 60%, rgba(139,92,246,0.03) 0%, transparent 50%), " +
            "radial-gradient(ellipse 50% 30% at 20% 80%, rgba(0,209,255,0.02) 0%, transparent 50%)",
        }}
      />
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-cyan-500 focus:text-black focus:rounded-lg focus:font-semibold"
      >
        Skip to main content
      </a>

      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {errorMessage && <span className="text-red-400">Error: {errorMessage}</span>}
        {successMessage && (
          <span className="text-green-400">Success: {successMessage}</span>
        )}
      </div>

      {/* Header */}
      <header
        className="relative z-10 border-b border-white/[0.08] backdrop-blur-xl"
        style={{
          background: "rgba(10, 14, 26, 0.6)",
          boxShadow: "0 1px 0 rgba(0,209,255,0.06), 0 1px 0 rgba(139,92,246,0.04)",
        }}
        role="banner"
      >
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-semibold">My Dashboard</h1>
              <EntrepreneurStructureAssessment
                open={assessmentOpen}
                onOpenChange={setAssessmentOpen}
              />
            </div>
            {userInfo && (
              <div className="flex items-center gap-4 mt-1">
                <div className="text-xs text-slate-400">
                  Logged in as: {userInfo.username}
                </div>
                <WorkspaceSelector />
                <button
                  type="button"
                  onClick={() => setAssessmentOpen(true)}
                  className="group inline-flex items-center gap-1.5 px-5 py-2.5 text-sm font-semibold transition-all duration-300 hover:scale-105 hover:brightness-125"
                  style={{
                    background: "linear-gradient(135deg, #00D1FF 0%, #00E5FF 50%, #7DF9FF 100%)",
                    color: "#0a0a0f",
                    boxShadow: "0 0 20px rgba(0,229,255,0.4), inset 0 0 20px rgba(255,255,255,0.1)",
                    borderRadius: "50% 50% 50% 50% / 60% 60% 40% 40%",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = "0 0 28px rgba(0,229,255,0.7), 0 0 40px rgba(125,249,255,0.3), inset 0 0 24px rgba(255,255,255,0.2)";
                    e.currentTarget.style.filter = "brightness(1.15)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = "0 0 20px rgba(0,229,255,0.4), inset 0 0 20px rgba(255,255,255,0.1)";
                    e.currentTarget.style.filter = "none";
                  }}
                  aria-label="Easter Egg Hunt – Entrepreneur Structure Assessment"
                >
                  <span className="transition-transform group-hover:scale-110" style={{ filter: "drop-shadow(0 0 4px rgba(0,229,255,0.8))" }}>🥚</span>
                  Easter Egg Hunt
                </button>
              </div>
            )}
            {address && (
              <div className="text-xs text-slate-400 mt-1">
                Wallet: {address.slice(0, 6)}...{address.slice(-4)}
              </div>
            )}
          </div>
          <nav className="flex items-center gap-3 flex-wrap" aria-label="Navigation">
            {isConnected ? (
              <div className="px-4 py-2 rounded-lg backdrop-blur-xl bg-white/[0.05] border border-cyan-500/30 shadow-[0_0_0_1px_rgba(0,209,255,0.15)]">
                <span className="text-sm text-cyan-400 font-mono">
                  {address?.slice(0, 6)}...{address?.slice(-4)}
                </span>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <MobileWalletButton />
                {/* Debug info for wallet connection */}
                <div className="text-xs text-slate-400 px-2">
                  Wallets: {typeof window !== 'undefined' && window.ethereum ? 'MetaMask detected' : 'No wallet detected'}
                </div>
              </div>
            )}

            {isConnected && onPolygon && (
              <div className="px-4 py-2 text-sm">
                {isCheckingTokens ? (
                  <span className="text-slate-400">Checking NFTs...</span>
                ) : passesTokenGate ? (
                  <span className="text-green-400">✓ Token Gate Passed</span>
                ) : (
                  <span className="text-red-400">⚠ No approved Hero NFT found</span>
                )}
              </div>
            )}

            <Link
              href="/"
              className="rounded-full border px-4 py-2 text-sm focus:ring-2 focus:ring-cyan-300 focus:outline-none"
              style={{ borderColor: "transparent" }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.borderColor = ELECTRIC_BLUE)
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.borderColor = "transparent")
              }
              aria-label="Return to home page"
            >
              Back Home
            </Link>
          </nav>
        </div>
      </header>

      <main id="main-content" className="relative z-10 max-w-7xl mx-auto">
        {/* Token Gate Warning */}
        {isWalletConnected && onPolygon && !isCheckingTokens && !passesTokenGate && (
          <section className="px-6 mt-6" role="alert">
            <div className="rounded-2xl border border-red-500/40 bg-red-500/10 backdrop-blur-xl p-6 text-center shadow-[0_0_0_1px_rgba(239,68,68,0.2)]">
              <h2 className="text-xl font-bold text-red-400 mb-2">
                ⚠️ Token Gate Not Passed
              </h2>
              <p className="text-slate-300 mb-4">
                You need to hold an approved Hero ERC-1155 NFT on Polygon to access
                the full dashboard features.
              </p>
              {tokenGateError && (
                <p className="text-sm text-red-300 mt-2">
                  Error: {tokenGateError}
                </p>
              )}
            </div>
          </section>
        )}

        <section className="px-6 mt-6" aria-label="Client workspace micro terminal (binds to header workspace selector)">
          <DashboardMicroTerminal />
        </section>

        {/* Banner builder */}
        <section className="px-6 mt-6" aria-labelledby="banner-heading">
          <HolographicCard accent="both" className="p-6">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <h2 id="banner-heading" className="text-lg font-semibold">
                  Profile Banner
                </h2>
                <div className="text-xs text-slate-400">
                  Upload your custom banner image. It will be saved to your connected
                  wallet address.
                </div>
              </div>
              <span
                className="text-xs text-slate-400"
                aria-label="Recommended banner dimensions"
              >
                Recommended: 1500×500
              </span>
            </div>

            <div className="mt-3">
              {bannerDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={bannerDataUrl}
                  alt={`Profile banner for ${
                    address
                      ? address.slice(0, 6) + "..." + address.slice(-4)
                      : "your wallet"
                  }`}
                  className="w-full h-48 md:h-56 object-cover rounded-xl"
                />
              ) : (
                <div
                  className="w-full h-48 md:h-56 rounded-xl bg-white/[0.03] backdrop-blur-sm border border-white/[0.06] grid place-items-center text-slate-400 text-sm text-center px-4"
                  role="img"
                  aria-label="No banner uploaded yet"
                >
                  {address
                    ? "No banner uploaded yet. Upload an image below to set your profile banner."
                    : "Connect your wallet to upload a banner"}
                </div>
              )}
            </div>

            <div className="mt-3">
              <label
                htmlFor="banner-upload"
                className="block text-sm font-medium text-slate-300 mb-2"
              >
                Upload Profile Banner
              </label>
              <input
                id="banner-upload"
                type="file"
                accept=".jpg,.jpeg,.png,.svg"
                onChange={onPickBanner}
                className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-slate-700 file:text-slate-100 focus:ring-2 focus:ring-cyan-300 focus:outline-none"
                aria-describedby="banner-upload-hint"
                aria-invalid={errorMessage ? "true" : "false"}
              />
              <div id="banner-upload-hint" className="text-xs text-slate-400 mt-1">
                Accepted formats: JPEG, JPG, PNG, or SVG. Recommended size: 1500×500
                pixels.
              </div>
              {errorMessage && (
                <div
                  id="banner-error"
                  role="alert"
                  className="text-xs text-red-400 mt-2"
                  aria-live="assertive"
                >
                  {errorMessage}
                </div>
              )}
              {successMessage && (
                <div role="status" className="text-xs text-green-400 mt-2" aria-live="polite">
                  {successMessage}
                </div>
              )}
            </div>
          </HolographicCard>
        </section>

        {/* NFT repository */}
        <section className="px-6 mt-8 pb-20" aria-labelledby="nft-heading">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <h2 id="nft-heading" className="text-lg font-semibold">
                Your NFTs
              </h2>
              <Link
                href="/nft-marketplace"
                className={cyanPulseBtn}
                style={{
                  backgroundColor: "#06b6d4",
                  color: "#000",
                  border: `2px solid ${ELECTRIC_BLUE}`,
                }}
              >
                NFT MARKET
              </Link>
            </div>
            <div className="flex items-center gap-2" role="group" aria-label="Filter NFTs by blockchain">
              {(["All", "Ethereum", "Polygon", "Solana", "XRP"] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => setFilter(c)}
                  aria-pressed={filter === c ? "true" : "false"}
                  aria-label={`Filter by ${c} blockchain`}
                  className={`px-3 py-1.5 rounded-xl text-sm focus:ring-2 focus:ring-cyan-300 focus:outline-none transition-all backdrop-blur-sm ${
                    filter === c
                      ? "bg-white/10 border border-cyan-500/40 shadow-[0_0_12px_-4px_rgba(0,209,255,0.2)]"
                      : "bg-white/[0.03] border border-white/[0.08] hover:border-cyan-500/25 hover:bg-white/[0.06]"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 w-full md:w-auto">
              <button
                type="button"
                onClick={() => setShowCertificates((v) => !v)}
                aria-pressed={showCertificates ? "true" : "false"}
                className={`px-3 py-1.5 rounded-xl text-sm focus:ring-2 focus:ring-cyan-300 focus:outline-none transition-all backdrop-blur-sm ${
                  showCertificates
                    ? "bg-white/10 border border-cyan-500/40 shadow-[0_0_12px_-4px_rgba(0,209,255,0.2)]"
                    : "bg-white/[0.03] border border-white/[0.08] hover:border-cyan-500/25 hover:bg-white/[0.06]"
                }`}
              >
                Certificate
              </button>
              <button
                type="button"
                onClick={() => setShowMeetings((v) => !v)}
                aria-pressed={showMeetings ? "true" : "false"}
                className={`px-3 py-1.5 rounded-xl text-sm focus:ring-2 focus:ring-cyan-300 focus:outline-none transition-all backdrop-blur-sm ${
                  showMeetings
                    ? "bg-white/10 border border-cyan-500/40 shadow-[0_0_12px_-4px_rgba(0,209,255,0.2)]"
                    : "bg-white/[0.03] border border-white/[0.08] hover:border-cyan-500/25 hover:bg-white/[0.06]"
                }`}
              >
                Meetings
              </button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-5" role="list" aria-label="NFT collection">
            {shown.length === 0 && (
              <div className="col-span-full text-sm text-slate-400" role="status">
                No NFTs found. You can mint on other sections or import later.
              </div>
            )}
            {shown.map((nft, i) => (
              <article
                key={i}
                className={`${HOLO_TILE_SM} p-4`}
                role="listitem"
              >
                <div className="h-44 rounded-xl overflow-hidden bg-white/[0.03] border border-white/[0.06] mb-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={nft.image}
                    alt={`${nft.name} NFT on ${nft.chain} blockchain`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
                <h3 className="font-semibold">{nft.name}</h3>
                <div className="text-xs text-slate-400" aria-label={`Blockchain: ${nft.chain}`}>
                  {nft.chain}
                </div>
                <div className="mt-3 flex gap-2">
                  <Link
                    href="/tokens"
                    className="rounded-lg border px-3 py-1.5 text-sm focus:ring-2 focus:ring-cyan-300 focus:outline-none transition-colors"
                    style={{ borderColor: ELECTRIC_BLUE }}
                    aria-label={`List ${nft.name} for sale`}
                  >
                    List for sale
                  </Link>
                  {nft.link && (
                    <a
                      href={nft.link}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg border px-3 py-1.5 text-sm border-slate-600 focus:ring-2 focus:ring-cyan-300 focus:outline-none transition-colors hover:border-slate-500"
                      aria-label={`View transaction for ${nft.name} (opens in new tab)`}
                    >
                      View tx
                    </a>
                  )}
                </div>
              </article>
            ))}
          </div>

          {/* Mission Control HUD */}
          <nav className="mt-8 space-y-6" aria-label="Mission Control">
            <DashboardMissionControl />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <DashboardToolModules />
              </div>
              <div className="space-y-6">
                <DashboardProgressHUD />
                <DashboardAIGuide />
              </div>
            </div>
          </nav>

          {showCertificates && (
            <div className="mt-8 space-y-3">
              <div className="text-lg font-semibold">Certificates</div>
              {certLoading ? (
                <div className="text-sm text-slate-300">Loading certificates…</div>
              ) : certError ? (
                <div className="text-sm text-red-400">{certError}</div>
              ) : certificates.length === 0 ? (
                <div className="text-sm text-slate-300">No certificates saved for this wallet.</div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {certificates.map((c) => (
                    <div
                      key={c.id}
                      className={`${HOLO_TILE_SM} p-4 flex flex-col gap-2`}
                    >
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span>Saved</span>
                        <span>{new Date(c.created_at).toLocaleString()}</span>
                      </div>
                      {c.trust_id ? (
                        <div className="text-[11px] text-slate-400">
                          Trust ID: <span className="font-mono text-slate-200">{String(c.trust_id).slice(0, 12)}…</span>
                        </div>
                      ) : null}
                      {(() => {
                        const snap = safeParseCertificateSnapshot(c.certificate_json);
                        const cfg = snap?.config ?? null;
                        const cert = snap?.certificate ?? null;
                        const issuedAt = cert?.issuedAt ? String(cert.issuedAt).slice(0, 10) : null;
                        const denomination =
                          typeof cert?.denominationUSD === "number" ? formatUSD(cert.denominationUSD) : "";
                        const ownerName = cert?.ownerName ? String(cert.ownerName) : "";
                        const serial = cert?.serialNumber ? String(cert.serialNumber) : "";
                        const status = cert?.status ? String(cert.status) : "";
                        const entityName = cfg?.entityName ? String(cfg.entityName) : "";
                        const entityType = cfg?.entityType ? String(cfg.entityType) : "";
                        const certificatePrefix = cfg?.certificatePrefix ? String(cfg.certificatePrefix) : "";
                        const unitsAuthorized =
                          typeof cfg?.unitsAuthorized === "number" ? String(cfg.unitsAuthorized) : "";
                        const trusteesDisplayName = cfg?.trusteesDisplayName ? String(cfg.trusteesDisplayName) : "";

                        return (
                          <>
                            {/* Thumbnail (compact) */}
                            <div className="relative overflow-hidden rounded-xl border border-slate-800 bg-white h-44">
                              {c.render_data ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  alt="Certificate render"
                                  src={c.render_data}
                                  className="absolute inset-0 w-full h-full object-contain"
                                />
                              ) : (
                                <>
                                  {c.watermark_data ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      alt="Watermark"
                                      src={c.watermark_data}
                                      className="absolute inset-0 w-full h-full object-contain opacity-20"
                                    />
                                  ) : null}
                                  {c.seal_data ? (
                                    <div className="absolute top-2 right-2 h-10 w-10 rounded-full border border-slate-200 bg-white/90 p-0.5">
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img alt="Seal" src={c.seal_data} className="h-full w-full object-cover rounded-full" />
                                    </div>
                                  ) : null}
                                  <div className="absolute inset-0 p-3">
                                    {entityName ? (
                                      <div className="text-xs font-semibold text-slate-900 line-clamp-2">{entityName}</div>
                                    ) : (
                                      <div className="text-xs text-slate-500">Resave certificate to include full details.</div>
                                    )}
                                    {ownerName ? (
                                      <div className="mt-1 text-[11px] text-slate-700 line-clamp-2">{ownerName}</div>
                                    ) : null}
                                    {denomination ? (
                                      <div className="mt-1 text-[11px] text-slate-700">{denomination}</div>
                                    ) : null}
                                  </div>
                                  {/* Codes row */}
                                  {c.barcode_data ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      alt="Barcode"
                                      src={c.barcode_data}
                                      className="absolute bottom-2 left-1/2 -translate-x-1/2 h-9 object-contain"
                                    />
                                  ) : null}
                                  {c.qr_data ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      alt="QR"
                                      src={c.qr_data}
                                      className="absolute bottom-2 left-2 h-10 w-10 object-contain rounded border"
                                    />
                                  ) : null}
                                  {c.notice_qr_data ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      alt="Notice QR"
                                      src={c.notice_qr_data}
                                      className="absolute bottom-2 right-2 h-10 w-10 object-contain rounded border"
                                    />
                                  ) : null}
                                </>
                              )}
                            </div>

                            {/* Metadata (always visible on card) */}
                            <div className="space-y-1">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="text-sm font-semibold text-white line-clamp-1">
                                    {entityName || "Trust Certificate"}
                                  </div>
                                  <div className="text-[11px] text-slate-400 line-clamp-1">
                                    {entityType ? `${entityType}` : ""}
                                    {certificatePrefix ? `${entityType ? " • " : ""}${certificatePrefix}` : ""}
                                    {unitsAuthorized ? `${entityType || certificatePrefix ? " • " : ""}Units: ${unitsAuthorized}` : ""}
                                  </div>
                                </div>
                                {c.seal_data ? (
                                  <div className="h-8 w-8 rounded-full border border-slate-700 overflow-hidden shrink-0">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img alt="Seal" src={c.seal_data} className="h-full w-full object-cover" />
                                  </div>
                                ) : null}
                              </div>

                              {ownerName ? (
                                <div className="text-xs text-slate-200 line-clamp-2">
                                  <span className="text-slate-400">Beneficial Owner:</span> {ownerName}
                                </div>
                              ) : null}

                              <div className="flex flex-wrap gap-2 text-[11px] text-slate-300">
                                {serial ? <span className="rounded-full border border-slate-700 px-2 py-0.5">Serial: {serial}</span> : null}
                                {status ? <span className="rounded-full border border-slate-700 px-2 py-0.5">{status}</span> : null}
                                {denomination ? <span className="rounded-full border border-slate-700 px-2 py-0.5">{denomination}</span> : null}
                              </div>

                              {cert?.notes ? (
                                <div className="text-[11px] text-slate-300 line-clamp-3 whitespace-pre-line">
                                  {String(cert.notes)}
                                </div>
                              ) : null}

                              {trusteesDisplayName ? (
                                <div className="text-[11px] text-slate-400 line-clamp-1">
                                  <span className="text-slate-500">Trustees:</span> {trusteesDisplayName}
                                </div>
                              ) : null}
                            </div>
                          </>
                        );
                      })()}
                      {c.asset_address_url ? (
                        <div className="flex items-center gap-3 flex-wrap">
                          <a
                            href={c.asset_address_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-cyan-400 text-sm underline font-semibold"
                          >
                            Asset link
                          </a>
                          <span className="text-cyan-400 text-sm font-semibold">
                            {(() => {
                              const snap = safeParseCertificateSnapshot(c.certificate_json);
                              const issuedAt = snap?.certificate?.issuedAt ? String(snap.certificate.issuedAt).slice(0, 10) : null;
                              const fallback = c.created_at ? new Date(c.created_at).toLocaleDateString() : "";
                              return `Issued: ${issuedAt || fallback}`;
                            })()}
                          </span>
                        </div>
                      ) : (
                        <div className="text-xs text-slate-400">No asset URL</div>
                      )}

                      <button
                        type="button"
                        onClick={() => setOpenCertificate(c)}
                        className="mt-1 px-3 py-2 rounded-xl border border-slate-700 hover:border-slate-500 text-sm text-slate-200 transition-colors"
                      >
                        View Full Certificate
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Meetings Section */}
          {showMeetings && (
            <div className="mt-8 space-y-3">
              <div className="text-lg font-semibold">Meetings</div>
              {meetingsLoading ? (
                <div className="text-sm text-slate-300">Loading meetings…</div>
              ) : meetingsError ? (
                <div className="text-sm text-red-400">{meetingsError}</div>
              ) : meetings.length === 0 ? (
                <div className="text-sm text-slate-300">No meetings saved for this wallet.</div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {meetings.map((meeting: any) => (
                    <div
                      key={meeting.id}
                      className={`${HOLO_TILE_SM} p-4 flex flex-col gap-3`}
                    >
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span>Saved</span>
                        <span>{new Date(meeting.created_at).toLocaleString()}</span>
                      </div>
                      {meeting.render_data ? (
                        <div className="relative overflow-hidden rounded-xl border border-slate-800 bg-white">
                          <img alt="Meeting render" src={meeting.render_data} className="w-full h-full object-contain" />
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <h3 className="font-semibold text-white">{meeting.title}</h3>
                          <div className="text-sm text-slate-300">
                            <div><strong>Date:</strong> {meeting.meeting_date ? new Date(meeting.meeting_date).toLocaleDateString() : 'N/A'}</div>
                            <div><strong>Location:</strong> {meeting.location || 'N/A'}</div>
                            <div><strong>Attendees:</strong> {meeting.attendees ? meeting.attendees.substring(0, 50) + (meeting.attendees.length > 50 ? '...' : '') : 'N/A'}</div>
                          </div>
                        </div>
                      )}
                      <div className="mt-auto">
                        <details className="text-sm">
                          <summary className="cursor-pointer text-cyan-400 hover:text-cyan-300">View Details</summary>
                          <div className="mt-2 space-y-2 text-slate-300">
                            <h4 className="font-semibold text-white">{meeting.title}</h4>
                            <div><strong>Date:</strong> {meeting.meeting_date ? new Date(meeting.meeting_date).toLocaleDateString() : 'N/A'}</div>
                            <div><strong>Location:</strong> {meeting.location || 'N/A'}</div>
                            {meeting.attendees && (
                              <div>
                                <strong>Attendees:</strong>
                                <div className="text-xs mt-1">{meeting.attendees}</div>
                              </div>
                            )}
                            {meeting.agenda && (
                              <div>
                                <strong>Agenda:</strong>
                                <div className="text-xs mt-1 whitespace-pre-line">{meeting.agenda}</div>
                              </div>
                            )}
                            {meeting.notes && (
                              <div>
                                <strong>Notes:</strong>
                                <div className="text-xs mt-1 whitespace-pre-line">{meeting.notes}</div>
                              </div>
                            )}
                            {meeting.resolutions && (
                              <div>
                                <strong>Resolutions:</strong>
                                <div className="text-xs mt-1 whitespace-pre-line">{meeting.resolutions}</div>
                              </div>
                            )}
                          </div>
                        </details>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      </main>

      <style jsx global>{`
        @keyframes electricPulse {
          0%,
          100% {
            box-shadow: 0 0 16px rgba(0, 209, 255, 0.45),
              inset 0 0 10px rgba(0, 209, 255, 0.2);
          }
          50% {
            box-shadow: 0 0 34px rgba(0, 209, 255, 0.75),
              inset 0 0 16px rgba(0, 209, 255, 0.3);
          }
        }
        @keyframes sparkle {
          0% {
            transform: translateX(-100%) translateY(-100%) rotate(0deg);
            opacity: 0;
          }
          20% {
            opacity: 0.8;
          }
          80% {
            opacity: 0.6;
          }
          100% {
            transform: translateX(100%) translateY(100%) rotate(180deg);
            opacity: 0;
          }
        }
        .pulse-blue {
          border-radius: 9999px;
          animation: electricPulse 1.8s ease-in-out infinite;
        }
        .btn-sparkle::after {
          content: "";
          position: absolute;
          inset: -2px;
          background: linear-gradient(
            120deg,
            transparent 30%,
            rgba(255, 255, 255, 0.4) 45%,
            rgba(0, 209, 255, 0.6) 50%,
            rgba(255, 255, 255, 0.4) 55%,
            transparent 70%
          );
          background-size: 200% 200%;
          opacity: 0;
          pointer-events: none;
          border-radius: inherit;
          z-index: 0;
        }
        .btn-sparkle:hover::after,
        .btn-sparkle:focus-visible::after {
          animation: sparkle 0.6s ease-out forwards;
          opacity: 1;
        }
        .btn-sparkle > * {
          position: relative;
          z-index: 1;
        }
        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border-width: 0;
        }
        .sr-only:focus,
        .focus\\:not-sr-only:focus {
          position: static;
          width: auto;
          height: auto;
          padding: inherit;
          margin: inherit;
          overflow: visible;
          clip: auto;
          white-space: normal;
        }
      `}</style>

      <Dialog open={!!openCertificate} onOpenChange={(open) => (open ? null : setOpenCertificate(null))}>
        <DialogContent className="max-w-5xl bg-slate-950 text-slate-100 border border-cyan-500/30">
          <DialogHeader>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <DialogTitle>Certificate</DialogTitle>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={downloadFullCertificatePng}
                  className="px-3 py-2 rounded-xl border border-slate-700 hover:border-slate-500 text-sm text-slate-200 transition-colors"
                >
                  Download PNG
                </button>
                <button
                  type="button"
                  onClick={downloadFullCertificateJson}
                  className="px-3 py-2 rounded-xl border border-slate-700 hover:border-slate-500 text-sm text-slate-200 transition-colors"
                >
                  Download JSON
                </button>
              </div>
            </div>
          </DialogHeader>

          {openCertificate ? (
            <div ref={fullCertificateRef} className="max-h-[75vh] overflow-auto rounded-xl border border-white/10 bg-black/30 p-4">
              {openCertificate.render_data ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  alt="Full certificate render"
                  src={openCertificate.render_data}
                  className="w-full h-auto object-contain bg-white rounded-lg"
                />
              ) : (
                (() => {
                  const snap = safeParseCertificateSnapshot(openCertificate.certificate_json);
                  const cfg = snap?.config ?? {};
                  const cert = snap?.certificate ?? {};
                  const assets = Array.isArray(snap?.assets) ? snap.assets : [];
                  const backingIds = Array.isArray(cert?.backingAssetIds) ? cert.backingAssetIds : [];
                  const backingAssets = assets.filter((a: any) => backingIds.includes(a?.id));

                  return (
                    <div className="bg-white text-slate-900 rounded-lg p-8">
                      <div className="flex items-start justify-between gap-6">
                        <div>
                          <div className="text-xs uppercase tracking-wider text-slate-500">Trust Certificate</div>
                          <div className="mt-1 text-2xl font-semibold">
                            {String(cfg?.entityName ?? "—")}
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                            {cfg?.entityType ? (
                              <span className="rounded-full border px-3 py-1 bg-purple-50 text-purple-700 border-purple-300">
                                {String(cfg.entityType)}
                              </span>
                            ) : null}
                            {openCertificate.trust_id ? (
                              <span className="rounded-full border px-3 py-1 bg-slate-50">
                                Trust ID: {String(openCertificate.trust_id).slice(0, 12)}…
                              </span>
                            ) : null}
                            {cert?.serialNumber ? (
                              <span className="rounded-full border px-3 py-1 bg-slate-50">
                                Serial: {String(cert.serialNumber)}
                              </span>
                            ) : null}
                            {cert?.status ? (
                              <span className="rounded-full border px-3 py-1 bg-slate-50">
                                {String(cert.status)}
                              </span>
                            ) : null}
                            {cert?.issuedAt ? (
                              <span className="rounded-full border px-3 py-1 bg-slate-50">
                                Issued: {String(cert.issuedAt).slice(0, 10)}
                              </span>
                            ) : null}
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-3">
                          {openCertificate.seal_data ? (
                            <div className="flex items-center gap-2">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                alt="Seal"
                                src={openCertificate.seal_data}
                                className="h-16 w-16 rounded-full border object-cover"
                              />
                            </div>
                          ) : (
                            <div className="text-xs text-slate-500">No seal uploaded</div>
                          )}
                          <div className="text-right">
                            <div className="text-xs text-slate-500">Denomination</div>
                            <div className="text-xl font-semibold">{formatUSD(cert?.denominationUSD) || "—"}</div>
                          </div>
                        </div>
                      </div>

                      <div className="my-6 h-px bg-slate-200" />

                      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                        <div>
                          <div className="text-sm font-medium text-slate-700">Beneficial Owner</div>
                          <div className="mt-1 text-lg font-semibold">{String(cert?.ownerName ?? "—")}</div>
                          <div className="mt-3 text-xs text-slate-600">
                            This certificate evidences a beneficial interest as defined by the Trust’s governing instrument and minutes. It
                            conveys no managerial authority unless expressly granted.
                          </div>
                          {openCertificate.asset_address_url ? (
                            <div className="mt-3 text-xs">
                              <a
                                href={openCertificate.asset_address_url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-cyan-600 underline font-semibold"
                              >
                                Asset Address
                              </a>
                            </div>
                          ) : null}
                        </div>

                        <div>
                          <div className="text-sm font-medium text-slate-700">Asset Backing (Referenced)</div>
                          <div className="mt-2 space-y-2">
                            {backingAssets.length ? (
                              backingAssets.map((a: any) => (
                                <div key={String(a?.id)} className="rounded-xl border bg-slate-50 p-3">
                                  <div className="flex flex-wrap items-start justify-between gap-2">
                                    <div className="min-w-0 break-words font-medium">{String(a?.name ?? "—")}</div>
                                    <div className="shrink-0 text-right text-sm text-slate-700 whitespace-nowrap">
                                      {a?.valuationUSD ? formatUSD(a.valuationUSD) : "—"}
                                    </div>
                                  </div>
                                  <div className="mt-1 break-words text-xs text-slate-600">
                                    {String(a?.type ?? "")}
                                    {a?.identifier ? ` • ${String(a.identifier)}` : ""}
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="text-xs text-slate-500">—</div>
                            )}
                          </div>
                        </div>
                      </div>

                      {cert?.notes ? (
                        <div className="mt-6">
                          <div className="text-sm font-medium text-slate-700">Notes</div>
                          <div className="mt-2 rounded-xl border bg-slate-50 p-3 text-sm text-slate-700 whitespace-pre-line">
                            {String(cert.notes)}
                          </div>
                        </div>
                      ) : null}

                      <div className="my-6 h-px bg-slate-200" />

                      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                        <div>
                          <div className="text-sm font-medium text-slate-700">Trustee Attestation</div>
                          <div className="mt-8 flex items-end justify-between">
                            <div className="w-2/3">
                              <div className="h-px w-full bg-slate-300" />
                              <div className="mt-2 text-xs text-slate-600">{String(cfg?.trusteesDisplayName ?? "—")}</div>
                            </div>
                            <div className="text-right text-xs text-slate-600">
                              {cert?.issuedAt ? String(cert.issuedAt).slice(0, 10) : ""}
                            </div>
                          </div>
                        </div>

                        <div>
                          <div className="text-sm font-medium text-slate-700">Audit Hash</div>
                          <div className="mt-2 break-all rounded-xl border bg-slate-50 p-3 font-mono text-xs text-slate-700">
                            {String(cert?.documentHash ?? "—")}
                          </div>
                          <div className="mt-2 text-xs text-slate-600">
                            Hash computed from the canonical certificate payload. Anchor on-chain if desired.
                          </div>
                        </div>
                      </div>

                      {(openCertificate.qr_data || openCertificate.barcode_data || openCertificate.notice_qr_data) && (
                        <div className="mt-8 pt-4 border-t border-slate-200">
                          <div className="w-full grid grid-cols-[96px_minmax(0,1fr)_96px] items-end gap-6">
                            <div className="flex justify-start">
                              {openCertificate.qr_data ? (
                                <div className="flex flex-col items-center gap-1">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    alt="QR"
                                    src={openCertificate.qr_data}
                                    className="h-24 w-24 rounded border border-slate-300 bg-white p-1 object-contain"
                                    style={{ imageRendering: "pixelated" as any }}
                                  />
                                  <div className="text-[10px] text-slate-600">QR</div>
                                </div>
                              ) : null}
                            </div>
                            <div className="flex justify-center">
                              {openCertificate.barcode_data ? (
                                <div className="flex flex-col items-center gap-1">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    alt="Barcode"
                                    src={openCertificate.barcode_data}
                                    className="h-12 w-full max-w-[360px] rounded border border-slate-300 bg-white p-1 object-contain"
                                  />
                                  <div className="text-[10px] text-slate-600">Barcode</div>
                                </div>
                              ) : null}
                            </div>
                            <div className="flex justify-end">
                              {openCertificate.notice_qr_data ? (
                                <div className="flex flex-col items-center gap-1">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    alt="QR (Right)"
                                    src={openCertificate.notice_qr_data}
                                    className="h-24 w-24 rounded border border-slate-300 bg-white p-1 object-contain"
                                    style={{ imageRendering: "pixelated" as any }}
                                  />
                                  <div className="text-[10px] text-slate-600">QR</div>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

