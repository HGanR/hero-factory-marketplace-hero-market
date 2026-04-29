"use client";

import Link from "next/link";
// Temporarily disabled due to build issues
// import ModelingCanvas from "@/components/modeling/ModelingCanvas";

export default function ModelingPage() {
  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="w-full px-6 py-6 border-b border-white/10 bg-slate-900/60 backdrop-blur">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">MODELING</h1>
            <p className="text-sm text-slate-300">Create parametric 3D objects and export GLB</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <Link href="/oasis-elements" className="text-slate-300 hover:text-white underline">
              Back to Oasis Elements
            </Link>
          </div>
        </div>
      </div>

      <div className="px-6 py-6">
        <div className="p-8 text-center bg-slate-800/50 rounded-lg border border-slate-700">
          <h2 className="text-xl font-semibold mb-4">Modeling Factory Temporarily Unavailable</h2>
          <p className="text-slate-300 mb-6">
            The 3D modeling factory is currently undergoing maintenance.
            We're working on fixing some technical issues with the parametric object system.
          </p>
          <p className="text-slate-400 text-sm">
            Expected to be back online soon with full enterable building capabilities!
          </p>
        </div>
        {/* <ModelingCanvas /> */}
      </div>
    </div>
  );
}













