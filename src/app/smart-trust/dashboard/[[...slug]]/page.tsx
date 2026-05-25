"use client";

import dynamic from "next/dynamic";

const SmartTrustApp = dynamic(() => import("../../SmartTrustApp").then((m) => m.SmartTrustApp), {
  ssr: false,
});

/** Smart Trust workspace (React Router). Marketing lives at `/smart-trust`. */
export default function SmartTrustDashboardPage() {
  return <SmartTrustApp basename="/smart-trust/dashboard" />;
}
