"use client";

import { useCallback, useEffect, useState } from "react";

type UserRow = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  status: string;
  lastLoginAt: string | null;
  createdAt: string | null;
};

type PendingInvite = {
  id: string;
  email: string;
  role: string;
  expiresAt: string | null;
  createdAt: string | null;
};

export function ClientPortalOperatorPanel({ clientId }: { clientId: string }) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [pending, setPending] = useState<PendingInvite[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("manager");
  const [lastInviteLink, setLastInviteLink] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/revenue-os/clients/${encodeURIComponent(clientId)}/portal/users`, {
      credentials: "include",
    });
    const data = (await res.json().catch(() => ({}))) as {
      users?: UserRow[];
      pendingInvites?: PendingInvite[];
      error?: string;
    };
    if (!res.ok) {
      setError(data.error ?? "Failed to load");
      return;
    }
    setUsers(data.users ?? []);
    setPending(data.pendingInvites ?? []);
    setError(null);
  }, [clientId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setLastInviteLink(null);
    setExpiresAt(null);
    try {
      const res = await fetch(`/api/revenue-os/clients/${encodeURIComponent(clientId)}/portal/invite`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        inviteLink?: string;
        expiresAt?: string;
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Invite failed");
        return;
      }
      setLastInviteLink(data.inviteLink ?? null);
      setExpiresAt(data.expiresAt ?? null);
      setEmail("");
      await load();
    } finally {
      setLoading(false);
    }
  }

  async function revokeUser(id: string) {
    if (!confirm("Revoke this user’s access?")) return;
    const res = await fetch(
      `/api/revenue-os/clients/${encodeURIComponent(clientId)}/portal/users/${encodeURIComponent(id)}`,
      { method: "DELETE", credentials: "include" },
    );
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Failed");
      return;
    }
    await load();
  }

  async function copyLink() {
    if (!lastInviteLink) return;
    await navigator.clipboard.writeText(lastInviteLink);
  }

  return (
    <div className="space-y-6 rounded-xl border border-white/10 bg-slate-900/40 p-4">
      <div>
        <h2 className="text-lg font-semibold text-cyan-100">Client portal access</h2>
        <p className="mt-1 text-sm text-slate-400">
          Invite end-customer contacts to sign in at <span className="text-slate-300">/client-portal</span> with their own
          password (not your marketplace account).
        </p>
      </div>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      <form onSubmit={invite} className="flex flex-wrap items-end gap-2">
        <label className="text-sm text-slate-300">
          Email
          <input
            className="ml-2 rounded-md border border-white/10 bg-slate-950 px-2 py-1.5 text-slate-100"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="text-sm text-slate-300">
          Role
          <select
            className="ml-2 rounded-md border border-white/10 bg-slate-950 px-2 py-1.5 text-slate-100"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            <option value="owner">owner</option>
            <option value="manager">manager</option>
            <option value="viewer">viewer</option>
          </select>
        </label>
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-cyan-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-cyan-500 disabled:opacity-50"
        >
          {loading ? "Sending…" : "Send invite"}
        </button>
      </form>

      {lastInviteLink ? (
        <div className="rounded-lg border border-cyan-500/30 bg-cyan-950/30 p-3 text-sm text-cyan-100">
          <p>Invite link (copy now — not stored in full):</p>
          <p className="mt-1 break-all font-mono text-xs text-cyan-200">{lastInviteLink}</p>
          {expiresAt ? <p className="mt-1 text-xs text-cyan-400/90">Expires: {new Date(expiresAt).toLocaleString()}</p> : null}
          <button
            type="button"
            onClick={copyLink}
            className="mt-2 rounded border border-cyan-500/40 px-2 py-1 text-xs text-cyan-200 hover:bg-white/5"
          >
            Copy link
          </button>
        </div>
      ) : null}

      <section>
        <h3 className="text-sm font-medium text-slate-300">Pending invites</h3>
        {pending.length === 0 ? (
          <p className="text-sm text-slate-500">None</p>
        ) : (
          <ul className="mt-1 divide-y divide-white/5 text-sm text-slate-300">
            {pending.map((p) => (
              <li key={p.id} className="py-1">
                {p.email} — {p.role} — exp {p.expiresAt ? new Date(p.expiresAt).toLocaleString() : "—"}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="text-sm font-medium text-slate-300">Portal users</h3>
        {users.length === 0 ? (
          <p className="text-sm text-slate-500">No users yet</p>
        ) : (
          <ul className="mt-1 divide-y divide-white/5">
            {users.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm text-slate-200">
                <div>
                  <span className="font-medium">{u.email}</span>{" "}
                  <span className="text-slate-500">
                    {u.name ? `· ${u.name} ` : ""}· {u.role} · {u.status}
                  </span>
                </div>
                {u.status !== "revoked" ? (
                  <button
                    type="button"
                    onClick={() => void revokeUser(u.id)}
                    className="text-xs text-red-400 hover:underline"
                  >
                    Revoke
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
