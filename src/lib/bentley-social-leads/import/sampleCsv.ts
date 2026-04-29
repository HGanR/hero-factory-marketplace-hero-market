/**
 * Deterministic sample CSV for operator download (public comment import template).
 */

export function generateBentleySliSampleCsv(): string {
  const header =
    "platform,authorHandle,commentText,sourceTitle,sourceUrl,sourceId,postId,parentId,publishedAt,verticalHint,authorDisplayName,likeCount,replyCount";
  const rows = [
    `tiktok,@plumber_mike,"Anyone know a CRM that actually works for small crews? Drowning in DMs.",Lead gen tips | TikTok,https://www.tiktok.com/@example/video/1,v1,p1,,2026-03-15T14:22:00Z,contractor,Mike R.,12,3`,
    `youtube,SmallBizSarah,"We need more booked calls — our site gets views but no form fills. What would you fix first?",Local SEO for service businesses,https://www.youtube.com/watch?v=abc123,yt-c1,p-yt-1,,2026-03-10T09:00:00Z,general_service_business,Sarah K.,45,18`,
    `reddit,throwaway_ops_92,"Is $3k/mo realistic for ads or am I getting ripped off? No systems — everything is in spreadsheets.",r/smallbusiness thread,https://reddit.com/r/smallbusiness/comments/xyz,rd-1,post-xyz,,2026-03-12T16:40:00Z,agency,,8,22`,
    `instagram,apex_fade_shop,"Booking is a mess — clients text at midnight. Need one link that just works.",Before/after fades | IG,https://www.instagram.com/p/ABC123/,ig-c1,ig-p1,,2026-03-14T11:05:00Z,barber,Apex Fade,120,6`,
    `facebook_public,janedoescleaning,"Looking for someone to redo our local pages — we show up on Maps but phone is dead silent.",Local service promo,https://www.facebook.com/groups/example/posts/1,fb-1,fb-p1,,2026-03-11T08:15:00Z,local_visibility_problem,Jane D.,4,1`,
    `youtube,RoofTeamDan,"Storm season — how do you prioritize leads when the phone never stops?",Roofing Q&A,https://www.youtube.com/watch?v=roof456,yt-c2,p-yt-2,,2026-03-09T19:30:00Z,contractor,Dan,210,44`,
    `reddit,marketing_throwaway,"Honest question: is cold email dead for B2B local? Our open rate tanked.",r/marketing,https://reddit.com/r/marketing/comments/abc,rd-2,post-abc,,2026-03-13T12:00:00Z,marketing_agency,,15,30`,
  ];
  return [header, ...rows].join("\n") + "\n";
}
