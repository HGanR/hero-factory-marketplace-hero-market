import "server-only";

import type { MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "@/lib/db/schema";
import { buildExecutiveAmbientSignalSnapshot } from "@/lib/executive-agent/executive-ambient-signal-engine";
import type { OperationalPresenceMode } from "@/lib/executive-agent/executive-ambient-signal-types";

type Db = MySql2Database<typeof schema>;

const ELEVATED_MODES = new Set<OperationalPresenceMode>([
  "elevated",
  "incident",
  "crisis",
  "strategic",
  "recovery",
]);

/** Append advisory ambient briefing to voice answers — never triggers autonomous action. */
export async function enrichVoiceAnswerWithAmbientAwareness(
  db: Db,
  adminUserId: number,
  answer: string,
  opts?: { force?: boolean; audit?: boolean },
): Promise<{ answer: string; ambientAppended: boolean; presenceMode: string | null }> {
  try {
    const snapshot = await buildExecutiveAmbientSignalSnapshot(db, adminUserId, {
      audit: opts?.audit ?? false,
    });
    const briefing = snapshot.overview.ambientVoiceBriefing;
    const mode = snapshot.overview.presenceMode;
    if (!briefing) {
      return { answer, ambientAppended: false, presenceMode: mode };
    }
    const shouldAppend = opts?.force || ELEVATED_MODES.has(mode);
    if (!shouldAppend) {
      return { answer, ambientAppended: false, presenceMode: mode };
    }
    if (answer.includes(briefing.slice(0, 40))) {
      return { answer, ambientAppended: false, presenceMode: mode };
    }
    return {
      answer: `${answer.trim()} ${briefing}`,
      ambientAppended: true,
      presenceMode: mode,
    };
  } catch {
    return { answer, ambientAppended: false, presenceMode: null };
  }
}
