/**
 * Build `BentleyGenerationContext` from user notes + optional resolved handoff.
 */

import type { BentleyContentBundleHandoff } from "@/lib/bentley-social-leads/handoff/contentBundleHandoffTypes";
import type {
  BentleyGenerationContext,
  BentleyHandoffResolveSource,
} from "./bentley-generation-context";
import { toBentleyStructuredMarketIntelligence } from "./bentley-generation-context";
import { buildBentleyReadableNotesBlock } from "./mergeBentleyHandoffIntoGenerationInput";

export function buildBentleyGenerationContext(args: {
  userNotes: string;
  handoff: BentleyContentBundleHandoff | null;
  resolvedFrom: BentleyHandoffResolveSource;
}): BentleyGenerationContext {
  const userNotesOriginal = args.userNotes;
  if (!args.handoff) {
    return {
      userNotesOriginal,
      bentleyHandoff: null,
      resolvedFrom: "none",
      bentleyReadableNotesBlock: "",
      bentleyMarketIntelligence: null,
    };
  }
  const bentleyReadableNotesBlock = buildBentleyReadableNotesBlock(args.handoff);
  return {
    userNotesOriginal,
    bentleyHandoff: args.handoff,
    resolvedFrom: args.resolvedFrom,
    bentleyReadableNotesBlock,
    bentleyMarketIntelligence: toBentleyStructuredMarketIntelligence(args.handoff),
  };
}
