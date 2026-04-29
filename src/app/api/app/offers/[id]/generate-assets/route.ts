import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import crypto from "crypto";
import { getDb } from "@/lib/db";
import { requireUserId } from "@/lib/auth";
import { ensureOfferTables } from "@/lib/db/offers-ensure";
import { invokeNpcLlm } from "@/lib/npc/llm";
import { offerAssets, offers } from "@/lib/db/schema";

type Params = { params: Promise<{ id: string }> };

function buildOfferContext(o: Record<string, unknown>): string {
  const parts: string[] = [];
  if (o.name) parts.push(`Name: ${o.name}`);
  if (o.priceRange) parts.push(`Price range: ${o.priceRange}`);
  if (o.promise) parts.push(`Promise: ${o.promise}`);
  if (o.icp) parts.push(`Ideal client: ${o.icp}`);
  if (o.deliverables) parts.push(`Deliverables: ${o.deliverables}`);
  if (o.guarantee) parts.push(`Guarantee: ${o.guarantee}`);
  if (o.riskReversal) parts.push(`Risk reversal: ${o.riskReversal}`);
  if (o.positioning) parts.push(`Positioning: ${o.positioning}`);
  if (o.proof) parts.push(`Proof: ${o.proof}`);
  if (o.objections) parts.push(`Objections to address: ${o.objections}`);
  return parts.join("\n");
}

function mockVslScript(offer: Record<string, unknown>): string {
  return `[VSL Script – ${offer.name}]\n\nHook (0-10 sec): Did you know that ${(offer.icp as string) || "your ideal client"} struggles with ${(offer.promise as string) || "X"}?\n\nProblem agitate (30 sec): ...\n\nPromise (20 sec): In this program you get ${(offer.deliverables as string) || "..."}\n\nProof (40 sec): ${(offer.proof as string) || "..."}\n\nGuarantee (15 sec): ${(offer.guarantee as string) || "..."}\n\nCTA: Apply now at [URL]`;
}

function mockLandingCopy(offer: Record<string, unknown>): string {
  return `# ${offer.name}\n\n## ${offer.promise}\n\n**Ideal for:** ${offer.icp}\n\n## What's included:\n${(offer.deliverables as string) || "- TBD"}\n\n## Guarantee\n${offer.guarantee || "Satisfaction guaranteed."}\n\n[Book a Call]`;
}

function mockAdAngles(offer: Record<string, unknown>): string {
  return `1. Problem-aware: "Struggling with ${(offer.promise as string)?.slice(0, 50) || "X"}?"\n2. Outcome: "Get ${(offer.deliverables as string)?.slice(0, 50) || "results"} in 90 days"\n3. Proof: "${(offer.proof as string)?.slice(0, 80) || "..."}"\n4. Risk reversal: "${(offer.guarantee as string)?.slice(0, 80) || "..."}"`;
}

function mockEmailSeq(offer: Record<string, unknown>): string {
  return `Email 1 (Day 0): Introduce the problem - ${(offer.promise as string)?.slice(0, 100) || "..."}\nEmail 2 (Day 2): Share proof - ${(offer.proof as string)?.slice(0, 80) || "..."}\nEmail 3 (Day 4): Overcome objection - ${(offer.objections as string)?.slice(0, 80) || "..."}\nEmail 4 (Day 6): Soft CTA - Book a call\nEmail 5 (Day 8): Urgency + CTA`;
}

function mockCallScript(offer: Record<string, unknown>): string {
  return `[Discovery Call Script]\n\n1. Rapport (2 min)\n2. "What brought you here today?" (5 min)\n3. "What have you tried?" (3 min)\n4. "If we could ${(offer.promise as string)?.slice(0, 60) || "solve this"}, what would that mean?" (5 min)\n5. Present offer: ${offer.name} - ${offer.priceRange}\n6. Handle objections: ${(offer.objections as string)?.slice(0, 100) || "..."}\n7. Close: "Ready to get started?"`;
}

/** Generate offer assets (VSL, landing, ads, email seq, call script) via LLM or templates. */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const userId = requireUserId(req);
    const { id } = await params;
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const db = await getDb();
    await ensureOfferTables();

    const [offer] = await db.select().from(offers).where(and(eq(offers.id, id), eq(offers.userId, userId)));
    if (!offer) return NextResponse.json({ error: "Offer not found" }, { status: 404 });

    const o = offer as Record<string, unknown>;
    const ctx = buildOfferContext(o);

    let vslScript: string;
    let landingCopy: string;
    let adAngles: string;
    let emailSeq: string;
    let callScript: string;

    const hasLlm = !!process.env.NPC_LLM_ENDPOINT;
    if (hasLlm) {
      const [vsl, land, ads, email, call] = await Promise.all([
        invokeNpcLlm([
          { role: "system", content: "You are an expert VSL copywriter. Output only the script, no preamble." },
          { role: "user", content: `Write a 60-90 second VSL script for this offer:\n\n${ctx}` },
        ]),
        invokeNpcLlm([
          { role: "system", content: "You are a landing page copywriter. Output markdown, no preamble." },
          { role: "user", content: `Write landing page copy (headline, subhead, bullets, CTA) for:\n\n${ctx}` },
        ]),
        invokeNpcLlm([
          { role: "system", content: "You write ad angles for Meta/Google. Output 4-5 angles, one per line." },
          { role: "user", content: `Write 4 ad angles for:\n\n${ctx}` },
        ]),
        invokeNpcLlm([
          { role: "system", content: "You write email sequences. Output 5 emails with subject + body outline." },
          { role: "user", content: `Write a 5-email nurture sequence for:\n\n${ctx}` },
        ]),
        invokeNpcLlm([
          { role: "system", content: "You write discovery call scripts. Output the script only." },
          { role: "user", content: `Write a discovery/sales call script for:\n\n${ctx}` },
        ]),
      ]);
      vslScript = vsl || mockVslScript(o);
      landingCopy = land || mockLandingCopy(o);
      adAngles = ads || mockAdAngles(o);
      emailSeq = email || mockEmailSeq(o);
      callScript = call || mockCallScript(o);
    } else {
      vslScript = mockVslScript(o);
      landingCopy = mockLandingCopy(o);
      adAngles = mockAdAngles(o);
      emailSeq = mockEmailSeq(o);
      callScript = mockCallScript(o);
    }

    const latestRows = await db.select().from(offerAssets).where(eq(offerAssets.offerId, id)).orderBy(desc(offerAssets.version)).limit(1);
    const latest = latestRows[0];
    const nextVersion = latest ? (latest.version ?? 1) + 1 : 1;
    const assetId = crypto.randomUUID();

    await db.insert(offerAssets).values({
      id: assetId,
      offerId: id,
      vslScript,
      landingCopy,
      adAngles,
      emailSeq,
      callScript,
      version: nextVersion,
    });

    const [inserted] = await db.select().from(offerAssets).where(eq(offerAssets.id, assetId));
    return NextResponse.json({ assets: inserted ?? { vslScript, landingCopy, adAngles, emailSeq, callScript, version: nextVersion } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    if (msg === "Unauthorized") return NextResponse.json({ error: msg }, { status: 401 });
    console.error("generate-assets POST error:", err);
    return NextResponse.json({ error: "Failed to generate assets" }, { status: 500 });
  }
}
