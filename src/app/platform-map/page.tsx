"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Map, ChevronRight, Layers, Box, Sparkles, Store, Globe } from "lucide-react";

const NODES = [
  {
    id: "identity",
    label: "Identity Layer",
    icon: Layers,
    color: "from-violet-500 to-purple-600",
    children: [
      { label: "Wallet + Token Gate", href: "/dashboard" },
    ],
  },
  {
    id: "workspace",
    label: "Workspace",
    icon: Box,
    color: "from-blue-500 to-cyan-600",
    children: [
      { label: "Client Records", href: "/clients/new" },
      { label: "Workspace", href: "/trust-records" },
    ],
  },
  {
    id: "business",
    label: "Business Infrastructure",
    icon: Layers,
    color: "from-emerald-500 to-teal-600",
    children: [
      { label: "Trust Records", href: "/trust-records" },
      { label: "Accounting", href: "/accounting" },
      { label: "Compliance", href: "/compliance" },
    ],
  },
  {
    id: "creation",
    label: "Creation Tools",
    icon: Sparkles,
    color: "from-amber-500 to-orange-600",
    children: [
      { label: "Site Builder", href: "/site-builder" },
      { label: "QR Maker", href: "/qr-maker" },
      { label: "Seal Maker", href: "/seal-maker" },
      { label: "Merch Creation", href: "/merch-creation" },
    ],
  },
  {
    id: "ai",
    label: "AI Layer",
    icon: Sparkles,
    color: "from-pink-500 to-rose-600",
    children: [
      { label: "AI Agency", href: "/app/agents" },
      { label: "Revenue OS", href: "/ai-revenue-os" },
    ],
  },
  {
    id: "marketplace",
    label: "Marketplace",
    icon: Store,
    color: "from-cyan-500 to-blue-600",
    children: [
      { label: "NFT Marketplace", href: "/nft-marketplace" },
      { label: "Certificated Securities", href: "/securities" },
    ],
  },
  {
    id: "oasis",
    label: "3D Ecosystem",
    icon: Globe,
    color: "from-green-500 to-emerald-600",
    children: [
      { label: "Oasis World", href: "/oasis" },
      { label: "Troo World", href: "/troo-world" },
      { label: "NPC Agents", href: "/oasis-npc" },
    ],
  },
  {
    id: "developer",
    label: "Developer Platform",
    icon: Sparkles,
    color: "from-indigo-500 to-violet-600",
    children: [
      { label: "Developer Portal", href: "/developers" },
    ],
  },
];

export default function PlatformMapPage() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    try {
      const hasUser = !!localStorage.getItem("user");
      const hasAdmin = localStorage.getItem("adminLoggedIn") === "true";
      if (!hasUser && !hasAdmin) {
        router.push("/");
        return;
      }
      setIsLoggedIn(true);
    } catch {
      router.push("/");
    } finally {
      setIsChecking(false);
    }
  }, [router]);

  if (isChecking) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-slate-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
              <Map className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Platform Map</h1>
              <p className="text-slate-400">Visual architecture of the Web3 Business Infrastructure OS</p>
            </div>
          </div>
        </div>

        {/* Map */}
        <div className="space-y-6">
          {NODES.map((node, idx) => {
            const Icon = node.icon;
            return (
              <div
                key={node.id}
                className="rounded-2xl border border-slate-800 bg-slate-950/50 overflow-hidden"
              >
                <div
                  className={`p-4 bg-gradient-to-r ${node.color} flex items-center gap-3`}
                >
                  <Icon className="w-6 h-6 text-white/90" />
                  <h2 className="text-lg font-semibold text-white">{node.label}</h2>
                </div>
                <div className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {node.children.map((child) => (
                    <Link
                      key={child.href}
                      href={child.href}
                      className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 hover:border-cyan-500/30 transition-colors group"
                    >
                      <span className="text-slate-200 group-hover:text-white">{child.label}</span>
                      <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-400" />
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Flow diagram */}
        <div className="mt-12 p-6 rounded-2xl border border-slate-800 bg-slate-950/50">
          <h2 className="text-lg font-semibold mb-4">Platform Flow</h2>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="px-3 py-1.5 rounded-lg bg-violet-500/20 text-violet-300">Identity</span>
            <span className="text-slate-500">→</span>
            <span className="px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-300">Workspace</span>
            <span className="text-slate-500">→</span>
            <span className="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300">Business</span>
            <span className="text-slate-500">→</span>
            <span className="px-3 py-1.5 rounded-lg bg-pink-500/20 text-pink-300">AI</span>
            <span className="text-slate-500">→</span>
            <span className="px-3 py-1.5 rounded-lg bg-cyan-500/20 text-cyan-300">Marketplace</span>
          </div>
        </div>

        <div className="mt-8 flex justify-between items-center">
          <Link href="/dashboard" className="text-cyan-400 hover:text-cyan-300 text-sm">
            ← Back to Dashboard
          </Link>
          <Link href="/developers" className="text-cyan-400 hover:text-cyan-300 text-sm">
            Developer Portal →
          </Link>
        </div>
      </div>
    </div>
  );
}
