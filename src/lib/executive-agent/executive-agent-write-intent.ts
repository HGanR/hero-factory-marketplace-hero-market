/**
 * Regex-based write intent for executive chat (deterministic path). No DB / approvals here.
 */

export function detectWriteIntent(
  prompt: string,
  selectedClientId?: string | null,
): { action: string; payload: Record<string, unknown> } | null {
  const p = prompt.toLowerCase();
  if (/create\s+(a\s+)?todo|internal note|add note|remind me to/.test(p)) {
    return {
      action: "createTodo",
      payload: {
        clientId: selectedClientId ?? "",
        note: prompt.trim(),
      },
    };
  }
  if (/assign follow|follow-up task/.test(p)) {
    return { action: "assignFollowUp", payload: { clientId: selectedClientId ?? "", instructions: prompt.trim() } };
  }
  if (/create.*(specialized )?agent|sales follow-up agent|onboarding agent/.test(p)) {
    return {
      action: "createSpecializedAgent",
      payload: { templateKey: "sales_follow_up", clientId: selectedClientId ?? "" },
    };
  }
  if (/update client|change client status/.test(p)) {
    return { action: "updateClientStatus", payload: { clientId: selectedClientId ?? "", hint: prompt.trim() } };
  }
  if (/bentley analysis|run bentley/.test(p)) return { action: "triggerBentleyAnalysis", payload: {} };
  if (/campaign sync|sync launch/.test(p)) return { action: "triggerCampaignSync", payload: {} };
  if (/site builder task/.test(p)) return { action: "createSiteBuilderTask", payload: {} };
  return null;
}
