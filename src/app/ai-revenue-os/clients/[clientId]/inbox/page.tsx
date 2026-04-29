import { redirect } from "next/navigation";
import { getAuthedUserId } from "@/lib/api/auth";
import { ClientHubHeader } from "@/components/client-hub/ClientHubHeader";
import { ClientInboxClient } from "@/components/client-hub/ClientInboxClient";
import { ensureClientHubTables } from "@/lib/db/client-hub-ensure";
import { assertValidClientId, listInboxForClient } from "@/lib/revenue-os/client-hub-queries";

type PageProps = { params: Promise<{ clientId: string }> };

export default async function ClientHubInboxPage({ params }: PageProps) {
  await ensureClientHubTables();
  const userId = await getAuthedUserId();
  if (!userId) {
    redirect("/?returnTo=" + encodeURIComponent("/ai-revenue-os/clients"));
  }
  const { clientId } = await params;
  assertValidClientId(clientId);
  const inbox = await listInboxForClient(userId, clientId);

  return (
    <div className="space-y-4">
      <ClientHubHeader
        title="Smart inbox"
        description="crm_conversations for contacts with this client. Qualification and handoff tools below."
      />
      <ClientInboxClient clientId={clientId} initialInbox={inbox} />
    </div>
  );
}
