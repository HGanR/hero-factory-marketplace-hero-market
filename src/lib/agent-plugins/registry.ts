/**
 * Code-first registry: each action maps to a real executor (Google Workspace only for now).
 */
import type { AgentPluginDefinition, AgentPluginActionDefinition } from "@/lib/agent-plugins/types";
import { executeCalendarFreeBusy } from "@/lib/agent-plugins/executors/google/calendar-freebusy";
import { executeCalendarListEvents } from "@/lib/agent-plugins/executors/google/calendar-list-events";
import { executeGmailListMessages } from "@/lib/agent-plugins/executors/google/gmail-list-messages";
import { executeGmailCreateDraft } from "@/lib/agent-plugins/executors/google/gmail-create-draft";
import { executeGmailSendDraft } from "@/lib/agent-plugins/executors/google/gmail-send-draft";
import { executeDriveListFiles } from "@/lib/agent-plugins/executors/google/drive-list-files";
import { executeCalendarCreateEvent } from "@/lib/agent-plugins/executors/google/calendar-create-event";
import type { AgentExecutionContext } from "@/lib/agent-plugins/types";
import type { AgentActionSuccess } from "@/lib/agent-plugins/action-result";

/** Requested on Google OAuth authorize (combined consent). Re-consent after scope changes. */
export const GOOGLE_AGENT_SCOPES: string[] = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.compose",
  "https://www.googleapis.com/auth/drive.readonly",
];

export type ActionHandler = (
  ctx: AgentExecutionContext,
  input: unknown
) => Promise<AgentActionSuccess>;

/**
 * Single source of truth for runtime action keys (Google tools). Registry metadata + handlers + input schemas must match.
 */
export const AGENT_RUNTIME_ACTION_KEYS = [
  "calendar.freeBusy",
  "calendar.listEvents",
  "calendar.createEvent",
  "gmail.listMessages",
  "gmail.createDraft",
  "gmail.sendDraft",
  "drive.listFiles",
] as const;

export type AgentRuntimeActionKey = (typeof AGENT_RUNTIME_ACTION_KEYS)[number];

export const ACTION_HANDLERS: Record<AgentRuntimeActionKey, ActionHandler> = {
  "calendar.freeBusy": executeCalendarFreeBusy,
  "calendar.listEvents": executeCalendarListEvents,
  "calendar.createEvent": executeCalendarCreateEvent,
  "gmail.listMessages": executeGmailListMessages,
  "gmail.createDraft": executeGmailCreateDraft,
  "gmail.sendDraft": executeGmailSendDraft,
  "drive.listFiles": executeDriveListFiles,
};

/** Declared in AGENT_PLUGIN_REGISTRY with runtimeImplemented (must align with ACTION_HANDLERS). */
export function collectDeclaredRuntimeActionKeysFromRegistry(): string[] {
  const keys: string[] = [];
  for (const plugin of AGENT_PLUGIN_REGISTRY) {
    if (!plugin.runtimeImplemented) continue;
    for (const action of plugin.actions) {
      if (action.runtimeImplemented) keys.push(action.actionKey);
    }
  }
  return [...new Set(keys)].sort();
}

export const AGENT_PLUGIN_REGISTRY: AgentPluginDefinition[] = [
  {
    pluginKey: "google_calendar",
    displayName: "Google Calendar",
    purpose:
      "Read availability and busy times so the agent can suggest meeting times or detect conflicts (uses Calendar API free/busy).",
    authType: "oauth2",
    provider: "google",
    oauthProviderKey: "google",
    scopes: [...GOOGLE_AGENT_SCOPES],
    runtimeImplemented: true,
    actions: [
      {
        actionKey: "calendar.freeBusy",
        displayName: "Check calendar availability",
        description:
          "Returns busy intervals on the user’s primary calendar for a time window (optional timeMin/timeMax ISO 8601).",
        requiredScopes: ["https://www.googleapis.com/auth/calendar.readonly"],
        runtimeImplemented: true,
        kind: "read",
        invocationHint:
          "Use when the user asks if they are free, what conflicts exist, or to pick a meeting time within a date range.",
      },
      {
        actionKey: "calendar.listEvents",
        displayName: "List calendar events",
        description:
          "Lists upcoming events on the primary calendar between timeMin and timeMax (ISO 8601), with titles and times.",
        requiredScopes: ["https://www.googleapis.com/auth/calendar.readonly"],
        runtimeImplemented: true,
        kind: "read",
        invocationHint:
          "Use when the user asks what is on their calendar, what meetings exist, or to summarize scheduled events in a range.",
      },
      {
        actionKey: "calendar.createEvent",
        displayName: "Create calendar event",
        description:
          "Creates an event on the user’s primary calendar (summary, startDateTime, endDateTime ISO 8601, optional timeZone). Does not email guests unless the user adds attendees in Google Calendar afterward.",
        requiredScopes: ["https://www.googleapis.com/auth/calendar.events"],
        runtimeImplemented: true,
        kind: "write",
        invocationHint:
          "Use only after the user confirmed they want a meeting or block created. Requires confirmed:true in the tool call.",
      },
    ],
  },
  {
    pluginKey: "google_gmail",
    displayName: "Gmail",
    purpose: "Read recent messages and create drafts — never sends mail without a separate send flow.",
    authType: "oauth2",
    provider: "google",
    oauthProviderKey: "google",
    scopes: [...GOOGLE_AGENT_SCOPES],
    runtimeImplemented: true,
    actions: [
      {
        actionKey: "gmail.listMessages",
        displayName: "List recent messages",
        description: "Lists recent inbox message IDs (optional maxResults 1–50).",
        requiredScopes: ["https://www.googleapis.com/auth/gmail.readonly"],
        runtimeImplemented: true,
        kind: "read",
        invocationHint: "Use to see what recent email exists (IDs only from listing) before summarizing or replying.",
      },
      {
        actionKey: "gmail.createDraft",
        displayName: "Create email draft",
        description:
          "Creates a Gmail draft with plain text body (optional to, subject, bodyText). Does not send email.",
        requiredScopes: ["https://www.googleapis.com/auth/gmail.compose"],
        runtimeImplemented: true,
        kind: "write",
        invocationHint:
          "Use when the user wants a draft email prepared to edit or send later — not for immediate sending.",
      },
      {
        actionKey: "gmail.sendDraft",
        displayName: "Send a Gmail draft",
        description:
          "Sends an existing draft by draftId. This delivers email — use only after explicit user confirmation.",
        requiredScopes: ["https://www.googleapis.com/auth/gmail.compose"],
        runtimeImplemented: true,
        kind: "write",
        invocationHint:
          "Use only when the user confirmed they want this draft sent. Requires confirmed:true after they agree.",
      },
    ],
  },
  {
    pluginKey: "google_drive",
    displayName: "Google Drive",
    purpose: "List files so the agent can reference documents the user can open or share.",
    authType: "oauth2",
    provider: "google",
    oauthProviderKey: "google",
    scopes: [...GOOGLE_AGENT_SCOPES],
    runtimeImplemented: true,
    actions: [
      {
        actionKey: "drive.listFiles",
        displayName: "List Drive files",
        description: "Lists recent files (id, name, mime type).",
        requiredScopes: ["https://www.googleapis.com/auth/drive.readonly"],
        runtimeImplemented: true,
        kind: "read",
        invocationHint: "Use when the user asks what files exist in Drive or to reference a document by name.",
      },
    ],
  },
];

export function getPluginByKey(key: string): AgentPluginDefinition | undefined {
  return AGENT_PLUGIN_REGISTRY.find((p) => p.pluginKey === key);
}

export function getActionDefinition(actionKey: string):
  | { plugin: AgentPluginDefinition; action: AgentPluginActionDefinition }
  | undefined {
  for (const plugin of AGENT_PLUGIN_REGISTRY) {
    const action = plugin.actions.find((a) => a.actionKey === actionKey);
    if (action) return { plugin, action };
  }
  return undefined;
}
