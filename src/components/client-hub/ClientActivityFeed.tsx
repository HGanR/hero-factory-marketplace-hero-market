import type { ClientActivityItem } from "@/lib/revenue-os/client-hub-types";

type Props = { items: ClientActivityItem[]; emptyText?: string };

const kindLabel: Record<ClientActivityItem["kind"], string> = {
  client: "Profile",
  site: "Site",
  site_version: "Build",
  binding: "Agent",
  contact: "Lead",
  conversation: "Inbox",
  message: "Message",
  widget: "Widget",
  campaign: "Campaign",
  post: "Post",
  platform_event: "Platform",
  automation: "Automation",
};

export function ClientActivityFeed({ items, emptyText = "No recent activity for this client yet." }: Props) {
  if (items.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-slate-600/50 bg-slate-900/30 p-4 text-sm text-slate-500">
        {emptyText} Link a site to this client, add an agent + widget, capture CRM leads, and publish
        campaigns—events flow here from those systems (not from local storage).
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {items.map((a) => (
        <li
          key={a.id}
          className="flex items-start justify-between gap-3 rounded-lg border border-white/5 bg-slate-900/40 px-3 py-2 text-sm"
        >
          <div>
            <p className="text-xs text-cyan-500/80">{kindLabel[a.kind]}</p>
            <p className="text-slate-200">{a.title}</p>
            {a.detail ? <p className="mt-0.5 line-clamp-2 text-slate-500">{a.detail}</p> : null}
          </div>
          <time className="shrink-0 text-xs text-slate-500" dateTime={a.occurredAt}>
            {new Date(a.occurredAt).toLocaleString()}
          </time>
        </li>
      ))}
    </ul>
  );
}
