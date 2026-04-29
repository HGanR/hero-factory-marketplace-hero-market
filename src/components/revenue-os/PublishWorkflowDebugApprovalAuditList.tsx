import type { PublishApprovalAuditRecentApiEvent } from "@/lib/revenue-os/publish-approval-audit";

type Props = {
  events: PublishApprovalAuditRecentApiEvent[];
  formatWhen: (iso: string) => string;
};

/**
 * Debug-only list for recent publish-approval audit rows (workflow review panel).
 */
export function PublishWorkflowDebugApprovalAuditList({ events, formatWhen }: Props) {
  if (!events.length) {
    return <div className="text-slate-500">recent approval audit: —</div>;
  }
  return (
    <div className="space-y-0.5">
      <div className="text-slate-500">recent approval audit ({events.length})</div>
      <ul className="list-none space-y-1 pl-0 m-0" data-testid="debug-approval-audit-list">
        {events.map((e) => {
          const actor =
            e.actorDisplayName ??
            (e.actorUserId != null ? `user #${e.actorUserId}` : null) ??
            "—";
          return (
            <li key={e.id} className="break-all text-slate-400" data-event-id={e.id}>
              <span className="text-slate-300">{e.action}</span>
              {" · "}
              postId={e.postId ?? "—"}
              {" · "}
              {e.platform ?? "—"}
              {" · "}
              {actor}
              {" · "}
              {formatWhen(e.createdAt)}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
