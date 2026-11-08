"use client";

/**
 * Host Event — Create a stadium event/meeting in Troo Town.
 * Requires auth. Creates a meeting node for stadium-elyseum.
 * After creation, user gets room link and invite URL to share.
 */
import { useState, useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";

export default function HostEventPage() {
  const [title, setTitle] = useState("");
  const [capacity, setCapacity] = useState(100);
  const [accessType, setAccessType] = useState<"public" | "private" | "invite_only">("public");
  const [webxrEnabled, setWebxrEnabled] = useState(true);
  const [vrEnabled, setVrEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ roomId: string; inviteUrl?: string } | null>(null);
  const [auth, setAuth] = useState<"checking" | "member" | "signin" | "error">("checking");
  const [attempt, setAttempt] = useState(0);
  const signIn = "/?returnTo=%2Ftroo-town%2Fhost-event";
  useEffect(() => {
    const controller = new AbortController();
    setAuth("checking");
    async function check() {
      try {
        const r = await fetch("/api/auth/me", { credentials: "include", cache: "no-store", signal: controller.signal });
        const data = await r.json().catch(() => null);
        if (controller.signal.aborted) return;
        if (r.ok && typeof data?.userId === "number") setAuth("member");
        else if (r.status === 401 || (r.status === 404 && data?.error === "User not found")) setAuth("signin");
        else setAuth("error");
      } catch {
        if (!controller.signal.aborted) setAuth("error");
      }
    }
    void check();
    return () => controller.abort();
  }, [attempt]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/troo-world/meeting-nodes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          worldId: "default",
          parentElementKey: "stadium-elyseum",
          title: title.trim() || "Stadium Event",
          accessType,
          capacity,
          webEnabled: true,
          webxrEnabled,
          vrEnabled,
          posX: 0,
          posY: 0,
          posZ: 0,
          rotY: 0,
          scale: 1,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errMsg = json.error ?? "Failed to create event";
        const detail = json.detail ? ` (${json.detail})` : "";
        setError(`${errMsg}${detail}`);
        setSaving(false);
        return;
      }
      const roomId = json.roomId ?? `default:${json.id}`;
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const directUrl = `${origin}/meet/${roomId}`;
      let inviteUrl = accessType==='public' ? directUrl : '';
      try {
        const invRes = await fetch(`/api/troo-world/meeting-nodes/${json.id}/invites`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ expiresInHours: 168 }),
        });
        const invData = await invRes.json().catch(() => ({}));
        if (invRes.ok && invData?.inviteUrl) inviteUrl = invData.inviteUrl;
      } catch {
        /* use direct URL */
      }
      setCreated({ roomId, inviteUrl });
      toast.success("Event created! Share the link to invite attendees.");
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  if (auth === "checking") {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-white">Checking authentication...</div>
      </div>
    );
  }

  if (auth !== "member") return (
    <main className="min-h-screen bg-slate-950 text-white p-8">
      <h1 className="text-2xl font-bold">Host Stadium Event</h1>
      {auth === "signin" ? <>
        <p className="my-4">Sign in with your website member account to host an event.</p>
        <Link className="text-cyan-300 underline" href={signIn}>Sign in and return to the stadium</Link>
      </> : <p role="alert" className="my-4">We could not check your session. Try again.</p>}
      <button className="block my-4 text-cyan-300" onClick={() => setAttempt(a => a + 1)}>Check session again</button>
      <Link href="/troo-town">Back to Troo Town</Link>
    </main>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans p-6">
      <div className="max-w-md mx-auto">
        <Link
          href="/troo-town"
          className="inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300 mb-8"
        >
          ← Back to Troo Town
        </Link>

        <h1 className="text-2xl font-bold mb-2">Host Stadium Event</h1>
        <p className="text-slate-400 mb-8">
          Create a live event in Stadium Elyseum. Share the link so attendees can join via video.
        </p>

        {created ? (
          <div className="bg-slate-800/50 rounded-xl p-6 border border-cyan-500/30 space-y-4">
            <h2 className="text-lg font-semibold text-cyan-400">Event created</h2>
            <p className="text-slate-300 text-sm">Share this link so people can join:</p>
            <div className="flex gap-2">
              <input
                readOnly
                placeholder="Invitation unavailable — do not share the host link"
                value={created.inviteUrl ?? `${typeof window !== "undefined" ? window.location.origin : ""}/meet/${created.roomId}`}
                className="flex-1 px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-sm text-slate-200"
              />
              <button
                disabled={!created.inviteUrl}
                onClick={() => {
                  navigator.clipboard?.writeText(created.inviteUrl ?? `${window.location.origin}/meet/${created.roomId}`);
                  toast.success("Link copied");
                }}
                className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-sm"
              >
                Copy
              </button>
            </div>
            <Link
              href={`/meet/${created.roomId}`}
              className="inline-block px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-sm"
            >
              Enter Event →
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Event title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Product Launch, Team All-Hands"
                className="w-full px-4 py-3 rounded-lg bg-slate-800 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Capacity (max 500)</label>
              <input
                type="number"
                min={12}
                max={500}
                value={capacity}
                onChange={(e) => setCapacity(parseInt(e.target.value, 10) || 100)}
                className="w-full px-4 py-3 rounded-lg bg-slate-800 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Avatar & XR</label>
              <p className="text-slate-500 text-xs mb-3">
                Avatar mode works now. WebXR/VR flags are stored for Oculus and future immersive clients.
              </p>
              <div className="flex gap-6">
                <label className="flex items-center gap-2 text-slate-300 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={webxrEnabled}
                    onChange={(e) => setWebxrEnabled(e.target.checked)}
                    className="rounded border-slate-600 bg-slate-800 text-cyan-500 focus:ring-cyan-500"
                  />
                  WebXR
                </label>
                <label className="flex items-center gap-2 text-slate-300 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={vrEnabled}
                    onChange={(e) => setVrEnabled(e.target.checked)}
                    className="rounded border-slate-600 bg-slate-800 text-cyan-500 focus:ring-cyan-500"
                  />
                  VR (Oculus)
                </label>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Access</label>
              <select
                value={accessType}
                onChange={(e) => setAccessType(e.target.value as "public" | "private" | "invite_only")}
                className="w-full px-4 py-3 rounded-lg bg-slate-800 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                <option value="public">Public — anyone with link can join</option>
                <option value="invite_only">Invite only — requires invite token</option>
                <option value="private">Private</option>
              </select>
            </div>
            {error && (
              <div className="p-3 rounded-lg bg-red-900/30 border border-red-500/50 text-red-300 text-sm">
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={saving}
              className="w-full py-3 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold"
            >
              {saving ? "Creating..." : "Create Event"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
