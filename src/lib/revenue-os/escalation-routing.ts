/**
 * Maps notification drafts to delivery intents using enabled channels (read-only routing).
 */

import type { BentleyNotificationEventDraft } from "@/lib/revenue-os/notification-events";
import type { NotificationChannelRow, NotificationPolicyRow } from "@/lib/revenue-os/notification-db";

export type RoutedBentleyDelivery = {
  eventDraft: BentleyNotificationEventDraft;
  channel: NotificationChannelRow;
};

export function routeBentleyEscalations(input: {
  events: BentleyNotificationEventDraft[];
  policies: NotificationPolicyRow[];
  channels: NotificationChannelRow[];
}): { routedDeliveries: RoutedBentleyDelivery[] } {
  void input.policies;
  const enabled = input.channels.filter((c) => c.isEnabled);
  const channel =
    enabled.find((c) => String(c.channelType).toLowerCase() === "in_app") ?? enabled[0] ?? null;
  if (!channel) return { routedDeliveries: [] };
  return {
    routedDeliveries: input.events.map((eventDraft) => ({ eventDraft, channel })),
  };
}
