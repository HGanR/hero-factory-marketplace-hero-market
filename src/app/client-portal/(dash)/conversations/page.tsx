import { getClientPortalSession } from "@/lib/client-portal/portal-session";
import { listClientPortalConversations } from "@/lib/client-portal/portal-data";

export default async function ClientPortalConversationsPage() {
  const s = await getClientPortalSession();
  if (!s) return null;
  const rows = await listClientPortalConversations(s, 100);
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-900">Conversations</h1>
      <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
        {rows.length === 0 ? (
          <li className="px-3 py-3 text-sm text-slate-500">No conversations</li>
        ) : (
          rows.map((r) => (
            <li key={r.id} className="px-3 py-3 text-sm">
              <p className="font-medium text-slate-800">{r.subject || "(no subject)"}</p>
              <p className="text-xs text-slate-500">
                {r.channel} · {r.status ?? "—"}{" "}
                {r.lastMessageAt ? " · " + new Date(r.lastMessageAt).toLocaleString() : ""}
              </p>
              {r.contact ? (
                <p className="text-xs text-slate-500">
                  {(r.contact.firstName ?? "") + " " + (r.contact.lastName ?? "")} · {r.contact.email}
                </p>
              ) : null}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
