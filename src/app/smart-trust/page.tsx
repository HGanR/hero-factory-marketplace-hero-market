"use client";

import dynamic from "next/dynamic";

const SmartTrustApp = dynamic(() => import("./SmartTrustApp").then((m) => m.SmartTrustApp), {
  ssr: false,
});

export default function SmartTrustPage() {
  return <SmartTrustApp />;
}


