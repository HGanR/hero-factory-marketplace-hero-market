// src/app/admin/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";

interface User {
  id: number;
  email: string;
  username: string;
  isActive: boolean;
  isApproved: boolean;
  createdAt: string;
  walletAddress: string | null;
  isConsultant?: boolean;
  consultantSpecialty?: string | null;
  consultantNote?: string | null;
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

  const fullLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore
    } finally {
      setIsLoggedIn(false);
      try {
        localStorage.removeItem("adminLoggedIn");
        localStorage.removeItem("user");
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
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error);
      } else {
        setIsLoggedIn(true);
        try {
          localStorage.setItem("adminLoggedIn", "true");
        } catch {}
        fetchUsers();
      }
    } catch (err) {
      setError("Login failed");
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/admin/users");
      const data = await res.json();
      if (res.ok) {
        setUsers(data.users);
        if (data?.warning) {
          setError(String(data.warning));
        }
        return;
      }
      setError(data?.error || "Failed to fetch users");
    } catch (err) {
      console.error("Failed to fetch users");
      setError("Failed to fetch users");
    }
  };

  const fetchOnboardings = async () => {
    try {
      const res = await fetch("/api/admin/onboarding");
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
            onClick={fullLogout}
            className="text-slate-400 hover:text-white"
          >
            Logout
          </button>
        </div>
      </nav>

      <main className="p-6">
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
                            <label className="inline-flex items-center gap-2 text-sm text-slate-200">
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
                            {activeTab === "approved" && (
                              <button
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

