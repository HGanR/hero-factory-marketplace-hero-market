import { ClientPortalOperatorPanel } from "@/components/client-hub/ClientPortalOperatorPanel";

type Props = { params: Promise<{ clientId: string }> };

export default async function ClientPortalOperatorPage({ params }: Props) {
  const { clientId } = await params;
  return (
    <div>
      <h1 className="text-lg font-semibold text-cyan-100">Client portal</h1>
      <p className="text-sm text-slate-400">Manage invites and who can see this client’s portal.</p>
      <div className="mt-4">
        <ClientPortalOperatorPanel clientId={clientId} />
      </div>
    </div>
  );
}
