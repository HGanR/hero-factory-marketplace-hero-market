"use client";

import Link from "next/link";

export default function CalendarPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <h1 className="text-2xl font-semibold">Calendar</h1>
      <p className="text-sm text-white/60">Appointments linked to contact/opportunity • Booking page later</p>
      <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-12 text-center">
        <p className="text-white/60">Calendar & appointments coming soon.</p>
        <Link href="/app/dashboard" className="mt-4 inline-block text-cyan-400 hover:text-cyan-300">
          ← Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
