import type { SocialProvider, SocialProviderKey } from "./types";
import { linkedinSocialProvider } from "./linkedin";
import { facebookSocialProvider } from "./facebook";
import { instagramSocialProvider } from "./instagram";

export type { SocialConnectionSummary, SocialProvider, SocialPublishInput, SocialPublishResult, SocialProviderKey } from "./types";

export function createSocialProvider(key: SocialProviderKey): SocialProvider | null {
  if (key === "linkedin") return linkedinSocialProvider;
  if (key === "facebook") return facebookSocialProvider;
  if (key === "instagram") return instagramSocialProvider;
  return null;
}
