/**
 * Maps 3D world characters (workers, avatars) to admin panel NPCs.
 * Admin configures NPCs at /admin/npc — AI chat uses these.
 */

/** Nexus Tower workers map by role to NPCs. Admin can create more at /admin/npc */
export function getNpcIdForNexusWorker(workerId: string, role: string): string {
  const r = role.toLowerCase();
  if (r.includes("receptionist")) return "nexus-tower-receptionist";
  if (r.includes("security") || r.includes("guard")) return "nexus-tower-guide";
  return "nexus-tower-guide"; // default: guide for all staff
}

/** Meridian Tower avatars map directly by id */
export function getNpcIdForMeridianAvatar(avatarId: string): string | null {
  if (avatarId === "maya") return "meridian-maya-chen";
  if (avatarId === "alex") return "meridian-alex-rivera";
  return null;
}

/** Apex Tower workers map to individual NPCs. Admin edits each at /admin/npc. */
const APEX_WORKER_TO_NPC: Record<string, string> = {
  apex_apex_worker_0: "apex-victoria-lane",
  apex_apex_worker_1: "apex-marcus-webb",
  apex_apex_worker_2: "apex-katherine-voss",
  apex_apex_worker_3: "apex-samuel-drake",
  apex_apex_worker_4: "apex-theodore-banks",
  apex_apex_worker_5: "apex-sophia-mercer",
  apex_apex_worker_6: "apex-amelia-stone",
  apex_apex_worker_7: "apex-henry-blake",
  apex_apex_worker_8: "apex-alexander-apex",
  apex_apex_worker_9: "apex-diana-sterling",
  apex_apex_worker_10: "apex-jordan-pierce",
  apex_apex_worker_11: "apex-naomi-okafor",
  apex_apex_worker_12: "apex-maxwell-crane",
  apex_apex_worker_13: "apex-vivienne-hart",
};

export function getNpcIdForApexWorker(workerId: string, _role: string): string {
  return APEX_WORKER_TO_NPC[workerId] ?? "apex-victoria-lane"; // fallback to concierge
}
