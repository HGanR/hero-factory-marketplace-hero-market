import { notFound, redirect } from "next/navigation";
import { getAuthedUserId } from "@/lib/api/auth";
import { ensureAgentTables } from "@/lib/db/agents-ensure";
import { getAgentControlPanelPayload } from "@/lib/agents/agent-control-panel-data";
import { AgentControlPanelView } from "@/components/agents/AgentControlPanelView";

type PageProps = { params: Promise<{ id: string }> };

export default async function AgentControlPage({ params }: PageProps) {
  await ensureAgentTables();
  const userId = await getAuthedUserId();
  const { id: rawId } = await params;
  const agentId = rawId?.trim() ?? "";
  if (!userId) {
    redirect("/?returnTo=" + encodeURIComponent(`/app/agents/${encodeURIComponent(agentId)}/control`));
  }
  if (!agentId) {
    notFound();
  }
  const payload = await getAgentControlPanelPayload(userId, agentId);
  if (!payload) {
    notFound();
  }

  return (
    <div className="relative mx-auto max-w-4xl px-4 py-8">
      <AgentControlPanelView data={payload} />
    </div>
  );
}
