import { SocialPublishExternalReviewClient } from "@/components/review/SocialPublishExternalReviewClient";

type Props = { searchParams?: Promise<{ t?: string }> };

/**
 * External client review surface for governed social publishing (Part 39).
 * Share: `/review/social-publish?t=<opaque_token>` (token is also accepted in the on-page field if opened without query).
 */
export default async function ExternalSocialPublishReviewPage({ searchParams }: Props) {
  const sp = searchParams ? await searchParams : {};
  const t = typeof sp.t === "string" ? sp.t : "";
  return <SocialPublishExternalReviewClient initialToken={t} />;
}
