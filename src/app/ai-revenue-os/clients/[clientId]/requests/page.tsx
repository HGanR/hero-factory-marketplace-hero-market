import { ClientRequestsOperatorPanel } from "@/components/client-hub/ClientRequestsOperatorPanel";

type Props = { params: Promise<{ clientId: string }> };

export default async function ClientRequestsPage({ params }: Props) {
  const { clientId } = await params;
  return (
    <div>
      <h1 className="text-lg font-semibold text-cyan-100">Client requests</h1>
      <p className="text-sm text-slate-400">Review and process portal-submitted requests.</p>
      <div className="mt-4">
        <ClientRequestsOperatorPanel clientId={clientId} />
      </div>
    </div>
  );
}
