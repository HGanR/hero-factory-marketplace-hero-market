"use client";

import type { ReactNode } from "react";

export type LandingHeroEnhancementsProps = {
  /** Used for layout / analytics hooks; auth UI lives in children. */
  authMode?: "register" | "login";
  children: ReactNode;
};

/**
 * Wrapper around the landing hero auth card. Restores a valid React tree when this file was emptied.
 */
export function LandingHeroEnhancements({ authMode, children }: LandingHeroEnhancementsProps) {
  return (
    <div className="relative w-full" data-landing-hero-auth={authMode ?? "login"}>
      {children}
    </div>
  );
}
