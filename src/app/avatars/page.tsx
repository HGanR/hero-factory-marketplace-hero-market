"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AvatarLibraryStudio } from "@/components/avatars/AvatarLibraryStudio";
import { AvatarManager } from "@/components/avatars/AvatarManager";

export default function AvatarsPage() {
  const router = useRouter();

  useEffect(() => {
    const hasAccess =
      localStorage.getItem("user") ||
      localStorage.getItem("adminLoggedIn") === "true" ||
      document.cookie.includes("admin-token") ||
      document.cookie.includes("auth-token");
    if (!hasAccess) {
      router.push("/");
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-slate-100">Avatar Identity</h1>
          <Link
            href="/dashboard"
            className="text-cyan-400 hover:text-cyan-300 text-sm"
          >
            ← Back to Dashboard
          </Link>
        </div>
        <p className="text-slate-400 mb-8 max-w-2xl">
          Design a full 3D character below, then save presets for meeting rooms. Your default
          room avatar is chosen from the list in &quot;Meeting room avatars&quot;.
        </p>

        <div className="space-y-10">
          <AvatarLibraryStudio />

          <div>
            <h2 className="text-lg font-semibold text-slate-200 mb-3">
              Meeting room avatars
            </h2>
            <p className="text-sm text-slate-500 mb-4">
              Preset-based profiles stored on your account — these are what appear when you join
              a room.
            </p>
            <AvatarManager />
          </div>
        </div>
      </div>
    </div>
  );
}
