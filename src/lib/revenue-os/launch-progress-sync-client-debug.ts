"use client";

export type LaunchSyncClientDebugSnapshot = {
  localVsRemote: string;
  syncDirection: string;
  lastSyncAt: string;
  conflict: string;
  analyticsLine?: string;
};

let last: LaunchSyncClientDebugSnapshot | null = null;

export function recordLaunchSyncClientDebug(snapshot: LaunchSyncClientDebugSnapshot): void {
  last = snapshot;
}

export function peekLaunchSyncClientDebug(): LaunchSyncClientDebugSnapshot | null {
  return last;
}
