"use client";

import Link from "next/link";
import USPSInstrumentDepositManager from "@/components/USPSInstrumentDepositManager";

export default function InstrumentDepositsPage() {
  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Instrument Deposits</h1>
          <p className="text-sm text-slate-400 mt-1">USPS instrument deposit workflows</p>
        </div>
        <div className="flex gap-3">
          <Link href="/accounting" className="text-slate-300 hover:text-white underline">
            Back to Accounting
          </Link>
          <Link href="/dashboard" className="text-slate-300 hover:text-white underline">
            Dashboard
          </Link>
        </div>
      </div>
      <div className="px-4 pb-10">
        <USPSInstrumentDepositManager />
      </div>
    </div>
  );
}


