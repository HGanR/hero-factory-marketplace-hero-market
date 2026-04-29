"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { AdminNavBar } from "@/components/admin/AdminNavBar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [appointmentCount, setAppointmentCount] = useState(0);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function checkAuth() {
      try {
        const res = await fetch("/api/admin/check", { credentials: "include", cache: "no-store" });
        if (cancelled) return;
        setIsAuthenticated(res.ok);
      } catch {
        if (!cancelled) setIsAuthenticated(false);
      }
    }
    checkAuth();
    const onAdminLogin = () => {
      setIsAuthenticated(true);
    };
    window.addEventListener("admin-login", onAdminLogin);
    return () => {
      cancelled = true;
      window.removeEventListener("admin-login", onAdminLogin);
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
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
    fetchCount();
    const onAdminLogin = () => fetchCount();
    window.addEventListener("admin-login", onAdminLogin);
    return () => {
      cancelled = true;
      window.removeEventListener("admin-login", onAdminLogin);
    };
  }, [isAuthenticated]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-cyan-900 to-slate-900">
      {isAuthenticated === true ? (
        <AdminNavBar appointmentCount={appointmentCount} />
      ) : isAuthenticated === false ? (
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
