import type { TrendCard, TrendPacket, ContentBundle } from "./schema";
import { FORMAT_RULES } from "./patterns";
import type { BentleyStructuredMarketIntelligence } from "@/lib/revenue-os/bentley-generation-context";
import type { ConversionIntelligenceSnapshot } from "@/lib/revenue-os/unified-generation-types";

function inferPacket(card: TrendCard, offer: string): TrendPacket {
  const text = [card.title, card.description, card.summary, card.whyTrending]
    .filter(Boolean)
    .join(" ");
  const rule = FORMAT_RULES.find((r) => r.match.test(text)) ?? {
    format: "how_to" as const,
    hookType: "curiosity" as const,
  };

  const targetPersona = text.toLowerCase().includes("small business")
    ? "small business owners"
    : text.toLowerCase().includes("creator")
      ? "small content creators"
      : "beginner consultants";

  const objections =
    rule.format === "worth_it_debate"
      ? ["cost", "skepticism", "time to results"]
      : ["no experience", "time", "complexity"];

  const keywords = Array.from(
    new Set([...(card.tags ?? []), ...tokenize(card.title)])
  ).slice(0, 14);

  const promise =
    rule.format === "how_to"
      ? `Get your first repeatable client-acquisition system without prior expertise using ${offer}.`
      : rule.format === "mistakes"
        ? `Avoid the top mistakes that keep beginners stuck and shorten time-to-results using ${offer}.`
        : `Faster path to results using ${offer}.`;

  return {
    platform: card.platform,
    format: rule.format,
    hookType: rule.hookType,
    targetPersona,
    promise,
    objections,
    keywords,
  };
}

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter(
      (w) =>
        w.length >= 4 &&
        !["what", "best", "your", "with", "this", "that", "from"].includes(w)
    );
}

function hashtagMix(keywords: string[]): string[] {
  const base = [
    "business",
    "consulting",
    "smallbusiness",
    "entrepreneur",
    "marketing",
    "sales",
    "creator",
    "contentcreator",
    "clientacquisition",
    "businesstips",
  ];
  const kws = keywords.map((k) => k.replace(/\s+/g, "")).slice(0, 8);
  return Array.from(new Set([...base, ...kws]))
    .slice(0, 15)
    .map((h) => `#${h}`);
}

function buildSoraPrompt(input: {
  durationSec: number;
  style: string;
  scenes: string[];
  voiceoverScript: string;
  onScreenText: string[];
}): string {
  return `
VIDEO SPECS:
- Duration: ${input.durationSec}s
- Aspect ratio: 9:16 vertical
- Style: ${input.style}
- Editing: fast cuts, kinetic captions, high retention pacing, no copyrighted logos

SCENES:
${input.scenes.map((s, i) => `${i + 1}. ${s}`).join("\n")}

VOICEOVER (exact):
${input.voiceoverScript}

ON-SCREEN TEXT (use as captions/headlines):
${input.onScreenText.map((t) => `- ${t}`).join("\n")}

AUDIO:
- Confident, clear voice; subtle background beat; duck music under speech.
`.trim();
}

function buildHedraPrompt(input: {
  durationSec: number;
  voiceoverScript: string;
  onScreenText: string[];
  scenes: string[];
}): string {
  return `
Create a ${input.durationSec}s vertical UGC-style video with a confident narrator.
Use fast pacing and bold captions synced to speech.

SCRIPT:
${input.voiceoverScript}

CAPTIONS:
${input.onScreenText.map((t) => `- ${t}`).join("\n")}

SHOT NOTES:
${input.scenes.map((s, i) => `${i + 1}. ${s}`).join("\n")}

END FRAME:
Text: "Comment 'OS' for the template"
`.trim();
}

/**
 * Build a content bundle from trend cards — deterministic, no LLM.
 * Extracts Trend Signal Packets and produces Sora/Hedra prompts, scripts, captions.
 */
export function buildBundleFromTrends(args: {
  trends: TrendCard[];
  offerName: string;
  platform: "tiktok" | "youtube_shorts" | "youtube_long";
  durationSec: number;
  voice?: "authoritative" | "friendly" | "aggressive";
  /** Optional Bentley SLI handoff intelligence — biases hooks/CTA/objections when present. */
  bentleyMarketIntelligence?: BentleyStructuredMarketIntelligence | null;
  /** Optional conversion snapshot — biases CTA/hooks toward proven performers when present. */
  conversionIntelligence?: ConversionIntelligenceSnapshot | null;
}): ContentBundle {
  const top = args.trends[0];
  if (!top) throw new Error("No trend cards provided.");

  const packet = inferPacket(top, args.offerName);
  const mi = args.bentleyMarketIntelligence ?? null;
  const ci = args.conversionIntelligence ?? null;

  const bentleyHook = mi?.hooks?.[0]?.trim();
  const bentleyCta = mi?.ctaAngles?.[0]?.trim();
  const bentleyNext = mi?.whatToPostNext?.[0]?.trim();
  const objectionHint = mi?.objections?.[0]?.text?.trim();

  const convPain = ci?.topPerforming?.painThemes?.[0]?.trim();
  const convCta = ci?.topPerforming?.ctaAngles?.[0]?.trim();

  const defaultPacketHook =
    packet.hookType === "pov"
      ? `POV: You're a ${packet.targetPersona} and you're done guessing.`
      : packet.hookType === "fear_avoidance"
        ? `Stop doing this if you want results in scaling + consulting.`
        : packet.hookType === "contrarian"
          ? `Hot take: "Scaling + consulting" isn't the hard part. The structure is.`
          : `Here's the fastest beginner roadmap to results (no expertise required).`;

  const hookLine =
    bentleyHook && bentleyHook.length > 0
      ? convPain
        ? `${convPain} — ${bentleyHook}`
        : bentleyHook
      : convPain && convPain.length > 0
        ? `${convPain} — ${defaultPacketHook}`
        : defaultPacketHook;

  const steps =
    packet.format === "mistakes"
      ? [
          "Mistake #1: Selling services with no offer math",
          "Mistake #2: No traffic loop",
          "Mistake #3: No conversion script",
          "Fix: Revenue = Traffic × Conversion × AOV",
        ]
      : packet.format === "tools_stack"
        ? [
            "Capture leads → simple form",
            "Qualify → readiness questions",
            "Deploy → campaign launcher",
            "Optimize → track conversion & AOV",
          ]
        : packet.format === "hacks"
          ? [
              "Pick 1 niche pain",
              "Write 1 irresistible offer",
              "Launch 1 simple campaign today",
            ]
          : [
              "Pick a measurable outcome",
              "Build the traffic loop",
              "Use a conversion script",
              "Increase AOV with packages",
            ];

  const voiceoverScript = [
    hookLine,
    mi?.marketSummary ? `Market signal: ${mi.marketSummary.slice(0, 280)}` : null,
    packet.promise,
    `Here's the play:`,
    ...steps,
    bentleyNext ? `Next move to emphasize: ${bentleyNext}` : null,
    objectionHint ? `Address this objection: ${objectionHint}` : null,
    `If you want the template, comment "OS" and I'll send it.`,
  ]
    .filter(Boolean)
    .join("\n");

  const scenes = [
    "Scene 1: Talking-head UGC in modern dark office, bold captions synced to hook.",
    "Scene 2: Quick b-roll of dashboard / charts / checklist overlay (no brand conflicts).",
    "Scene 3: Steps appear as big kinetic text cards, fast cuts every 1–2 seconds.",
    "Scene 4: Close-up emphasis + CTA text: \"Comment 'OS' for the template.\"",
  ];

  const onScreenText = [
    hookLine,
    "Revenue = Traffic × Conversion × AOV",
    ...steps.slice(0, 3),
    'Comment "OS" for the template',
  ];

  const ctaLine = convCta && convCta.length > 0 ? convCta : bentleyCta;

  const caption =
    `${hookLine}\n` +
    `If you're a ${packet.targetPersona}, use structure—not guesswork.\n` +
    (ctaLine ? `${ctaLine}\n` : "") +
    `Comment "OS" and I'll send the checklist.\n`;

  const hashtags = hashtagMix(packet.keywords);

  const soraPrompt = buildSoraPrompt({
    durationSec: args.durationSec,
    style:
      "UGC vertical, high-retention edits, bold captions, clean modern dark aesthetic",
    scenes,
    voiceoverScript,
    onScreenText,
  });

  const hedraPrompt = buildHedraPrompt({
    durationSec: args.durationSec,
    voiceoverScript,
    onScreenText,
    scenes,
  });

  return {
    platform: args.platform,
    durationSec: args.durationSec,
    soraPrompt,
    hedraPrompt,
    voiceoverScript,
    onScreenText,
    scenes,
    caption,
    hashtags,
    cta:
      convCta && convCta.length > 0
        ? convCta
        : bentleyCta && bentleyCta.length > 0
          ? bentleyCta
          : `Comment "OS" for the template.`,
  };
}
