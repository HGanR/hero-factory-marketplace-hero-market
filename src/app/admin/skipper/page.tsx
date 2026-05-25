"use client";

import nextDynamic from "next/dynamic";

const SkipperCommandCenter = nextDynamic(
  () => import("@/components/skipper/SkipperCommandCenter").then((m) => m.SkipperCommandCenter),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-screen items-center justify-center bg-[#00050A] text-sm uppercase tracking-[0.3em] text-[#00A3FF]">
        Loading Skipper…
      </div>
    ),
  },
);

export default function SkipperAdminPage() {
  return <SkipperCommandCenter />;
}
