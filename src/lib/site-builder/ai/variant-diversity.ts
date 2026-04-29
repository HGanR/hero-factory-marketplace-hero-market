function homeBlocks(schema: unknown): Array<{ type?: string; content?: Record<string, unknown> }> {
  const doc = schema as { pages?: Array<{ slug?: string; blocks?: unknown[] }> } | null;
  const home = (Array.isArray(doc?.pages) ? doc?.pages : []).find((p) => p?.slug === "/") ?? doc?.pages?.[0];
  const blocks = Array.isArray(home?.blocks) ? home!.blocks : [];
  return blocks.filter(Boolean) as Array<{ type?: string; content?: Record<string, unknown> }>;
}

function registryKeys(schema: unknown): string[] {
  const keys: string[] = [];
  for (const b of homeBlocks(schema)) {
    const c = b.content ?? {};
    const rk = typeof c.aiRegistryKey === "string" ? c.aiRegistryKey.trim() : "";
    if (rk) keys.push(rk);
    else if (typeof b.type === "string") keys.push(`type:${b.type}`);
  }
  return keys;
}

function jaccardDistance(a: string[], b: string[]): number {
  const A = new Set(a);
  const B = new Set(b);
  if (!A.size && !B.size) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter += 1;
  const union = A.size + B.size - inter;
  if (union <= 0) return 0;
  return 1 - inter / union;
}

function heroSignature(schema: unknown): string {
  const firstHero = homeBlocks(schema).find((b) => b.type === "hero");
  const c = (firstHero?.content ?? {}) as Record<string, unknown>;
  const rk = typeof c.aiRegistryKey === "string" ? c.aiRegistryKey : "";
  const variant = typeof c.variant === "string" ? c.variant : "";
  return `${rk}|${variant}`;
}

function visualMetaSignature(schema: unknown): string {
  const m = (schema as { metadata?: { visualMeta?: Record<string, unknown> } })?.metadata?.visualMeta;
  if (!m || typeof m !== "object") return "";
  const g = typeof m.gradientStyle === "string" ? m.gradientStyle : "";
  const b = typeof m.backgroundStyle === "string" ? m.backgroundStyle : "";
  const l = typeof m.lightingStyle === "string" ? m.lightingStyle : "";
  const id = typeof m.layoutFamilyId === "string" ? m.layoutFamilyId : "";
  return `${id}|${g}|${b}|${l}`;
}

function heroVisualSurfaceKey(schema: unknown): string {
  const firstHero = homeBlocks(schema).find((b) => b.type === "hero");
  const c = (firstHero?.content ?? {}) as Record<string, unknown>;
  const vis = (c.visual ?? {}) as Record<string, unknown>;
  const anchor = typeof vis.anchor === "string" ? vis.anchor : "";
  const surface = typeof vis.heroSurface === "string" ? vis.heroSurface : "";
  return `${anchor}|${surface}`;
}

function heroGradientFingerprint(schema: unknown): string {
  const firstHero = homeBlocks(schema).find((b) => b.type === "hero");
  const c = (firstHero?.content ?? {}) as Record<string, unknown>;
  const vis = (c.visual ?? {}) as Record<string, unknown>;
  const g = typeof vis.gradient === "string" ? vis.gradient : "";
  return g.slice(0, 120);
}

function ctaPlacement(schema: unknown): number[] {
  const blocks = homeBlocks(schema);
  const out: number[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i]!;
    const c = b.content ?? {};
    const rk = typeof c.aiRegistryKey === "string" ? c.aiRegistryKey : "";
    if (rk.includes("cta") || b.type === "cta") out.push(i);
  }
  return out;
}

export function computeSectionOrderSignature(schema: unknown): string {
  return registryKeys(schema).join("|");
}

export function computeRegistryKeySignature(schema: unknown): string {
  const keys = Array.from(new Set(registryKeys(schema)));
  keys.sort();
  return keys.join("|");
}

export function computeVariantDiversityScore(primary: unknown, alternate: unknown): number {
  const pKeys = registryKeys(primary);
  const aKeys = registryKeys(alternate);

  const sectionOrderDiff = jaccardDistance(pKeys, aKeys);
  const registrySetDiff = jaccardDistance(Array.from(new Set(pKeys)), Array.from(new Set(aKeys)));

  const heroDiff = heroSignature(primary) === heroSignature(alternate) ? 0 : 1;

  const pCta = ctaPlacement(primary);
  const aCta = ctaPlacement(alternate);
  const ctaDiff = jaccardDistance(pCta.map(String), aCta.map(String));

  const pCount = pKeys.length;
  const aCount = aKeys.length;
  const countDiff = Math.min(1, Math.abs(pCount - aCount) / Math.max(1, Math.max(pCount, aCount)));

  const structureScore =
    sectionOrderDiff * 0.32 +
    registrySetDiff * 0.22 +
    heroDiff * 0.14 +
    ctaDiff * 0.14 +
    countDiff * 0.09;

  const vPri = visualMetaSignature(primary);
  const vAlt = visualMetaSignature(alternate);
  const visualPackDiff = vPri !== vAlt && (vPri.length > 0 || vAlt.length > 0) ? 1 : 0;
  const heroVisualDiff = heroVisualSurfaceKey(primary) !== heroVisualSurfaceKey(alternate) ? 1 : 0;
  const gradientDiff = heroGradientFingerprint(primary) !== heroGradientFingerprint(alternate) ? 1 : 0;

  const visualBoost = visualPackDiff * 0.1 + heroVisualDiff * 0.05 + gradientDiff * 0.06;

  const score = structureScore + visualBoost;

  return Math.max(0, Math.min(1, Number(score.toFixed(4))));
}

export function scoreVariantSetDiversity(schemas: unknown[]): number {
  if (schemas.length <= 1) return 1;
  const pairs: number[] = [];
  for (let i = 0; i < schemas.length; i++) {
    for (let j = i + 1; j < schemas.length; j++) {
      pairs.push(computeVariantDiversityScore(schemas[i], schemas[j]));
    }
  }
  if (!pairs.length) return 1;
  const avg = pairs.reduce((s, n) => s + n, 0) / pairs.length;
  return Math.max(0, Math.min(1, Number(avg.toFixed(4))));
}
