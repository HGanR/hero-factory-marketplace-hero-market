import { getClientPortalSession } from "@/lib/client-portal/portal-session";
import { listClientPortalContacts } from "@/lib/client-portal/portal-data";

export default async function ClientPortalContactsPage() {
  const s = await getClientPortalSession();
  if (!s) return null;
  const rows = await listClientPortalContacts(s, 200);
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-900">Contacts</h1>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-3 py-3 text-slate-500">
                  No contacts
                </td>
              </tr>
            ) : (
              rows.map((c) => (
                <tr key={c.id} className="border-t border-slate-100">
                  <td className="px-3 py-2">
                    {[c.firstName, c.lastName].filter(Boolean).join(" ") || "—"}
                  </td>
                  <td className="px-3 py-2 text-slate-600">{c.email || "—"}</td>
                  <td className="px-3 py-2 text-slate-600">{c.status || "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
