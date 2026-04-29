import type { Metadata } from "next";
import type { ReactNode } from "react";

export default function BroadcastTemplateLayout({ children }: { children: ReactNode }) {
  return children;
}

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};
