/**
 * Client-side helper for world wallet auth.
 * Use this to generate the message to sign (no viem import).
 */
export const WORLD_EDIT_MESSAGE_PREFIX = "Edit world ";
export const WORLD_EDIT_MESSAGE_SUFFIX = " at ";

/**
 * Generate the message the client should sign for world edit.
 * Must match server-side format in world-wallet-auth.ts
 */
export function getWorldEditMessage(worldId: string): string {
  const ts = Math.floor(Date.now() / 1000);
  return `${WORLD_EDIT_MESSAGE_PREFIX}${worldId}${WORLD_EDIT_MESSAGE_SUFFIX}${ts}`;
}
