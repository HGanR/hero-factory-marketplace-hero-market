"use client";

import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { Calendar, ChevronDown, LayoutDashboard, LogOut, Package, MoreHorizontal } from "lucide-react";
import { useState, useRef, useEffect } from "react";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, external: true },
  { href: "/oasis-elements", label: "Oasis Elements", external: true },
  { href: "/admin/world-assets", label: "Asset Library", icon: Package },
  { href: "/green-terrain", label: "Green Terrain", external: true },
  { href: "/modeling", label: "Modeling", external: true },
  { href: "/admin/besu-bundle", label: "Besu" },
  { href: "/admin/xrpl", label: "XRPL" },
  { href: "/admin/npc", label: "NPCs" },
  { href: "/admin/appointments", label: "Appointments", icon: Calendar },
  { href: "/admin/executive-agent", label: "Executive Agent" },
  { href: "/app/dashboard", label: "CRM", external: true },
  { href: "/admin/crypto-window", label: "Crypto Window" },
  { href: "/admin/troo-sales", label: "Troo Sales" },
  { href: "/admin/merch-jobs", label: "Merch Jobs" },
  { href: "/admin/emails-sent", label: "Emails Sent" },
];

export function AdminNavBar({
  appointmentCount = 0,
  onLogout,
}: {
  appointmentCount?: number;
  onLogout?: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  const primary = NAV_ITEMS.slice(0, 6);
  const secondary = NAV_ITEMS.slice(6);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const NavLink = ({ item }: { item: (typeof NAV_ITEMS)[0] }) => {
    const isActive = pathname === item.href || (item.href !== "/admin" && pathname?.startsWith(item.href));
    const content = (
      <>
        {item.icon && <item.icon className="h-4 w-4 shrink-0" />}
        {item.label}
        {item.href === "/admin/appointments" && appointmentCount > 0 && (
          <span className="ml-1 min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold text-white bg-red-500 rounded-full px-1">
            {appointmentCount > 99 ? "99+" : appointmentCount}
          </span>
        )}
      </>
    );
    const className = `flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-colors ${
      isActive ? "bg-cyan-500/20 text-cyan-300" : "text-slate-400 hover:text-white hover:bg-slate-700/50"
    }`;
    if (item.external) {
      return (
        <Link href={item.href} className={className} target={item.href.startsWith("http") ? "_blank" : undefined}>
          {content}
        </Link>
      );
    }
    return (
      <button type="button" onClick={() => router.push(item.href)} className={className}>
        {content}
      </button>
    );
  };

  return (
    <nav className="sticky top-0 z-[200] flex items-center justify-between gap-4 border-b border-slate-700/50 bg-slate-900/95 px-6 py-3 backdrop-blur-md">
      <div className="flex items-center gap-1">
        <Link href="/admin" className="text-lg font-bold text-white hover:text-cyan-400 transition-colors">
          Admin Panel
        </Link>
        <span className="text-slate-500 mx-2">|</span>
        <div className="flex items-center gap-1 flex-wrap">
          {primary.map((item) => (
            <NavLink key={item.href} item={item} />
          ))}
          <div className="relative" ref={moreRef}>
            <button
              type="button"
              onClick={() => setMoreOpen((o) => !o)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                moreOpen ? "bg-slate-700/50 text-white" : "text-slate-400 hover:text-white hover:bg-slate-700/50"
              }`}
            >
              <MoreHorizontal className="h-4 w-4" />
              More
              <ChevronDown className={`h-4 w-4 transition-transform ${moreOpen ? "rotate-180" : ""}`} />
            </button>
            {moreOpen && (
              <div className="absolute left-0 top-full z-[210] mt-1 min-w-[180px] rounded-lg border border-slate-600 bg-slate-800 py-2 shadow-2xl ring-1 ring-black/20">
                {secondary.map((item) => (
                  <div key={item.href} className="px-2">
                    <NavLink item={item} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={async () => {
          if (onLogout) {
            onLogout();
            return;
          }
          try {
            await fetch("/api/auth/logout", { method: "POST" });
          } catch {}
          try {
            localStorage.removeItem("adminLoggedIn");
            localStorage.removeItem("user");
          } catch {}
          try {
            window.dispatchEvent(new Event("admin-logout"));
          } catch {}
          router.push("/");
          router.refresh();
        }}
        className="flex items-center gap-2 px-3 py-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-700/50 transition-colors"
      >
        <LogOut className="h-4 w-4" />
        Logout
      </button>
    </nav>
  );
}
