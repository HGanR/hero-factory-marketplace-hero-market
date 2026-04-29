"use client";

import { Suspense } from "react";
import Home from "./Home";

export default function ModelingPage() {
  return (
    <Suspense
      fallback={
        <div className="fixed inset-0 bg-[#020408] flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500" />
        </div>
      }
    >
      <Home />
    </Suspense>
  );
}
