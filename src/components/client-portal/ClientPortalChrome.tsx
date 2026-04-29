"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import type { ClientPortalSessionState } from "@/lib/client-portal/portal-session";

const nav = (base: string) =>
  [
    { href: base, label: "Overview" },
    { href: `${base}/analytics`, label: "Analytics" },
    { href: `${base}/conversations`, label: "Conversations" },
    { href: `${base}/contacts`, label: "Contacts" },
    { href: `${base}/requests`, label: "Requests" },
    { href: `${base}/agent`, label: "AI Agent" },
    { href: `${base}/settings`, label: "Settings" },
  ] as const;

type Service = { status: string; showServiceBanner: boolean };

type Props = {
  session: ClientPortalSessionState;
  service: Service;
  children: ReactNode;
};

export function ClientPortalChrome({ session, service, children }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const base = "/client-portal";

  return (
    <div className="min-h-screen flex flex-col">
      {service.showServiceBanner ? (
        <div
          className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-950"
          role="status"
        >
          Your service is currently limited. This portal is read-only.
        </div>
      ) : null}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-slate-800">{session.client.name}</p>
            <p className="text-xs text-slate-500">Client portal</p>
          </div>
          <div className="flex items-center gap-2">
            <ServiceBadge service={service} />
            <button
              type="button"
              className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
              onClick={async () => {
                await fetch("/api/client-portal/logout", { method: "POST" });
                router.push("/client-portal/login");
                router.refresh();
              }}
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-6 md:flex-row">
        <aside className="w-full shrink-0 md:w-52">
          <nav className="flex flex-wrap gap-1 md:flex-col" aria-label="Client portal">
            {nav(base).map(({ href, label }) => {
              const active = href === base ? pathname === base : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`rounded-md px-3 py-1.5 text-sm ${
                    active ? "bg-cyan-100 font-medium text-cyan-900" : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}

function ServiceBadge({ service }: { service: Service }) {
  const t =
    service.status === "active" ? { label: "Active", c: "bg-emerald-50 text-emerald-800" } : { label: service.status, c: "bg-amber-50 text-amber-900" };
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${t.c}`} data-testid="client-portal-service-badge">
      {t.label}
    </span>
  );
}
