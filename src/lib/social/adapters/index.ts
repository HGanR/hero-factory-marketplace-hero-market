/**
 * Platform adapters for social publishing.
 */
import type { SocialPlatform } from "../config";
export type { SocialPlatform };
import type { SocialAdapter } from "../types";
import { linkedinAdapter } from "./linkedin";
import { instagramAdapter } from "./instagram";
import { facebookAdapter } from "./facebook";

export const adapters: Record<SocialPlatform, SocialAdapter | null> = {
  linkedin: linkedinAdapter,
  instagram: instagramAdapter,
  facebook: facebookAdapter,
  tiktok: null, // TODO: implement TikTok Content Posting API adapter
  pinterest: null, // TODO: implement Pinterest Pins API adapter
  snapchat: null, // TODO: implement Snapchat Marketing API adapter
  x: null,
};

export function getAdapter(platform: SocialPlatform): SocialAdapter | null {
  return adapters[platform] ?? null;
}
