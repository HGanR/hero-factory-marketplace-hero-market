"use client";

import React from "react";

export function MeetBroadcastEventsPanel(_props: {
  roomId: string;
  hostWalletAddress: string;
  launchDisabled: boolean;
  onLaunchFromEvent: (id: number) => void;
  onPrepareResult: (msg: string) => void;
}) {
  return <div className="text-[10px] text-slate-500">Events panel unavailable.</div>;
}
