import { notFound, redirect } from "next/navigation";
import { getAuthedUserId } from "@/lib/api/auth";
import { ClientHubHeader } from "@/components/client-hub/ClientHubHeader";
import { ClientCommandCenterView } from "@/components/client-hub/ClientCommandCenterView";
import { ensureClientHubTables } from "@/lib/db/client-hub-ensure";
import { assertValidClientId } from "@/lib/revenue-os/client-hub-ownership";
import { getClientCommandCenterPayload } from "@/lib/revenue-os/client-command-center-data";

type PageProps = { params: Promise<{ clientId: string }> };

export default async function ClientCommandCenterPage({ params }: PageProps) {
  await ensureClientHubTables();
  const userId = await getAuthedUserId();
  if (!userId) {
    redirect("/?returnTo=" + encodeURIComponent("/ai-revenue-os/clients"));
  }
  const { clientId } = await params;
  try {
    assertValidClientId(clientId);
  } catch {
    notFound();
  }
  const payload = await getClientCommandCenterPayload(userId, clientId);
  if (!payload) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <ClientHubHeader
        title="Client Command Center"
        description="One place to read deployment health, jump into Site Builder, agents, portal, and inbox — all scoped to this client."
      />
      <ClientCommandCenterView data={payload} />
    </div>
  );
}
