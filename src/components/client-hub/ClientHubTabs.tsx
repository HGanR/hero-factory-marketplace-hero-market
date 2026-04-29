"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const subLinks = (clientId: string) =>
  [
    { path: "", label: "Overview" },
    { path: "/command-center", label: "Command Center" },
    { path: "/sites", label: "Sites" },
    { path: "/agents", label: "Agents" },
    { path: "/inbox", label: "Inbox" },
    { path: "/requests", label: "Requests" },
    { path: "/analytics", label: "Analytics" },
    { path: "/campaigns", label: "Campaigns" },
    { path: "/portal", label: "Client portal" },
  ] as const;

type Props = { clientId: string };

export function ClientHubTabs({ clientId }: Props) {
  const pathname = usePathname();
  const base = `/ai-revenue-os/clients/${clientId}`;

  return (
    <div className="flex gap-1 overflow-x-auto border-b border-white/5 pb-0 sm:flex-wrap" role="tablist" aria-label="Client sections">
      {subLinks(clientId).map(({ path, label }) => {
        const href = path ? `${base}${path}` : base;
        const active =
          path === "/portal" || path === "/command-center" || path === "/requests"
            ? pathname === href || pathname.startsWith(href + "/")
            : pathname === href;
        return (
          <Link
            key={href}
            href={href}
            role="tab"
            aria-selected={active}
            className={`shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition ${
              active
                ? "border-cyan-400 text-cyan-200"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}
