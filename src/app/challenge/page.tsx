"use client";

import Link from "next/link";

export default function ChallengeHubPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white">
      <header className="border-b border-white/10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold">Troo Challenges</h1>
          <Link
            href="/worlds"
            className="text-sm text-cyan-400 hover:text-cyan-300"
          >
            Explore Worlds
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Build a Real Business in 30 Days
          </h2>
          <p className="text-slate-300 text-lg max-w-2xl mx-auto mb-6">
            Join entrepreneurs building real businesses with AI agents, world offices, and platform tools. Compete, learn, and grow.
          </p>
          <div className="flex flex-wrap justify-center gap-2 text-sm text-slate-400">
            <span>#30DayChallenge</span>
            <span>#BusinessChallenge</span>
            <span>#EntrepreneurChallenge</span>
            <span>#BuildABusiness</span>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Link
            href="/challenge/spring-entity-build"
            className="block p-6 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:border-cyan-500/50 hover:bg-slate-800/80 transition-all"
          >
            <h3 className="text-lg font-semibold mb-2">Spring 2026 Entity Build</h3>
            <p className="text-slate-400 text-sm mb-4">
              Skill-based challenge covering entity formation, ownership, documents, compliance, and governance.
            </p>
            <span className="text-cyan-400 text-sm font-medium">Start challenge →</span>
          </Link>

          <div className="p-6 rounded-xl bg-slate-800/30 border border-slate-700/30 border-dashed">
            <h3 className="text-lg font-semibold mb-2 text-slate-500">30-Day AI Business Launch</h3>
            <p className="text-slate-500 text-sm mb-4">
              Coming soon. Create entity, build world office, deploy AI agent, launch campaign, acquire first client.
            </p>
            <span className="text-slate-600 text-sm">Coming soon</span>
          </div>
        </div>

        <div className="mt-12 p-6 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
          <h3 className="font-semibold mb-2">Why build on Troo?</h3>
          <ul className="text-slate-300 text-sm space-y-2">
            <li>• Create business entities and world offices</li>
            <li>• Deploy AI agents for automation</li>
            <li>• Launch campaigns and sell services</li>
            <li>• Compete on the leaderboard</li>
          </ul>
        </div>
      </main>
    </div>
  );
}
