import { getClientPortalSession } from "@/lib/client-portal/portal-session";

export default async function ClientPortalSettingsPage() {
  const s = await getClientPortalSession();
  if (!s) return null;
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-900">Settings</h1>
      <p className="text-sm text-slate-600">Account details for this portal (read-only in MVP).</p>
      <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-800">
        <p>
          <span className="text-slate-500">Your name</span> · {s.portalUser.name || "—"}
        </p>
        <p className="mt-1">
          <span className="text-slate-500">Email</span> · {s.portalUser.email}
        </p>
        <p className="mt-1">
          <span className="text-slate-500">Role</span> · {s.portalUser.role}
        </p>
        <p className="mt-1">
          <span className="text-slate-500">Organisation</span> · {s.client.name}
        </p>
      </div>
    </div>
  );
}
