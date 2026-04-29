/**
 * Routes public profile fetches by hostname — extend per platform without changing callers.
 */

export type RoutedSocialPlatform =
  | "instagram"
  | "tiktok"
  | "youtube"
  | "reddit"
  | "generic";

export function detectSocialPlatform(profileUrl: string): RoutedSocialPlatform {
  let host = "";
  try {
    host = new URL(profileUrl.trim().startsWith("http") ? profileUrl.trim() : `https://${profileUrl.trim()}`)
      .hostname.toLowerCase();
  } catch {
    return "generic";
  }

  if (host.includes("instagram.")) return "instagram";
  if (host.includes("tiktok.")) return "tiktok";
  if (host.includes("youtube.") || host === "youtu.be" || host.endsWith(".youtube.com")) return "youtube";
  if (host.includes("reddit.")) return "reddit";
  return "generic";
}
