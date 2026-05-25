"use client";

import React from "react";

export type BroadcastAnalyticsFiltersBarValue = {
  range: "last_7_days" | "last_30_days" | "last_90_days" | "custom";
  fromIso: string;
  toIso: string;
  compositorMode: string;
  roomId: string;
  broadcastEventLinked: "" | "1" | "0";
  calendarLinked: "" | "1" | "0";
};

export function BroadcastAnalyticsFiltersBar(props: {
  value: BroadcastAnalyticsFiltersBarValue;
  onChange: (v: BroadcastAnalyticsFiltersBarValue) => void;
  onApply: () => void;
  loading?: boolean;
}) {
  void props;
  return <div className="text-[10px] text-slate-500">Filters unavailable.</div>;
}
