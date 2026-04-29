type ConversationRow = {
  subject: string | null;
  lastMessagePreview: string | null;
  lastMessageAt: string | Date | null;
  channel: string | null;
};

export function PortalConversationSummary({ items }: { items: ConversationRow[] }) {
  return (
    <section>
      <h2 className="text-sm font-semibold text-slate-800">Latest conversations</h2>
      <ul className="mt-2 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
        {items.length === 0 ? (
          <li className="px-3 py-2 text-sm text-slate-500">No conversations yet</li>
        ) : (
          items.slice(0, 5).map((c, i) => (
            <li key={i} className="px-3 py-2 text-sm">
              <p className="font-medium text-slate-800">{c.subject || "(no subject)"}</p>
              <p className="text-xs text-slate-500">
                {c.lastMessageAt ? new Date(c.lastMessageAt).toLocaleString() : "—"} · {c.channel ?? "web"}
              </p>
              {c.lastMessagePreview ? <p className="mt-0.5 line-clamp-2 text-slate-600">{c.lastMessagePreview}</p> : null}
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
