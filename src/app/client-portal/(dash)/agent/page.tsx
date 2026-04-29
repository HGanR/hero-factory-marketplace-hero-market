import { getClientPortalSession } from "@/lib/client-portal/portal-session";
import { getClientPortalAgentSummary } from "@/lib/client-portal/portal-data";
import Link from "next/link";

export default async function ClientPortalAgentPage() {
  const s = await getClientPortalSession();
  if (!s) return null;
  const a = await getClientPortalAgentSummary(s);
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-900">AI Agent</h1>
      <p className="text-sm text-slate-600">Read-only summary of your embedded assistant.</p>
      <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-4 text-sm">
        <p>
          <span className="text-slate-500">Binding:</span>{" "}
          <span className="font-medium text-slate-800">{a.hasBinding ? "Connected" : "Not connected"}</span>
        </p>
        <p>
          <span className="text-slate-500">Agent name:</span> {a.agentName}
        </p>
        <p>
          <span className="text-slate-500">Status:</span> {a.status ?? "—"}
        </p>
        <p>
          <span className="text-slate-500">Widget:</span> {a.widgetEnabled ? "On" : "Off"}
        </p>
        <p>
          <span className="text-slate-500">Site:</span> {a.siteName}
        </p>
      </div>
      {a.hasBinding ? (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-800">Assistant avatar & widget preview</h2>
          <div className="mt-3 flex items-start gap-4">
            <div
              className="h-14 w-14 rounded-full"
              style={{
                backgroundImage: a.avatarImageUrl ? `url(${a.avatarImageUrl})` : undefined,
                backgroundSize: "cover",
                backgroundPosition: "center",
                backgroundColor: a.widgetAppearance.widgetBubbleColor ?? "#ffffff",
                borderColor: a.widgetAppearance.avatarBorderColor ?? "#2563eb",
                borderWidth: `${a.widgetAppearance.avatarBorderWidth ?? 2}px`,
                borderStyle: "solid",
              }}
              aria-label={a.avatarAltText ?? "assistant avatar"}
            />
            <div
              className="min-w-[220px] rounded-lg p-3"
              style={{
                backgroundColor: a.widgetAppearance.widgetWindowBackgroundColor ?? "#0f172a",
                color: a.widgetAppearance.widgetTextColor ?? "#e2e8f0",
              }}
            >
              <div
                className="rounded px-2 py-1 text-xs font-medium"
                style={{ backgroundColor: a.widgetAppearance.widgetHeaderColor ?? "#1e293b" }}
              >
                Assistant
              </div>
              <p className="mt-2 text-xs">Preview only</p>
            </div>
          </div>
          <Link
            href="/client-portal/requests?prefill=avatar"
            className="mt-3 inline-block text-xs text-cyan-700 hover:underline"
          >
            Request avatar/color change
          </Link>
        </div>
      ) : null}
    </div>
  );
}
