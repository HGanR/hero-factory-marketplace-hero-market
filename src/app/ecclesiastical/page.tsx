"use client";

import dynamic from "next/dynamic";

const EcclesiasticalTrustApp = dynamic(
  () => import("./EcclesiasticalTrustApp").then((m) => m.EcclesiasticalTrustApp),
  { ssr: false }
);

export default function EcclesiasticalTrustPage() {
  return <EcclesiasticalTrustApp />;
}





