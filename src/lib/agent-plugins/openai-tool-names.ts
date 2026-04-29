/**
 * OpenAI function names must match ^[a-zA-Z0-9_-]+$ — action keys use dots, so we map.
 * Only the first dot segment is replaced; action keys today use a single dot (e.g. calendar.freeBusy → calendar_freeBusy).
 */

export function actionKeyToOpenAiFunctionName(actionKey: string): string {
  return actionKey.replace(/\./g, "_");
}

/** Inverse of actionKeyToOpenAiFunctionName for runtime tool name → registry key. */
export function openAiFunctionNameToActionKey(functionName: string): string {
  return functionName.replace(/_/g, ".");
}
