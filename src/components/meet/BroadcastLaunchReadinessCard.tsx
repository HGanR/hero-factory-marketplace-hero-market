"use client";

import React from "react";
import type { BroadcastLaunchReadinessReport } from "@/lib/meet/broadcast-launch-readiness";

export function BroadcastLaunchReadinessCard(_props: {
  report: BroadcastLaunchReadinessReport;
  onPrepareLaunch: (eventId: number) => void | Promise<void>;
  compact?: boolean;
}) {
  return null;
}
