// src/app/admin/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { Content360ConnectionCard } from "@/components/admin/Content360ConnectionCard";

interface User {
  id: number;
  email: string;
  username: string;
  isActive: boolean;
  isApproved: boolean;
  createdAt: string;
  walletAddress: string | null;
  isConsultant?: boolean;
  /** When false, profile exists but user is hidden from public /consultations picker (isActive on row). */
  consultantListingActive?: boolean | null;
  consultantSpecialty?: string | null;
  consultantNote?: string | null;
  consultantAvatarUrl?: string | null;
}

type AdminOnboardingRow = {
  onboarding: {
    id: number;
    userId: number;
    companyName: string;
    entityType: string;
    jurisdiction: string;
    taxIdLast4: string;
    serviceTier: string;
    onboardingStatus: string;
    letterOfGoodOperationUri: string | null;
    articlesOfIncorporationUri: string | null;
    isRevoked: boolean;
    revokedReason: string | null;
    createdAt: string;
  };
  user: {
    id: number | null;
    email: string | null;
    username: string | null;
  } | null;
};

const fetchCred = { credentials: "include" as const };

function normalizeIsApproved(value: unknown): boolean {
  if (value === true || value === 1) return true;
  if (value === false || value === 0) return false;
  if (typeof value === "string") {
    const s = value.trim().toLowerCase();
    return s === "1" || s === "true" || s === "yes";
  }
  return Boolean(value);
}

function normalizeUserFromApi(raw: unknown): User | null {
  if (!raw || typeof raw !== "object") return null;
  const u = raw as Record<string, unknown>;
  const id = Number(u.id);
  if (!Number.isFinite(id)) return null;
  return {
    id,
    email: String(u.email ?? ""),
    username: String(u.username ?? ""),
    isActive: Boolean(u.isActive),
    isApproved: normalizeIsApproved(u.isApproved),
    createdAt: String(u.createdAt ?? ""),
    walletAddress: u.walletAddress == null || u.walletAddress === "" ? null : String(u.walletAddress),
    isConsultant: Boolean(u.isConsultant),
    consultantListingActive:
      u.consultantListingActive === undefined
        ? undefined
        : u.consultantListingActive === null
          ? null
          : Boolean(u.consultantListingActive),
    consultantSpecialty: u.consultantSpecialty == null ? null : String(u.consultantSpecialty),
    consultantNote: u.consultantNote == null ? null : String(u.consultantNote),
    consultantAvatarUrl:
      u.consultantAvatarUrl == null || u.consultantAvatarUrl === ""
        ? null
        : String(u.consultantAvatarUrl),
  };
}

function parseUsersPayload(data: { users?: unknown }): User[] {
  const raw = data.users;
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeUserFromApi).filter((u): u is User => u !== null);
}

export default function AdminPage() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [onboardings, setOnboardings] = useState<AdminOnboardingRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [generatedPassword, setGeneratedPassword] = useState("");
  const [activeTab, setActiveTab] = useState("pending");
  const [savingConsultantUserId, setSavingConsultantUserId] = useState<number | null>(null);
  const [uploadingAvatarUserId, setUploadingAvatarUserId] = useState<number | null>(null);
  const [consultantProfileRowCount, setConsultantProfileRowCount] = useState<number | null>(null);

  const fullLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", ...fetchCred });
    } catch {
      // ignore
    } finally {
      setIsLoggedIn(false);
      try {
        localStorage.removeItem("adminLoggedIn");
        localStorage.removeItem("user");
      } catch {}
      try {
        window.dispatchEvent(new Event("admin-logout"));
      } catch {}
      router.push("/");
      router.refresh();
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
        ...fetchCred,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error);
      } else {
        setIsLoggedIn(true);
        try {
          localStorage.setItem("adminLoggedIn", "true");
        } catch {}
        try {
          window.dispatchEvent(new Event("admin-login"));
        } catch {}
        await fetchUsers();
      }
    } catch (err) {
      setError("Login failed");
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/users", { ...fetchCred, cache: "no-store" });
      const data = await res.json();
      if (res.ok) {
        const list = parseUsersPayload(data);
        setUsers(list);
        setConsultantProfileRowCount(
          typeof data?.consultantProfileRowCount === "number" ? data.consultantProfileRowCount : null,
        );
        if (data?.warning) setError(String(data.warning));
        else setError("");
        return;
      }
      if (res.status === 401) {
        try {
          localStorage.removeItem("adminLoggedIn");
        } catch {}
        try {
          window.dispatchEvent(new Event("admin-logout"));
        } catch {}
        setIsLoggedIn(false);
      }
      setConsultantProfileRowCount(null);
      setError(data?.error || "Failed to fetch users");
    } catch (err) {
      console.error("Failed to fetch users");
      setConsultantProfileRowCount(null);
      setError("Failed to fetch users");
    }
  }, []);

  useEffect(() => {
    try {
      if (localStorage.getItem("adminLoggedIn") !== "true") return;
    } catch {
      return;
    }
    setIsLoggedIn(true);
    void fetchUsers();
  }, [fetchUsers]);

  const fetchOnboardings = async () => {
    try {
      const res = await fetch("/api/admin/onboarding", { ...fetchCred });
      const data = await res.json();
      if (res.ok) {
        setOnboardings(data.onboardings || []);
      }
    } catch (err) {
      console.error("Failed to fetch onboardings");
    }
  };

  const revokeOnboarding = async (onboardingId: number) => {
    const reason =
      prompt(
        "Revoke reason (shown to user). Leave blank to use default:",
        "Missing required documents"
      ) || "";
    try {
      const res = await fetch("/api/admin/onboarding/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ onboardingId, reason }),
        ...fetchCred,
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to revoke onboarding");
        return;
      }
      fetchOnboardings();
    } catch (err) {
      alert("Failed to revoke onboarding");
    }
  };

  const generatePassword = async (userId: number) => {
    try {
      const res = await fetch("/api/admin/generate-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
        ...fetchCred,
      });

      const data = await res.json();

      if (res.ok) {
        setGeneratedPassword(data.password);
        fetchUsers();
        alert(`Password generated: ${data.password}\n\nCopy this and send it to the user.`);
      } else {
        alert(data.error);
      }
    } catch (err) {
      alert("Failed to generate password");
    }
  };

  const toggleAccess = async (userId: number, isActive: boolean) => {
    try {
      const res = await fetch("/api/admin/toggle-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, isActive }),
        ...fetchCred,
      });

      if (res.ok) {
        fetchUsers();
      }
    } catch (err) {
      alert("Failed to toggle access");
    }
  };

  const deleteUser = async (userId: number) => {
    const confirmDelete = window.confirm("Delete this user account? This cannot be undone.");
    if (!confirmDelete) return;
    try {
      const res = await fetch("/api/admin/users/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
        ...fetchCred,
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        alert(data?.error || "Failed to delete user");
        return;
      }
      setUsers((prev) => prev.filter((u) => u.id !== userId));
    } catch (err) {
      alert("Failed to delete user");
    }
  };

  const saveConsultant = async (u: User) => {
    if (!u?.id) return;
    setSavingConsultantUserId(u.id);
    try {
      const res = await fetch("/api/admin/consultants/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: u.id,
          isConsultant: !!u.isConsultant,
          specialty: (u.consultantSpecialty ?? "").trim(),
          note: u.consultantNote ?? "",
        }),
        ...fetchCred,
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data?.error || "Failed to save consultant settings");
        return;
      }
      fetchUsers();
    } catch {
      alert("Failed to save consultant settings");
    } finally {
      setSavingConsultantUserId(null);
    }
  };

  const CONSULTANT_AVATAR_FILE_MAX_BYTES = 1_200_000;

  const uploadConsultantAvatar = async (userId: number, file: File) => {
    setUploadingAvatarUserId(userId);
    try {
      if (file.size > CONSULTANT_AVATAR_FILE_MAX_BYTES) {
        alert(`Image too large (max ~${Math.round(CONSULTANT_AVATAR_FILE_MAX_BYTES / 1024)} KB).`);
        return;
      }
      const consultant_avatar_data_url = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const s = typeof reader.result === "string" ? reader.result : "";
          if (!s) reject(new Error("Could not read image"));
          else resolve(s);
        };
        reader.onerror = () => reject(new Error("Could not read file"));
        reader.readAsDataURL(file);
      });
      const res = await fetch("/api/admin/consultants/avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, consultant_avatar_data_url }),
        ...fetchCred,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(typeof data?.error === "string" ? data.error : "Failed to upload photo");
        return;
      }
      const url = typeof data?.avatarUrl === "string" ? data.avatarUrl : null;
      if (url) {
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, consultantAvatarUrl: url, isConsultant: true } : u)),
        );
      } else {
        fetchUsers();
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to upload photo");
    } finally {
      setUploadingAvatarUserId(null);
    }
  };

  const clearConsultantAvatar = async (userId: number) => {
    if (!window.confirm("Remove this consultant’s photo?")) return;
    setUploadingAvatarUserId(userId);
    try {
      const res = await fetch("/api/admin/consultants/avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, clear: true }),
        ...fetchCred,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(typeof data?.error === "string" ? data.error : "Failed to remove photo");
        return;
      }
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, consultantAvatarUrl: null } : u)),
      );
    } catch {
      alert("Failed to remove photo");
    } finally {
      setUploadingAvatarUserId(null);
    }
  };

  const pendingUsers = users.filter((u) => !u.isApproved);
  const approvedUsers = users.filter((u) => u.isApproved);

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-cyan-900 to-slate-900 flex items-center justify-center">
        <div className="w-full max-w-md bg-black/50 backdrop-blur-sm rounded-lg p-8 border border-cyan-500/30">
          <h1 className="text-2xl font-bold text-white text-center mb-6">
            Admin Login
          </h1>

          {error && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500 rounded text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-lg bg-slate-800 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 pr-12 rounded-lg bg-slate-800 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-cyan-500 hover:bg-cyan-400 text-black font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? "Logging in..." : "Login"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-cyan-900 to-slate-900">
      <nav className="flex items-center justify-between px-6 py-4 border-b border-cyan-500/30">
        <h1 className="text-xl font-bold text-white">Admin Panel</h1>
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/dashboard")}
            className="text-slate-400 hover:text-white"
          >
            Dashboard
          </button>
          <button
            onClick={() => router.push("/oasis-elements")}
            className="text-slate-400 hover:text-white"
          >
            OASIS ELEMENTS
          </button>
          <button
            onClick={() => router.push("/admin/besu-bundle")}
            className="text-slate-400 hover:text-white"
          >
            BESU
          </button>
          <button
            onClick={() => router.push("/admin/xrpl")}
            className="text-slate-400 hover:text-white"
          >
            XRPL
          </button>
          <button
            onClick={() => router.push("/admin/skipper")}
            className="rounded border border-[#00A3FF]/50 bg-[#000814]/80 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-[#00A3FF] shadow-[0_0_12px_rgba(0,163,255,0.25)] hover:bg-[#00A3FF]/10"
          >
            SKIPPER
          </button>
          <button
            onClick={() => router.push("/admin/executive-agent")}
            className="rounded border border-[#00FF85]/45 bg-[#000814]/80 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-[#00FF85] shadow-[0_0_12px_rgba(0,255,133,0.18)] hover:bg-[#00FF85]/10"
          >
            EXEC ADMIN
          </button>
          <button
            onClick={fullLogout}
            className="text-slate-400 hover:text-white"
          >
            Logout
          </button>
        </div>
      </nav>

      <main className="p-6">
        <div className="mb-6 max-w-3xl">
          <Content360ConnectionCard />
        </div>
        {error ? (
          <div
            className="mb-4 rounded-lg border border-amber-500/40 bg-amber-950/40 px-4 py-3 text-amber-100 text-sm"
            role="alert"
          >
            {error}
          </div>
        ) : null}
        {consultantProfileRowCount !== null ? (
          <p className="mb-4 text-xs text-slate-400">
            Consultant profile rows in this database:{" "}
            <span className="font-semibold text-slate-300">{consultantProfileRowCount}</span>.
            {consultantProfileRowCount === 0 ? (
              <>
                {" "}
                If you expected existing assignments, the deployed{" "}
                <code className="rounded bg-slate-800 px-1 text-slate-200">DATABASE_URL</code> may
                point at a different instance than where consultants were created, or{" "}
                <code className="rounded bg-slate-800 px-1 text-slate-200">consultant_profiles</code>{" "}
                has no rows yet.
              </>
            ) : (
              <>
                {" "}
                Saving again uses the same{" "}
                <code className="rounded bg-slate-800 px-1 text-slate-200">userId</code> primary key
                (upsert) — you will not get duplicate consultant rows per account.
              </>
            )}
          </p>
        ) : null}
        {/* Tabs */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setActiveTab("pending")}
            className={`px-4 py-2 rounded-lg transition-colors ${
              activeTab === "pending"
                ? "bg-cyan-500 text-black font-semibold"
                : "bg-slate-800 text-slate-400"
            }`}
          >
            Pending ({pendingUsers.length})
          </button>
          <button
            onClick={() => setActiveTab("approved")}
            className={`px-4 py-2 rounded-lg transition-colors ${
              activeTab === "approved"
                ? "bg-cyan-500 text-black font-semibold"
                : "bg-slate-800 text-slate-400"
            }`}
          >
            Approved ({approvedUsers.length})
          </button>
          <button
            onClick={() => {
              setActiveTab("onboarding");
              fetchOnboardings();
            }}
            className={`px-4 py-2 rounded-lg transition-colors ${
              activeTab === "onboarding"
                ? "bg-cyan-500 text-black font-semibold"
                : "bg-slate-800 text-slate-400"
            }`}
          >
            Onboarding
          </button>
        </div>

        {activeTab === "onboarding" ? (
          <div className="bg-black/50 rounded-lg border border-cyan-500/30 overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-800">
                <tr>
                  <th className="px-4 py-3 text-left text-sm text-slate-400">
                    User
                  </th>
                  <th className="px-4 py-3 text-left text-sm text-slate-400">
                    Organization
                  </th>
                  <th className="px-4 py-3 text-left text-sm text-slate-400">
                    Docs
                  </th>
                  <th className="px-4 py-3 text-left text-sm text-slate-400">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-sm text-slate-400">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {onboardings.map((row) => {
                  const o = row.onboarding;
                  const u = row.user;
                  const missing =
                    (!o.letterOfGoodOperationUri ? 1 : 0) +
                    (!o.articlesOfIncorporationUri ? 1 : 0);
                  return (
                    <tr key={o.id} className="border-t border-slate-700">
                      <td className="px-4 py-3 text-white">
                        <div className="font-semibold">
                          {u?.username || u?.email || `User #${o.userId}`}
                        </div>
                        <div className="text-xs text-slate-400">{u?.email || ""}</div>
                        <div className="mt-1 flex gap-2 flex-wrap">
                          {missing > 0 && !o.isRevoked && (
                            <span className="px-2 py-0.5 rounded text-xs bg-yellow-500/20 text-yellow-300">
                              Missing Docs
                            </span>
                          )}
                          {o.isRevoked && (
                            <span className="px-2 py-0.5 rounded text-xs bg-red-500/20 text-red-300">
                              Revoked
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-white">
                        <div className="font-semibold">{o.companyName}</div>
                        <div className="text-xs text-slate-400">
                          {o.entityType} • {o.jurisdiction} • Tier: {o.serviceTier} • EIN last4:
                          {" "}
                          ••••{o.taxIdLast4}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-200 text-sm">
                        {missing === 0 ? (
                          <span className="text-green-400">Complete</span>
                        ) : (
                          <span className="text-yellow-300">Missing {missing}/2</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-200 text-sm">
                        {o.onboardingStatus}
                        {o.isRevoked && o.revokedReason ? (
                          <div className="text-xs text-slate-400 mt-1">
                            Reason: {o.revokedReason}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => revokeOnboarding(o.id)}
                          disabled={o.isRevoked}
                          className={`px-3 py-1 text-sm rounded ${
                            o.isRevoked
                              ? "bg-slate-700 text-slate-400 cursor-not-allowed"
                              : "bg-red-500 text-white hover:bg-red-600"
                          }`}
                        >
                          Revoke
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bg-black/50 rounded-lg border border-cyan-500/30 overflow-x-auto">
            <table className="w-full min-w-[1200px]">
              <thead className="bg-slate-800">
                <tr>
                  <th className="px-4 py-3 text-left text-sm text-slate-400 w-64">
                    Email
                  </th>
                  <th className="px-4 py-3 text-left text-sm text-slate-400 w-48">
                    Username
                  </th>
                  <th className="px-4 py-3 text-left text-sm text-slate-400 w-28">
                    Status
                  </th>
                  {activeTab === "approved" && (
                    <>
                      <th className="px-4 py-3 text-left text-sm text-slate-400 w-32">
                        Revoke
                      </th>
                      <th className="px-4 py-3 text-left text-sm text-slate-400 w-32">
                        Consultant
                      </th>
                      <th className="px-4 py-3 text-left text-sm text-slate-400 w-52">
                        Specialty
                      </th>
                      <th className="px-4 py-3 text-left text-sm text-slate-400 w-64">
                        Note
                      </th>
                      <th className="px-4 py-3 text-left text-sm text-slate-400 w-44">
                        Consultant photo
                      </th>
                    </>
                  )}
                  <th className="px-4 py-3 text-left text-sm text-slate-400 w-64">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {(activeTab === "pending" ? pendingUsers : approvedUsers).map(
                  (user) => (
                    <tr key={user.id} className="border-t border-slate-700">
                      <td className="px-4 py-3 text-white">{user.email}</td>
                      <td className="px-4 py-3 text-white">{user.username}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-1 rounded text-xs ${
                            user.isActive
                              ? "bg-green-500/20 text-green-400"
                              : "bg-red-500/20 text-red-400"
                          }`}
                        >
                          {user.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      {activeTab === "approved" && (
                        <>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <label className="inline-flex items-center gap-2 text-sm text-slate-200">
                              <input
                                type="checkbox"
                                checked={!user.isActive}
                                onChange={(e) => toggleAccess(user.id, !e.target.checked ? true : false)}
                              />
                              Revoke access
                            </label>
                            <div className="mt-1 text-xs text-slate-400">
                              Current: {user.isActive ? "Active" : "Inactive"}
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex flex-col gap-1">
                              <label className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-200">
                                <input
                                  type="checkbox"
                                  checked={!!user.isConsultant}
                                  onChange={(e) => {
                                    const checked = e.target.checked;
                                    setUsers((prev) =>
                                      prev.map((u) =>
                                        u.id === user.id
                                          ? {
                                              ...u,
                                              isConsultant: checked,
                                              consultantSpecialty: checked
                                                ? (u.consultantSpecialty ?? "")
                                                : "",
                                              consultantNote: checked ? (u.consultantNote ?? "") : "",
                                            }
                                          : u
                                      )
                                    );
                                  }}
                                />
                                Consultant
                              </label>
                              {user.isConsultant && user.consultantListingActive === false ? (
                                <span className="text-[10px] text-amber-400/90">
                                  Hidden from public bookings (profile inactive)
                                </span>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="text"
                              value={user.consultantSpecialty ?? ""}
                              disabled={!user.isConsultant}
                              onChange={(e) => {
                                const v = e.target.value;
                                setUsers((prev) =>
                                  prev.map((u) =>
                                    u.id === user.id ? { ...u, consultantSpecialty: v } : u
                                  )
                                );
                              }}
                              placeholder="e.g., Trust Compliance"
                              className="w-full min-w-[180px] px-3 py-2 rounded bg-slate-900 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <textarea
                              value={user.consultantNote ?? ""}
                              disabled={!user.isConsultant}
                              onChange={(e) => {
                                const v = e.target.value;
                                setUsers((prev) =>
                                  prev.map((u) =>
                                    u.id === user.id ? { ...u, consultantNote: v } : u
                                  )
                                );
                              }}
                              placeholder="Short note shown to the client when they choose this specialist"
                              className="w-full min-w-[260px] px-3 py-2 rounded bg-slate-900 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50"
                              rows={2}
                            />
                          </td>
                          <td className="px-4 py-3 align-top">
                            <div className="flex flex-col gap-2 max-w-[200px]">
                              <div className="flex items-center gap-2">
                                <div
                                  className="h-12 w-12 shrink-0 overflow-hidden rounded-full border-2 border-cyan-500/40 bg-slate-800 ring-2 ring-cyan-500/20 shadow-inner flex items-center justify-center text-xs font-bold text-slate-400"
                                  title="Shown on /consultations next to booking"
                                >
                                  {user.consultantAvatarUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element -- data URLs / arbitrary consultant avatars
                                    <img
                                      src={user.consultantAvatarUrl}
                                      alt=""
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    <span className="px-0.5 text-center leading-tight">
                                      {(user.username || "?").slice(0, 2).toUpperCase()}
                                    </span>
                                  )}
                                </div>
                                <div className="min-w-0 flex-1 flex flex-col gap-1">
                                  <input
                                    id={`consultant-avatar-file-${user.id}`}
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp,image/gif"
                                    className="sr-only"
                                    tabIndex={-1}
                                    onChange={(e) => {
                                      const f = e.target.files?.[0];
                                      e.target.value = "";
                                      if (f) void uploadConsultantAvatar(user.id, f);
                                    }}
                                  />
                                  <label
                                    htmlFor={`consultant-avatar-file-${user.id}`}
                                    className={`inline-flex w-fit rounded bg-cyan-600 px-2 py-1 text-xs font-medium text-black hover:bg-cyan-500 ${
                                      uploadingAvatarUserId === user.id || savingConsultantUserId === user.id
                                        ? "pointer-events-none cursor-not-allowed opacity-40"
                                        : "cursor-pointer"
                                    }`}
                                  >
                                    Browse
                                  </label>
                                  {uploadingAvatarUserId === user.id ? (
                                    <span className="text-xs text-cyan-300">Uploading…</span>
                                  ) : null}
                                </div>
                              </div>
                              {user.consultantAvatarUrl && user.isConsultant ? (
                                <button
                                  type="button"
                                  onClick={() => void clearConsultantAvatar(user.id)}
                                  disabled={uploadingAvatarUserId === user.id}
                                  className="self-start text-xs text-amber-300/90 underline hover:text-amber-200 disabled:opacity-40"
                                >
                                  Remove photo
                                </button>
                              ) : null}
                            </div>
                          </td>
                        </>
                      )}
                      <td className="px-4 py-3">
                        {!user.isApproved ? (
                          <button
                            onClick={() => generatePassword(user.id)}
                            className="px-3 py-1 bg-cyan-500 text-black text-sm rounded hover:bg-cyan-400"
                          >
                            Generate Password
                          </button>
                        ) : (
                          <div className="flex flex-col gap-2 items-start">
                            <div className="flex items-center gap-2 flex-wrap">
                              <button
                                onClick={() => toggleAccess(user.id, !user.isActive)}
                                className={`px-3 py-1 text-sm rounded ${
                                  user.isActive
                                    ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                                    : "bg-green-500/20 text-green-400 hover:bg-green-500/30"
                                }`}
                              >
                                {user.isActive ? "Revoke" : "Restore"}
                              </button>
                              <button
                                onClick={() => deleteUser(user.id)}
                                className="px-3 py-1 text-sm rounded bg-red-600 text-white hover:bg-red-500"
                              >
                                Delete
                              </button>
                            </div>
                            {activeTab === "approved" && (
                              <div className="flex flex-col gap-2 items-stretch w-full max-w-[220px]">
                                <button
                                  type="button"
                                  onClick={() => saveConsultant(user)}
                                  disabled={savingConsultantUserId === user.id}
                                  className={`px-3 py-1 text-sm rounded ${
                                    savingConsultantUserId === user.id
                                      ? "bg-slate-700 text-slate-300 cursor-not-allowed"
                                      : "bg-cyan-500 text-black hover:bg-cyan-400"
                                  }`}
                                  title="Save consultant settings"
                                >
                                  {savingConsultantUserId === user.id ? "Saving..." : "Save"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => generatePassword(user.id)}
                                  className="px-3 py-1 bg-cyan-500/90 text-black text-sm rounded hover:bg-cyan-400 border border-cyan-400/50"
                                >
                                  Generate password
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}

