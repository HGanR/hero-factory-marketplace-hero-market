import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthedUserId } from "@/lib/api/auth";
import { ClientHubHeader } from "@/components/client-hub/ClientHubHeader";
import { ClientHubCampaignsClient } from "@/components/client-hub/ClientHubCampaignsClient";
import { ensureClientHubTables } from "@/lib/db/client-hub-ensure";
import { listCampaignsForClientHub } from "@/lib/revenue-os/client-hub-campaigns-adapter";
import { assertValidClientId } from "@/lib/revenue-os/client-hub-queries";

type PageProps = { params: Promise<{ clientId: string }> };

export default async function ClientHubCampaignsPage({ params }: PageProps) {
  await ensureClientHubTables();
  const userId = await getAuthedUserId();
  if (!userId) {
    redirect("/?returnTo=" + encodeURIComponent("/ai-revenue-os/clients"));
  }
  const { clientId } = await params;
  assertValidClientId(clientId);
  const { items, adapterNote } = await listCampaignsForClientHub(userId, clientId);

  return (
    <div className="space-y-4">
      <ClientHubHeader
        title="Campaigns & social"
        description="Organic campaigns and posts for this client id. Legacy campaigns without a client id stay in the main dashboard list."
      />
      {adapterNote ? <p className="text-sm text-amber-200/90">{adapterNote}</p> : null}
      <p className="text-xs text-slate-500">
        <Link href="/revenue-os/dashboard" className="text-cyan-400 hover:underline">
          Main campaign dashboard
        </Link>{" "}
        for the full user scope.
      </p>
      <ClientHubCampaignsClient clientId={clientId} initialItems={items} />
    </div>
  );
}
