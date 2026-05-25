"use client";

import { landingCtaMetadata, LANDING_HOME_SITE_EVENTS } from "@/lib/analytics/landing-site-event-metadata";
import { trackSiteEvent } from "@/lib/analytics/site-analytics-client";

/**
 * Promotional clip served from `/JointheCommunity.mp4` (see `public/JointheCommunity.mp4`).
 */
export function LandingCommunityVideo() {
  return (
    <section
      className="relative z-10 mx-auto w-full max-w-4xl px-4 py-10 sm:py-14"
      aria-labelledby="landing-community-video-heading"
    >
      <div
        className="overflow-hidden rounded-2xl border border-cyan-400/40 bg-black/50 shadow-[0_0_32px_rgba(0,209,255,0.12)] backdrop-blur-sm"
        style={{
          boxShadow:
            "0 0 24px rgba(0, 212, 255, 0.2), inset 0 0 40px rgba(0, 212, 255, 0.04)",
        }}
      >
        <div className="border-b border-white/10 px-5 py-4 sm:px-6">
          <h2
            id="landing-community-video-heading"
            className="text-lg font-bold tracking-tight text-white sm:text-xl"
          >
            Join the community
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Watch a quick intro — then connect through Welcome → Join Community.
          </p>
        </div>
        <div className="p-3 sm:p-4">
          <video
            className="mx-auto aspect-video w-full max-h-[min(70vh,520px)] rounded-lg bg-black object-contain"
            controls
            playsInline
            preload="metadata"
            onPlay={() =>
              void trackSiteEvent({
                path: "/",
                eventType: "agent_interaction",
                metadata: {
                  ...landingCtaMetadata({
                    eventName: LANDING_HOME_SITE_EVENTS.COMMUNITY_VIDEO_PLAY,
                    source: "landing_community_video",
                    route: "/",
                    label: "Join the community video play",
                    targetHref: "/JointheCommunity.mp4",
                  }),
                },
              })
            }
          >
            <source src="/JointheCommunity.mp4" type="video/mp4" />
            Your browser does not support embedded video.{" "}
            <a
              href="/JointheCommunity.mp4"
              className="text-cyan-400 underline"
              download
              onClick={() =>
                void trackSiteEvent({
                  path: "/",
                  eventType: "button_click",
                  metadata: {
                    ...landingCtaMetadata({
                      eventName: LANDING_HOME_SITE_EVENTS.COMMUNITY_VIDEO_DOWNLOAD,
                      source: "landing_community_video",
                      route: "/",
                      label: "Download community clip",
                      targetHref: "/JointheCommunity.mp4",
                    }),
                  },
                })
              }
            >
              Download the clip
            </a>
            .
          </video>
        </div>
      </div>
    </section>
  );
}
