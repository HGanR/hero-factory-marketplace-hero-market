"use client";

import dynamic from "next/dynamic";

const SmartTrustApp = dynamic(() => import("../SmartTrustApp").then((m) => m.SmartTrustApp), {
  ssr: false,
});

/** React Router shell for `/smart-trust/*` paths (e.g. `/wizard`). Marketing stays at `/smart-trust` via `page.tsx`. */
export default function SmartTrustSlugPage() {
  return <SmartTrustApp />;
}


