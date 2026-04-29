"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function SecuritiesCompliancePage() {
  const router = useRouter();

  useEffect(() => {
    try {
      const hasUser = !!localStorage.getItem("user");
      const hasAdmin = localStorage.getItem("adminLoggedIn") === "true";
      if (!hasUser && !hasAdmin) router.push("/");
    } catch {
      router.push("/");
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="w-full px-6 py-6 border-b border-white/10 bg-slate-900/60 backdrop-blur">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold">AML/BSA Compliance</h1>
            <p className="text-sm text-slate-300 mt-1">
              Compliance dashboards & workflows for securities operations.
            </p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <Link href="/securities" className="text-slate-300 hover:text-white underline">
              Back to Securities
            </Link>
            <Link href="/compliance" className="text-slate-300 hover:text-white underline">
              Compliance Dashboard
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-10 space-y-6">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="text-slate-200 font-semibold">Go to the main compliance dashboard</div>
          <div className="text-slate-300 mt-2">
            The active compliance tooling for this repo is currently under{" "}
            <Link href="/compliance" className="underline text-cyan-300 hover:text-cyan-200">
              /compliance
            </Link>
            .
          </div>
        </div>
      </div>
    </div>
  );
}


