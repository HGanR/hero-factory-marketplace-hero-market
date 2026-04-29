import { BuilderActionSchema, type BuilderAction } from "@/lib/site-builder/builder-actions/action-schemas";
import { z } from "zod";

const CODE_FENCE = /```(?:json)?\s*([\s\S]*?)```/i;

const ActionsWrapperSchema = z.object({
  actions: z.array(BuilderActionSchema).min(1).max(48),
});
const SingleActionListSchema = z.array(BuilderActionSchema).min(1).max(48);

/**
 * Extract `{ "actions": [...] }` or a JSON array of actions from chat / assistant text.
 */
export function tryExtractBuilderActionsFromMessage(text: string): BuilderAction[] | null {
  const t = text.trim();
  if (!t) return null;
  const candidates = [t, t.match(CODE_FENCE)?.[1]?.trim() ?? ""].filter(Boolean);
  for (const raw of candidates) {
    try {
      const parsed: unknown = JSON.parse(raw!);
      const w = ActionsWrapperSchema.safeParse(parsed);
      if (w.success) return w.data.actions;
      const a = SingleActionListSchema.safeParse(parsed);
      if (a.success) return a.data;
    } catch {
      /* try next */
    }
  }
  return null;
}
