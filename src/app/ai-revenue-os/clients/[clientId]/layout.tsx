import { notFound, redirect } from "next/navigation";
import { getAuthedUserId } from "@/lib/api/auth";
import { ClientHubShell } from "@/components/client-hub/ClientHubShell";
import { ensureClientHubTables } from "@/lib/db/client-hub-ensure";
import { assertValidClientId, getOwnedClientRow } from "@/lib/revenue-os/client-hub-queries";

export default async function ClientHubDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ clientId: string }>;
}) {
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
  const client = await getOwnedClientRow(userId, clientId);
  if (!client) {
    notFound();
  }
  return (
    <ClientHubShell clientId={client.id} clientName={client.name}>
      {children}
    </ClientHubShell>
  );
}
