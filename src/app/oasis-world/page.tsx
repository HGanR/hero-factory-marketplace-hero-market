"use client";

import dynamic from "next/dynamic";
import { TokenGateWrapper } from "../components/TokenGateWrapper";

const OasisWorldPage = dynamic(() => import("@/components/oasis/OasisWorldPage"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mx-auto mb-4"></div>
        <p className="text-slate-300">Loading OASIS World...</p>
        <p className="text-slate-500 text-sm mt-2">Initializing 3D environment</p>
      </div>
    </div>
  ),
});

export default function OasisWorldWrapper() {
  return (
    <TokenGateWrapper>
      <OasisWorldPage />
    </TokenGateWrapper>
  );
}


