"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    const hasAccess =
      localStorage.getItem("user") ||
      localStorage.getItem("adminLoggedIn") === "true" ||
      document.cookie.includes("admin-token");
    if (!hasAccess) {
      router.push("/");
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-black text-white">
      <nav className="border-b border-white/10 bg-black/80 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4">
          <div className="flex h-14 items-center justify-between gap-4">
            <div className="flex items-center gap-6">
              <Link href="/app/dashboard" className="text-lg font-semibold tracking-tight">
                CRM
              </Link>
              <div className="hidden md:flex items-center gap-1">
                <Link
                  href="/app/contacts"
                  className="rounded-lg px-3 py-2 text-sm text-white/70 hover:bg-white/10 hover:text-white"
                >
                  Contacts
                </Link>
                <Link
                  href="/app/pipelines"
                  className="rounded-lg px-3 py-2 text-sm text-white/70 hover:bg-white/10 hover:text-white"
                >
                  Pipelines
                </Link>
                <Link
                  href="/app/conversations"
                  className="rounded-lg px-3 py-2 text-sm text-white/70 hover:bg-white/10 hover:text-white"
                >
                  Conversations
                </Link>
                <Link
                  href="/app/automations"
                  className="rounded-lg px-3 py-2 text-sm text-white/70 hover:bg-white/10 hover:text-white"
                >
                  Automations
                </Link>
                <Link
                  href="/app/calendar"
                  className="rounded-lg px-3 py-2 text-sm text-white/70 hover:bg-white/10 hover:text-white"
                >
                  Calendar
                </Link>
                <Link
                  href="/app/agents/overview"
                  className="rounded-lg px-3 py-2 text-sm text-white/70 hover:bg-white/10 hover:text-white"
                >
                  AI Agents
                </Link>
                <Link
                  href="/app/npcs"
                  className="rounded-lg px-3 py-2 text-sm text-white/70 hover:bg-white/10 hover:text-white"
                >
                  My NPCs
                </Link>
                <Link
                  href="/app/voice-agents"
                  className="rounded-lg px-3 py-2 text-sm text-cyan-400 hover:bg-cyan-500/10 hover:text-cyan-300"
                >
                  AI / Voice Agents
                </Link>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/dashboard"
                className="rounded-lg px-3 py-2 text-sm text-white/60 hover:text-white"
              >
                Main Dashboard
              </Link>
            </div>
          </div>
        </div>
      </nav>
      {children}
    </div>
  );
}
