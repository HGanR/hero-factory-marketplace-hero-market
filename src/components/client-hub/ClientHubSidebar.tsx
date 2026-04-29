import Link from "next/link";

const links = (clientId: string) =>
  [
    { href: `/ai-revenue-os/clients/${clientId}`, label: "Overview" },
    { href: `/ai-revenue-os/clients/${clientId}/command-center`, label: "Command Center" },
    { href: `/ai-revenue-os/clients/${clientId}/sites`, label: "Sites" },
    { href: `/ai-revenue-os/clients/${clientId}/agents`, label: "AI agents" },
    { href: `/ai-revenue-os/clients/${clientId}/inbox`, label: "Inbox" },
    { href: `/ai-revenue-os/clients/${clientId}/requests`, label: "Requests" },
    { href: `/ai-revenue-os/clients/${clientId}/analytics`, label: "Analytics" },
    { href: `/ai-revenue-os/clients/${clientId}/campaigns`, label: "Campaigns" },
    { href: `/ai-revenue-os/clients/${clientId}/portal`, label: "Client portal" },
  ] as const;

type Props = {
  clientId: string;
  clientName: string;
};

export function ClientHubSidebar({ clientId, clientName }: Props) {
  return (
    <aside className="w-full shrink-0 border-b border-white/5 pb-4 lg:w-56 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Client</p>
      <p className="mt-1 font-medium text-cyan-100 line-clamp-2">{clientName}</p>
      <nav className="mt-4 space-y-1" aria-label="Client hub">
        {links(clientId).map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="block rounded-lg px-2 py-1.5 text-sm text-slate-300 transition hover:bg-white/5 hover:text-cyan-200"
          >
            {l.label}
          </Link>
        ))}
      </nav>
      <Link
        href="/ai-revenue-os/clients"
        className="mt-6 inline-block text-xs text-slate-500 transition hover:text-cyan-300/90"
      >
        ← All clients
      </Link>
    </aside>
  );
}
