"use client";

/**
 * Home.tsx — The 3D world is the landing page for the modeling section.
 * Mirrors office-building-3d src/pages/Home.tsx: campus world view loads immediately at the route.
 * A small "Enter Building" button in the HUD lets users jump to tower interiors.
 */
import dynamic from "next/dynamic";

const TrooWorldEditor = dynamic(
  () => import("@/components/troo-world/TrooWorldEditor"),
  { ssr: false }
);

export default function Home() {
  return <TrooWorldEditor />;
}
