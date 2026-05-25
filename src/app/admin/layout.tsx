"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { AdminNavBar } from "@/components/admin/AdminNavBar";

/**
 * Full admin chrome (AdminNavBar) only after explicit admin UI login
 * (`localStorage.adminLoggedIn`) AND a valid admin session cookie.
 * Otherwise `/api/admin/check` alone can be true while the login form is shown
 * (e.g. stale cookies), which duplicated the top nav.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [appointmentCount, setAppointmentCount] = useState(0);
  const [showFullNav, setShowFullNav] = useState(false);
  const [chromeReady, setChromeReady] = useState(false);

  const refreshChrome = useCallback(async () => {
    let ls = false;
    try {
      ls = localStorage.getItem("adminLoggedIn") === "true";
    } catch {
      ls = false;
    }
    if (!ls) {
      setShowFullNav(false);
      setChromeReady(true);
      return;
    }
    try {
      const res = await fetch("/api/admin/check", { credentials: "include", cache: "no-store" });
      setShowFullNav(res.ok);
    } catch {
      setShowFullNav(false);
    } finally {
      setChromeReady(true);
    }
  }, []);

  useEffect(() => {
    void refreshChrome();
    const onAdminLogin = () => void refreshChrome();
    const onAdminLogout = () => {
      setShowFullNav(false);
    };
    window.addEventListener("admin-login", onAdminLogin);
    window.addEventListener("admin-logout", onAdminLogout);
    return () => {
      window.removeEventListener("admin-login", onAdminLogin);
      window.removeEventListener("admin-logout", onAdminLogout);
    };
  }, [refreshChrome]);

  useEffect(() => {
    if (!showFullNav) return;
    let cancelled = false;
    async function fetchCount() {
      try {
        const res = await fetch("/api/appointments?action=new_count", { credentials: "include" });
        if (cancelled) return;
        if (res.ok) {
          const d = await res.json();
          if (typeof d?.count === "number") setAppointmentCount(d.count);
        }
      } catch {
        // ignore
      }
    }
    void fetchCount();
    const onAdminLogin = () => void fetchCount();
    window.addEventListener("admin-login", onAdminLogin);
    return () => {
      cancelled = true;
      window.removeEventListener("admin-login", onAdminLogin);
    };
  }, [showFullNav]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-cyan-900 to-slate-900">
      {showFullNav ? (
        <AdminNavBar appointmentCount={appointmentCount} />
      ) : chromeReady ? (
        <div className="px-6 py-3 border-b border-slate-700/50">
          <Link href="/admin" className="text-lg font-bold text-white hover:text-cyan-400 transition-colors">
            Admin
          </Link>
        </div>
      ) : null}
      {children}
    </div>
  );
}
