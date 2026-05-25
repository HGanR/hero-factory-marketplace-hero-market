// src/app/page.tsx - Register, Login, Welcome menu (Admin, Consultations, etc.)
"use client";

import { Suspense, useEffect, useState } from "react";
import { landingCtaMetadata, LANDING_HOME_SITE_EVENTS } from "@/lib/analytics/landing-site-event-metadata";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Eye, EyeOff } from "lucide-react";
import { LandingParallaxDepth } from "@/components/landing/LandingParallaxDepth";
import { LandingAmbientChips } from "@/components/landing/LandingAmbientChips";
import { LandingRotatingTagline } from "@/components/landing/LandingRotatingTagline";
import { LandingHeroEnhancements } from "@/components/landing/LandingHeroEnhancements";
import { LandingHomeScrollSections } from "@/components/landing/LandingHomeScrollSections";
import { LandingRevenueMarketingSection } from "@/components/landing/LandingRevenueMarketingSection";
import { LandingCommunityVideo } from "@/components/landing/LandingCommunityVideo";
import { LandingSiteAnalytics } from "@/components/landing/LandingSiteAnalytics";
import { trackSiteEvent } from "@/lib/analytics/site-analytics-client";

const LandingParticleCloud = dynamic(
  () =>
    import("@/components/landing/LandingParticleCloud").then(
      (m) => m.LandingParticleCloud,
    ),
  { ssr: false },
);

const LandingParticleBackground = dynamic(
  () =>
    import("@/components/landing/LandingParticleBackground").then(
      (m) => m.LandingParticleBackground,
    ),
  { ssr: false },
);

const RealityChatBot = dynamic(
  () => import("@/components/landing/RealityChatBot"),
  { ssr: false },
);

const ELECTRIC_BLUE = "#00D1FF";

/** Internal path only — used with `/?returnTo=` after AuthGate redirect. */
function sanitizeReturnTo(raw: string | null | undefined): string | null {
  if (raw == null || typeof raw !== "string") return null;
  let s = raw.trim();
  if (!s) return null;
  try {
    s = decodeURIComponent(s);
  } catch {
    return null;
  }
  s = s.trim();
  if (!s.startsWith("/") || s.startsWith("//")) return null;
  if (s.includes("://")) return null;
  const noHash = s.split("#")[0]?.trim();
  return noHash || null;
}

function HomePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnToSafe = sanitizeReturnTo(searchParams.get("returnTo"));
  const [showStartArrow, setShowStartArrow] = useState(true);
  const [isRegistering, setIsRegistering] = useState(true);
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [smsConsent, setSmsConsent] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showWelcomeMenu, setShowWelcomeMenu] = useState(false);
  const [showDemosMenu, setShowDemosMenu] = useState(false);

  function trackLandingCta(
    eventName: string,
    source: string,
    label: string,
    targetHref?: string,
    eventType: "page_view" | "button_click" | "conversion_intent" | "outbound_paypal" | "agent_interaction" = "button_click",
    extra?: Record<string, unknown>,
  ) {
    void trackSiteEvent({
      path: "/",
      eventType,
      metadata: {
        ...landingCtaMetadata({
          eventName,
          source,
          route: "/",
          label,
          targetHref: targetHref ?? null,
        }),
        ...(extra ?? {}),
      },
    });
  }

  useEffect(() => {
    try {
      const hasUser = !!localStorage.getItem("user");
      const hasAdmin = localStorage.getItem("adminLoggedIn") === "true";
      setIsLoggedIn(hasUser || hasAdmin);
    } catch {
      setIsLoggedIn(false);
    }
  }, []);

  /** If AuthGate sent us here with `?returnTo=` but the user is already signed in (dashboard-style session), continue to the target. */
  useEffect(() => {
    if (!returnToSafe) return;
    try {
      const hasUser = !!localStorage.getItem("user");
      const hasAdmin = localStorage.getItem("adminLoggedIn") === "true";
      if (hasUser || hasAdmin) {
        window.location.replace(returnToSafe);
      }
    } catch {
      /* ignore */
    }
  }, [returnToSafe]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Element;
      if (showWelcomeMenu && !target.closest(".welcome-menu")) {
        setShowWelcomeMenu(false);
      }
      if (showDemosMenu && !target.closest(".demos-menu")) {
        setShowDemosMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showWelcomeMenu, showDemosMenu]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/marketplace/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email,
          username,
          phone: phone.trim() || undefined,
          smsConsent,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
      } else {
        setMessage(data.message);
        setEmail("");
        setUsername("");
        setPhone("");
        setSmsConsent(false);
      }
    } catch {
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
        credentials: "include",
        body: JSON.stringify({ identifier, password }),
      });
      const text = await res.text();
      let data: { error?: string; user?: unknown };
      try {
        data = JSON.parse(text) as { error?: string; user?: unknown };
      } catch {
        setError(
          res.status >= 500
            ? `Login failed (server error ${res.status}).`
            : `Login failed (bad response, ${res.status}).`,
        );
        return;
      }
      if (!res.ok) {
        setError(data.error || `Login failed (${res.status})`);
      } else {
        localStorage.setItem("user", JSON.stringify(data.user));
        setIsLoggedIn(true);
        const next =
          returnToSafe ||
          sanitizeReturnTo(
            new URLSearchParams(typeof window !== "undefined" ? window.location.search : "").get(
              "returnTo",
            ),
          );
        // Hard navigation so Set-Cookie is applied before protected routes (matches AuthGate).
        window.location.href = next || "/dashboard";
      }
    } catch {
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
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch {}
    try {
      localStorage.removeItem("user");
      localStorage.removeItem("adminLoggedIn");
    } catch {}
    setIsLoggedIn(false);
    setLoading(false);
    router.push("/");
    router.refresh();
  };

  const LINK_PILL =
    "relative inline-flex items-center px-3 py-1 rounded-full border border-cyan-400 text-cyan-100 font-semibold " +
    "shadow-[0_0_10px_rgba(56,189,248,0.6)] hover:shadow-[0_0_16px_rgba(56,189,248,0.9)] " +
    "transition-all duration-200 hover:animate-pulse";

  return (
    <div className="landing-home-root min-h-screen relative overflow-x-hidden">
      <div className="absolute inset-0 z-0 bg-slate-950" aria-hidden="true" />
      <div
        className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/landing-background.png')" }}
        aria-hidden="true"
      />
      <LandingParallaxDepth />
      <LandingSiteAnalytics />
      <div className="absolute inset-0 z-[2]">
        <LandingParticleBackground />
      </div>

      <div className="relative z-10">
        <nav className="relative z-20 flex flex-wrap items-center justify-between gap-4 px-6 pt-12 pb-4 border-b border-white/10">
          <Link
            href="/"
            className="flex items-center gap-2 text-white hover:text-cyan-400 transition-colors"
            onClick={() =>
              trackLandingCta(
                LANDING_HOME_SITE_EVENTS.HERO_BRAND,
                "landing_nav",
                "Hero Market logo",
                "/",
              )
            }
          >
            <span className="text-2xl font-bold">Hero Market</span>
          </Link>
          <div className="flex items-center gap-3 flex-shrink-0 ml-auto sm:ml-0">
            <div className="relative demos-menu">
              <button
                type="button"
                className={`${LINK_PILL} cursor-pointer select-none`}
                onClick={() => {
                  setShowDemosMenu(!showDemosMenu);
                  setShowStartArrow(false);
                }}
                aria-expanded={showDemosMenu}
                aria-haspopup="menu"
                aria-label="Open demos menu"
              >
                DEMOS
              </button>
              {showDemosMenu && (
                <div
                  className="absolute top-full right-0 mt-2 min-w-[14rem] w-56 rounded-xl border border-white/10 bg-black/70 backdrop-blur-md p-3 shadow-[0_0_28px_rgba(56,189,248,0.15)] z-50 flex flex-col gap-2"
                  role="menu"
                >
                  <p className="px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Choose industry
                  </p>
                  <Link
                    href="/for-realtors"
                    className={`${LINK_PILL} w-full justify-center`}
                    onClick={() => {
                      trackLandingCta(
                        LANDING_HOME_SITE_EVENTS.DEMOS_INDUSTRY_CTA,
                        "demos_menu",
                        "Realtors",
                        "/for-realtors",
                      );
                      setShowDemosMenu(false);
                    }}
                    role="menuitem"
                  >
                    Realtors
                  </Link>
                  <Link
                    href="/for-salon-professionals"
                    className={`${LINK_PILL} w-full justify-center`}
                    onClick={() => {
                      trackLandingCta(
                        LANDING_HOME_SITE_EVENTS.DEMOS_INDUSTRY_CTA,
                        "demos_menu",
                        "Salon professionals",
                        "/for-salon-professionals",
                      );
                      setShowDemosMenu(false);
                    }}
                    role="menuitem"
                  >
                    Salon Professionals
                  </Link>
                  <Link
                    href="/for-insurance-brokers"
                    className={`${LINK_PILL} w-full justify-center`}
                    onClick={() => {
                      trackLandingCta(
                        LANDING_HOME_SITE_EVENTS.DEMOS_INDUSTRY_CTA,
                        "demos_menu",
                        "Insurance",
                        "/for-insurance-brokers",
                      );
                      setShowDemosMenu(false);
                    }}
                    role="menuitem"
                  >
                    INSURANCE
                  </Link>
                  <Link
                    href="/for-transportation-services"
                    className={`${LINK_PILL} w-full justify-center`}
                    onClick={() => {
                      trackLandingCta(
                        LANDING_HOME_SITE_EVENTS.DEMOS_INDUSTRY_CTA,
                        "demos_menu",
                        "Transportation",
                        "/for-transportation-services",
                      );
                      setShowDemosMenu(false);
                    }}
                    role="menuitem"
                  >
                    TRANSPORTATION
                  </Link>
                  <Link
                    href="/for-tax-professionals"
                    className={`${LINK_PILL} w-full justify-center`}
                    onClick={() => {
                      trackLandingCta(
                        LANDING_HOME_SITE_EVENTS.DEMOS_INDUSTRY_CTA,
                        "demos_menu",
                        "Tax preparers",
                        "/for-tax-professionals",
                      );
                      setShowDemosMenu(false);
                    }}
                    role="menuitem"
                  >
                    TAX PREPARERS
                  </Link>
                  <Link
                    href="/for-barbershops"
                    className={`${LINK_PILL} w-full justify-center`}
                    onClick={() => {
                      trackLandingCta(
                        LANDING_HOME_SITE_EVENTS.DEMOS_INDUSTRY_CTA,
                        "demos_menu",
                        "Barbershops",
                        "/for-barbershops",
                      );
                      setShowDemosMenu(false);
                    }}
                    role="menuitem"
                  >
                    BARBERSHOPS
                  </Link>
                  <Link
                    href="/for-mechanics"
                    className={`${LINK_PILL} w-full justify-center`}
                    onClick={() => {
                      trackLandingCta(
                        LANDING_HOME_SITE_EVENTS.DEMOS_INDUSTRY_CTA,
                        "demos_menu",
                        "Auto specialist",
                        "/for-mechanics",
                      );
                      setShowDemosMenu(false);
                    }}
                    role="menuitem"
                  >
                    AUTO SPECIALIST
                  </Link>
                </div>
              )}
            </div>
            <div className="relative welcome-menu flex items-center gap-1 flex-shrink-0">
              {showStartArrow && (
                <div
                  className="animate-neon-flicker animate-neon-pulse flex items-center gap-1 px-3 py-2 rounded-lg"
                  style={{
                    color: ELECTRIC_BLUE,
                    backgroundColor: "rgba(0, 209, 255, 0.12)",
                    border: `1px solid ${ELECTRIC_BLUE}`,
                    boxShadow: `0 0 12px rgba(0, 209, 255, 0.5)`,
                  }}
                  aria-hidden="true"
                >
                  <span className="text-sm font-bold uppercase tracking-wider">
                    Start here
                  </span>
                  <ChevronRight className="h-5 w-5" strokeWidth={2.5} />
                </div>
              )}
              <button
                className={`${LINK_PILL} cursor-pointer select-none`}
                onClick={() => {
                  setShowWelcomeMenu(!showWelcomeMenu);
                  setShowStartArrow(false);
                }}
                aria-label="Open Welcome menu"
              >
                Welcome
              </button>
              {showWelcomeMenu && (
                <div
                  className="absolute top-full right-0 mt-2 min-w-[14rem] w-56 rounded-xl border border-white/10 bg-black/70 backdrop-blur-md p-3 shadow-[0_0_28px_rgba(56,189,248,0.15)] z-50 flex flex-col gap-2"
                  role="menu"
                >
                  <a
                    href="https://www.paypal.com/ncp/payment/F2TG6ELW8M2B4"
                    target="_blank"
                    rel="noreferrer"
                    className={`${LINK_PILL} w-full justify-center`}
                    onClick={() => {
                      trackLandingCta(
                        LANDING_HOME_SITE_EVENTS.WELCOME_JOIN_COMMUNITY_CLICK,
                        "welcome_menu",
                        "Join community",
                        "https://www.paypal.com/ncp/payment/F2TG6ELW8M2B4",
                      );
                      void trackSiteEvent({
                        path: "/",
                        eventType: "outbound_paypal",
                        metadata: {
                          ...landingCtaMetadata({
                            eventName: LANDING_HOME_SITE_EVENTS.WELCOME_PAYPAL_OUTBOUND,
                            source: "welcome_menu",
                            route: "/",
                            label: "Join community (PayPal)",
                            targetHref: "https://www.paypal.com/ncp/payment/F2TG6ELW8M2B4",
                          }),
                          destination: "paypal",
                          offerName: "community",
                          amountEstimate: "155",
                        },
                      });
                      setShowWelcomeMenu(false);
                      // Track that user clicked to join community
                      try {
                        localStorage.setItem("hasJoinedCommunity", "true");
                        localStorage.setItem(
                          "communityJoinedAt",
                          new Date().toISOString(),
                        );
                      } catch {}
                    }}
                    role="menuitem"
                  >
                    JOIN COMMUNITY
                  </a>
                  <a
                    href="https://opensea.io/item/polygon/0x7202cd71cb52ce0d71b9a13f2dacc4599b6cb13a/0"
                    target="_blank"
                    rel="noreferrer"
                    className={`${LINK_PILL} w-full justify-center`}
                    onClick={() => {
                      trackLandingCta(
                        LANDING_HOME_SITE_EVENTS.WELCOME_MENU_CTA,
                        "welcome_menu",
                        "Faster access (OpenSea)",
                        "https://opensea.io/item/polygon/0x7202cd71cb52ce0d71b9a13f2dacc4599b6cb13a/0",
                      );
                      setShowWelcomeMenu(false);
                    }}
                    role="menuitem"
                  >
                    Faster Access
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      trackLandingCta(
                        LANDING_HOME_SITE_EVENTS.WELCOME_MENU_CTA,
                        "welcome_menu",
                        "Consultations",
                        "/consultations",
                      );
                      setShowWelcomeMenu(false);
                      router.push("/consultations");
                    }}
                    className={`${LINK_PILL} w-full justify-center`}
                    role="menuitem"
                  >
                    Consultations
                  </button>
                  <Link
                    href="/meet/troothhurts-meets"
                    className={`${LINK_PILL} w-full justify-center`}
                    onClick={() => {
                      trackLandingCta(
                        LANDING_HOME_SITE_EVENTS.WELCOME_MENU_CTA,
                        "welcome_menu",
                        "Broadcasting",
                        "/meet/troothhurts-meets",
                      );
                      setShowWelcomeMenu(false);
                    }}
                    role="menuitem"
                  >
                    Broadcasting
                  </Link>
                  <Link
                    href="/ai-agent-services"
                    className={`${LINK_PILL} w-full justify-center`}
                    onClick={() => {
                      trackLandingCta(
                        LANDING_HOME_SITE_EVENTS.WELCOME_MENU_CTA,
                        "welcome_menu",
                        "AI Agency",
                        "/ai-agent-services",
                      );
                      setShowWelcomeMenu(false);
                    }}
                    role="menuitem"
                  >
                    AI Agency
                  </Link>
                  <Link
                    href="/grant-writing"
                    className={`${LINK_PILL} w-full justify-center`}
                    onClick={() => {
                      trackLandingCta(
                        LANDING_HOME_SITE_EVENTS.WELCOME_MENU_CTA,
                        "welcome_menu",
                        "Grant writing",
                        "/grant-writing",
                      );
                      setShowWelcomeMenu(false);
                    }}
                    role="menuitem"
                  >
                    Grant Writing
                  </Link>
                  <Link
                    href="/smart-trust"
                    className={`${LINK_PILL} w-full justify-center`}
                    onClick={() => {
                      trackLandingCta(
                        LANDING_HOME_SITE_EVENTS.WELCOME_MENU_CTA,
                        "welcome_menu",
                        "SMART TRUST™",
                        "/smart-trust",
                      );
                      setShowWelcomeMenu(false);
                    }}
                    role="menuitem"
                  >
                    SMART TRUST™
                  </Link>
                  <Link
                    href="/revenue-os"
                    className={`${LINK_PILL} w-full justify-center`}
                    data-track="welcome_menu_revenue_os"
                    onClick={() => {
                      trackLandingCta(
                        LANDING_HOME_SITE_EVENTS.WELCOME_MENU_CTA,
                        "welcome_menu",
                        "Revenue OS",
                        "/revenue-os",
                      );
                      setShowWelcomeMenu(false);
                      if (typeof window !== "undefined") {
                        try {
                          window.dispatchEvent(
                            new CustomEvent("heroMarket.analytics", {
                              detail: {
                                event: "welcome_menu_revenue_os_click",
                                path: "/revenue-os",
                              },
                            }),
                          );
                        } catch {
                          /* ignore */
                        }
                      }
                    }}
                    role="menuitem"
                  >
                    <span className="flex w-full items-center justify-center gap-2">
                      <span>Revenue OS</span>
                      <span className="rounded bg-cyan-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-cyan-300">
                        New
                      </span>
                    </span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      trackLandingCta(
                        LANDING_HOME_SITE_EVENTS.WELCOME_MENU_CTA,
                        "welcome_menu",
                        "Admin login",
                        "/admin",
                      );
                      setShowWelcomeMenu(false);
                      router.push("/admin");
                    }}
                    className={`${LINK_PILL} w-full justify-center`}
                    role="menuitem"
                  >
                    🔒 Admin Login
                  </button>
                  <div className="my-3 border-t border-white/10" />
                  <button
                    type="button"
                    onClick={async () => {
                      setShowWelcomeMenu(false);
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
              )}
            </div>
          </div>
        </nav>

        <LandingRevenueMarketingSection />

        <main className="flex items-center justify-center px-4 py-12 pb-14 sm:pb-20 relative min-h-[min(560px,92vh)] max-w-6xl mx-auto">
          <LandingAmbientChips />
          <div
            className="absolute right-0 top-1/2 -translate-y-1/2 w-[180px] h-[180px] sm:w-[220px] sm:h-[220px] md:w-[280px] md:h-[280px] lg:w-[320px] lg:h-[320px] pointer-events-none z-10 rounded-full overflow-hidden"
            style={{
              background:
                "radial-gradient(ellipse 80% 80% at 50% 50%, rgba(15,23,42,0.95) 0%, rgba(2,6,23,0.98) 100%)",
              boxShadow: "0 0 60px rgba(0,209,255,0.15)",
            }}
          >
            <LandingParticleCloud />
          </div>
          <div
            id="hero-auth"
            className="relative z-20 flex w-full max-w-md scroll-mt-24 flex-col items-center gap-1 shrink-0 md:scroll-mt-28"
          >
            <LandingRotatingTagline />
            <LandingHeroEnhancements
              authMode={isRegistering ? "register" : "login"}
            >
              <div
                className="w-full max-w-md bg-black/60 backdrop-blur-md rounded-xl p-8 relative z-10 shrink-0"
                style={{
                  border: "2px solid #00D4FF",
                  boxShadow:
                    "0 0 20px rgba(0, 212, 255, 0.3), 0 0 40px rgba(0, 212, 255, 0.15), inset 0 0 30px rgba(0, 212, 255, 0.05)",
                }}
              >
                <h1 className="text-3xl font-bold text-white text-center mb-2">
                  Welcome to Hero Market
                </h1>
                <p className="text-slate-400 text-center text-sm leading-relaxed mb-6">
                  AI marketing, business infrastructure, and token-gated digital access—in one execution
                  layer.
                </p>

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
                    <div>
                      <label className="block text-sm text-slate-400 mb-1">
                        Phone Number
                      </label>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full px-4 py-3 rounded-lg bg-slate-800 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        placeholder="(555) 123-4567"
                      />
                      <label className="flex items-start gap-2 mt-2 cursor-pointer">
                        <input
                          type="radio"
                          name="smsConsent"
                          checked={smsConsent}
                          onChange={() => setSmsConsent(true)}
                          className="mt-1 accent-cyan-500"
                        />
                        <span className="text-xs text-slate-400">
                          I confirm this number can receive messages from the
                          platform.
                        </span>
                      </label>
                    </div>
                    {!message ? (
                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 bg-cyan-500 hover:bg-cyan-400 text-black font-semibold rounded-lg transition-colors disabled:opacity-50"
                      >
                        {loading ? "Creating..." : "Create Account"}
                      </button>
                    ) : (
                      <a
                        href="https://forms.gle/s2pkDvUJ3XhFq5jd8"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex w-full justify-center py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded-lg transition-colors"
                        onClick={() =>
                          trackLandingCta(
                            LANDING_HOME_SITE_EVENTS.REGISTER_CONTINUE_INTENT,
                            "hero_auth_card",
                            "Continue (registration follow-up)",
                            "https://forms.gle/s2pkDvUJ3XhFq5jd8",
                            "conversion_intent",
                          )
                        }
                      >
                        Continue
                      </a>
                    )}
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
                          aria-label={
                            showPassword ? "Hide password" : "Show password"
                          }
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                        >
                          {showPassword ? (
                            <EyeOff className="h-5 w-5" />
                          ) : (
                            <Eye className="h-5 w-5" />
                          )}
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
            </LandingHeroEnhancements>
          </div>
        </main>

        <LandingCommunityVideo />

        <LandingHomeScrollSections />

        {/* REALITY Chatbot */}
        <RealityChatBot />

        <footer className="py-4 text-center text-slate-400 text-sm border-t border-white/10">
          <div className="flex items-center justify-center gap-3 pb-3 flex-wrap">
            <Link
              href="/consultations"
              className={LINK_PILL}
              onClick={() =>
                trackLandingCta(
                  LANDING_HOME_SITE_EVENTS.FOOTER_CTA,
                  "footer",
                  "Consultations",
                  "/consultations",
                )
              }
            >
              Consultations
            </Link>
            <a
              href="https://www.youtube.com/@officialtroothhurtz"
              target="_blank"
              rel="noreferrer"
              className={LINK_PILL}
              aria-label="YouTube"
              onClick={() =>
                trackLandingCta(
                  LANDING_HOME_SITE_EVENTS.FOOTER_CTA,
                  "footer",
                  "YouTube",
                  "https://www.youtube.com/@officialtroothhurtz",
                )
              }
            >
              YouTube
            </a>
            <Link
              href="/mission-statement"
              className={LINK_PILL}
              onClick={() =>
                trackLandingCta(
                  LANDING_HOME_SITE_EVENTS.FOOTER_CTA,
                  "footer",
                  "Mission statement",
                  "/mission-statement",
                )
              }
            >
              Mission Statement
            </Link>
          </div>
          <p>© 2026 Hero Market. All rights reserved.</p>
        </footer>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-400 text-sm">
          Loading…
        </div>
      }
    >
      <HomePageContent />
    </Suspense>
  );
}
