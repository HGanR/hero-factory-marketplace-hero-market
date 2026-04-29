import crypto from "crypto";
import { designSystemToCssRootBlock, ensureDesignSystemOnDocument } from "@/lib/site-builder/design-system";
import type { SiteSchemaDocumentType } from "@/lib/site-builder/schema";
import {
  buildCinematicBackgroundFromVisualMeta,
  buildSectionWrap,
  heroCinematicStackCss,
  staticMotionClassFromBlock,
  themeSpacingForVisualMeta,
} from "@/lib/site-builder/cinematic-static-export";
import { buildAgencyWidgetSnippetHtml } from "@/lib/site-builder/site-builder-widget-embed";
import { buildPaymentIntegrationHtml } from "@/lib/site-builder/site-builder-payment-embed";

type GeneratedFile = {
  path: string;
  contentType: string;
  content: string;
  bytes: number;
  sha256: string;
};

function sha256Hex(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function escapeHtml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** When `visual.ds.accent` binds to the design system, static export uses CSS variables (see :root in site.css). */
function resolveExportAccent(
  schema: SiteSchemaDocumentType | undefined,
  visual: Record<string, unknown>,
  fallback: string,
): string {
  const bind = visual.ds as Record<string, string> | undefined;
  if (schema?.metadata?.designSystem && bind?.accent === "colors.accent") {
    return `var(--ds-color-accent, ${fallback})`;
  }
  return String(visual.accent || visual.ringAccent || fallback);
}

function thzShellClass(content: unknown): string {
  const tone = (content as { visualEngine?: { sectionTone?: string } } | null)?.visualEngine?.sectionTone;
  if (tone === "light" || tone === "dark" || tone === "visual") return `thz-sec thz-tone-${tone}`;
  return "";
}

function hasAnchorFeature(visual: Record<string, unknown>, hd: Record<string, unknown> | undefined, key: string): boolean {
  const a = Array.isArray(visual.anchorFeatures) ? (visual.anchorFeatures as string[]) : [];
  const b = Array.isArray(hd?.anchorFeatures) ? (hd.anchorFeatures as string[]) : [];
  return new Set([...a, ...b]).has(key);
}

/** Pseudo-3D far / mid planes from `content.visual.heroDepth` (static CSS drift). */
function renderHeroPseudoDepthLayers(visual: Record<string, unknown>, accent: string): string {
  const hd = visual.heroDepth as Record<string, unknown> | undefined;
  const planes = hd?.planes as Record<string, unknown> | undefined;
  if (!planes?.far) return "";
  const f = planes.far as Record<string, unknown>;
  const mid = planes.mid as Record<string, unknown> | undefined;
  const anchor = String(visual.anchor || "");
  const fm = (key: string) => hasAnchorFeature(visual, hd, key);
  let html = "";
  const showFar =
    fm("mesh_back") ||
    fm("far_glow") ||
    anchor === "neural" ||
    anchor === "holographic" ||
    anchor === "signal";
  if (showFar && f.background) {
    const bg = escapeHtml(String(f.background));
    const blur = escapeHtml(String(f.blur || "40px"));
    const op = Number(f.opacity ?? 0.4);
    html += `<div class="thz-hero-far-wrap" style="pointer-events:none;position:absolute;inset:-22px;z-index:1;border-radius:16px;overflow:visible"><div class="thz-hero-far-drift" style="width:100%;height:100%;border-radius:16px;opacity:${Number.isFinite(op) ? op : 0.4};filter:blur(${blur});background:${bg};transform:scale(${Number(f.scale ?? 1.06)}) translate(${Number(f.translateX ?? 0)}px, ${Number(f.translateY ?? 8)}px)"></div></div>`;
  }
  if (mid && (fm("stack_frames") || anchor === "depth")) {
    html += `<div style="pointer-events:none;position:absolute;inset:${Number(mid.insetPx ?? 12)}px;z-index:1;border-radius:16px;opacity:${Number(mid.opacity ?? 0.2)};border:${escapeHtml(String(mid.border))};box-shadow:${escapeHtml(String(mid.shadow))}"></div>`;
  }
  if (anchor === "depth" && fm("stack_frames")) {
    html += `<div style="pointer-events:none;position:absolute;inset:18px;z-index:1;border-radius:12px;border:1px solid rgba(255,255,255,0.05);opacity:0.35;transform:scale(0.98) translateY(4px)"></div>`;
  }
  return html;
}

function renderHeroUserBackground(visual: Record<string, unknown>): string {
  const bg = visual.background as {
    type?: string;
    value?: string;
    behavior?: string;
    fallbackColor?: string;
    mimeType?: string;
  } | undefined;
  if (!bg?.type || !bg.value) return "";
  const v = escapeHtml(String(bg.value));
  const behavior = String(bg.behavior || "scroll");
  const att = behavior === "fixed" || behavior === "parallax" ? "fixed" : "scroll";
  const fb = escapeHtml(String(bg.fallbackColor || "#0f172a"));
  const vt = escapeHtml(String(bg.mimeType || "video/mp4"));
  if (bg.type === "color") {
    return `<div class="hero-user-bg" style="pointer-events:none;position:absolute;inset:0;border-radius:16px;z-index:0;background:${v}"></div>`;
  }
  if (bg.type === "image") {
    return `<div class="hero-user-bg hero-user-bg--image" style="pointer-events:none;position:absolute;inset:0;border-radius:16px;z-index:0;background-color:${fb};background-image:url('${v}');background-size:cover;background-position:center;background-attachment:${att}"></div>`;
  }
  if (bg.type === "video") {
    return `<div class="hero-user-bg hero-user-bg--video" style="pointer-events:none;position:absolute;inset:0;border-radius:16px;z-index:0;overflow:hidden"><video autoplay muted loop playsinline style="width:100%;height:100%;object-fit:cover"><source src="${v}" type="${vt}" /></video></div>`;
  }
  return "";
}

function renderHeroDataPanelsStatic(visual: Record<string, unknown>): string {
  const rows = Array.isArray(visual.dataPanels) ? (visual.dataPanels as Array<{ label?: string; value?: string }>) : [];
  if (!rows.length) return "";
  const cells = rows
    .map((r) => {
      const lb = escapeHtml(String(r.label ?? ""));
      const vl = escapeHtml(String(r.value ?? ""));
      return `<div style="border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:rgba(2,6,23,0.78);padding:6px 10px;font-size:10px;box-shadow:0 0 18px -6px rgba(56,189,248,0.35)"><span style="color:#64748b">${lb}</span> <strong style="color:#f8fafc">${vl}</strong></div>`;
    })
    .join("");
  return `<div style="pointer-events:none;position:absolute;right:12px;top:12px;z-index:4;display:flex;flex-direction:column;gap:6px">${cells}</div>`;
}

function renderContinuityLayersStatic(visual: Record<string, unknown>): string {
  const c = visual.continuity as Record<string, unknown> | undefined;
  if (!c) return "";
  let html = "";
  if (c.ambientBleed) {
    html += `<div class="thz-cont-bleed" style="pointer-events:none;position:absolute;inset:0;border-radius:inherit;opacity:0.88;background:${escapeHtml(String(c.ambientBleed))};z-index:0"></div>`;
  }
  if (c.topLine) {
    html += `<div class="thz-cont-topline" style="pointer-events:none;position:absolute;left:0;right:0;top:0;height:1px;opacity:0.85;background:${escapeHtml(String(c.topLine))};z-index:4"></div>`;
  }
  return html;
}

function renderSectionFarWashStatic(visual: Record<string, unknown>): string {
  const sd = visual.sectionDepth as Record<string, unknown> | undefined;
  if (!sd?.farWash) return "";
  return `<div class="thz-sec-farwash" style="pointer-events:none;position:absolute;inset:0;border-radius:inherit;opacity:0.92;background:${escapeHtml(String(sd.farWash))};z-index:0"></div>`;
}

function socialFaviconUrl(href: string): string {
  const safeHref = escapeHtml(href || "");
  return `https://www.google.com/s2/favicons?domain_url=${encodeURIComponent(safeHref)}&sz=64`;
}

/** Exported for parity tests — same HTML as IPFS/static bundle blocks. */
export function renderSiteBuilderStaticBlockHtml(block: unknown, schema?: SiteSchemaDocumentType): string {
  return renderBlock(block, schema);
}

function renderBlock(block: any, schema?: SiteSchemaDocumentType): string {
  const type = String(block?.type || "");
  if (type === "hero") {
    const title = escapeHtml(String(block?.content?.title ?? "Hero Title"));
    const subtitle = escapeHtml(String(block?.content?.subtitle ?? ""));
    const visual = block?.content?.visual || {};
    const grad = escapeHtml(String(visual.gradient || ""));
    const glow = escapeHtml(String(visual.glowShadow || ""));
    const grid = typeof visual.gridOverlay === "number" ? visual.gridOverlay : 0;
    const noise = typeof visual.noise === "number" ? visual.noise : 0;
    const ambientGlow = visual.ambientGlow ? escapeHtml(String(visual.ambientGlow)) : "";
    const rhythmOverlay = visual.rhythmOverlay ? escapeHtml(String(visual.rhythmOverlay)) : "";
    const animateBg = Boolean(visual.animateBackground);
    const hasDocMeta = Boolean(schema?.metadata?.visualMeta);
    const cineHeroBg = heroCinematicStackCss(visual as Record<string, unknown>, hasDocMeta);
    const headlineScale = String(block?.content?.headlineScale || "hero-md");
    const h1Style =
      headlineScale === "hero-xl"
        ? "font-size:clamp(1.75rem,4.5vw,2.75rem);font-weight:800;letter-spacing:-0.02em;line-height:1.05;"
        : headlineScale === "hero-lg"
          ? "font-size:clamp(1.35rem,3.5vw,2.1rem);font-weight:700;letter-spacing:-0.02em;"
          : "font-size:clamp(1.15rem,3vw,1.65rem);font-weight:700;";
    const style = [
      cineHeroBg
        ? `${cineHeroBg}background-size:cover, cover;`
        : grad
          ? `background:${grad};`
          : "",
      animateBg && !cineHeroBg ? `background-size:200% 200%;animation:thzShift 18s linear infinite;` : "",
      glow ? `box-shadow:${glow};` : "",
      "position:relative;overflow:hidden;border-radius:16px;padding:24px;border:1px solid rgba(255,255,255,0.08);",
    ]
      .filter(Boolean)
      .join("");
    const ambientLayer = ambientGlow
      ? `<div style="pointer-events:none;position:absolute;inset:0;opacity:0.72;filter:blur(36px);background:${ambientGlow};border-radius:16px;z-index:0;"></div>`
      : "";
    const gridLayer =
      grid > 0
        ? `<div style="pointer-events:none;position:absolute;inset:0;opacity:${Math.min(grid, 0.12)};background-image:linear-gradient(rgba(255,255,255,0.06) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.06) 1px,transparent 1px);background-size:22px 22px;border-radius:16px;z-index:1;"></div>`
        : "";
    const noiseLayer =
      noise > 0
        ? `<div style="pointer-events:none;position:absolute;inset:0;opacity:${Math.min(noise, 0.08)};mix-blend-mode:overlay;background-image:url(data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.35'/%3E%3C/svg%3E);border-radius:16px;z-index:1;"></div>`
        : "";
    const accentFallback = String(visual.accent || "#22d3ee");
    const accentResolved = resolveExportAccent(schema, visual as Record<string, unknown>, accentFallback);
    const pseudoDepth = renderHeroPseudoDepthLayers(visual as Record<string, unknown>, accentResolved);
    const rhythmLayer = rhythmOverlay
      ? `<div style="pointer-events:none;position:absolute;inset:0;z-index:2;border-radius:16px;background:${rhythmOverlay};"></div>`
      : "";
    const anchor = String(visual.anchor || "");
    const accent = escapeHtml(accentResolved);
    const hd = visual.heroDepth as Record<string, unknown> | undefined;
    const neuralLayer =
      anchor === "neural"
        ? visual.heroDepth
          ? `<svg class="thz-anchor-neural" viewBox="0 0 400 140" preserveAspectRatio="none" style="pointer-events:none;position:absolute;inset:0;z-index:2;height:100%;width:100%;opacity:0.34;color:${accent}"><path d="M32,72 C100,28 180,108 268,48 S352,92 378,68" fill="none" stroke="currentColor" stroke-width="1"/><path d="M48,88 C130,52 210,120 290,72 S340,96 368,82" fill="none" stroke="currentColor" stroke-width="0.75" opacity="0.65"/><circle cx="44" cy="70" r="3.5" fill="currentColor"/><circle cx="118" cy="44" r="3.5" fill="currentColor"/><circle cx="196" cy="84" r="3.5" fill="currentColor"/><circle cx="268" cy="52" r="3.5" fill="currentColor"/><circle cx="312" cy="78" r="3" fill="currentColor"/><circle cx="352" cy="64" r="3" fill="currentColor"/></svg>`
          : `<svg class="thz-anchor-neural" viewBox="0 0 400 120" preserveAspectRatio="none" style="pointer-events:none;position:absolute;inset:0;z-index:2;height:100%;width:100%;opacity:0.32;color:${accent}"><path d="M40,60 C120,20 200,100 280,40 S360,80 380,55" fill="none" stroke="currentColor" stroke-width="1"/><circle cx="48" cy="58" r="3" fill="currentColor"/><circle cx="140" cy="42" r="3" fill="currentColor"/><circle cx="220" cy="78" r="3" fill="currentColor"/><circle cx="300" cy="44" r="3" fill="currentColor"/></svg>`
        : "";
    const depthLayer =
      anchor === "depth" && !hd
        ? `<div style="pointer-events:none;position:absolute;inset:12px;z-index:2;border-radius:12px;border:1px solid rgba(255,255,255,0.06);box-shadow:inset 0 1px 24px rgba(0,0,0,0.35)"></div>`
        : "";
    const signalLayer =
      anchor === "signal"
        ? `<div class="thz-anchor-signal" style="pointer-events:none;position:absolute;left:8%;right:8%;top:50%;height:1px;z-index:2;transform:translateY(-50%);background:linear-gradient(90deg,transparent,${accent},transparent);box-shadow:0 0 12px ${accent}"></div>`
        : "";
    const holoLayer = anchor === "holographic" ? `<div class="thz-anchor-holo"></div>` : "";
    const dataPanels = renderHeroDataPanelsStatic(visual as Record<string, unknown>);
    const near = hd?.planes && (hd.planes as Record<string, unknown>).near
      ? ((hd.planes as Record<string, unknown>).near as Record<string, unknown>)
      : undefined;
    const contentShadow = near?.contentShadow ? escapeHtml(String(near.contentShadow)) : "";
    const rawLabel = block?.content?.label;
    const rawHref = block?.content?.href;
    const ctaHtml =
      rawLabel && rawHref
        ? `<a class="btn hero-cta-link" href="${escapeHtml(String(rawHref))}" style="display:inline-flex;margin-top:14px;border-radius:9999px;padding:10px 18px;text-decoration:none;font-weight:700;background:rgba(8,47,73,0.5);color:#ecfeff;border:1px solid ${accent};box-shadow:0 0 28px ${accent}55,0 12px 32px -10px rgba(0,0,0,0.55)">${escapeHtml(String(rawLabel))}</a>`
        : "";
    const innerContent = `<h1 class="hero-rich-anim" style="${h1Style}">${title}</h1>${subtitle ? `<p>${subtitle}</p>` : ""}${ctaHtml}`;
    const contentShell = contentShadow
      ? `<div style="position:relative;z-index:3;box-shadow:${contentShadow}">${innerContent}</div>`
      : `<div style="position:relative;z-index:3">${innerContent}</div>`;
    const userBg = renderHeroUserBackground(visual as Record<string, unknown>);
    const heroIdRaw = blockDomId(block?.content as Record<string, unknown> | undefined);
    const heroId = heroIdRaw ? ` id="${escapeHtml(heroIdRaw)}"` : ` id="hero"`;
    const heroCine = hasDocMeta ? " thz-hero-cinematic" : "";
    return `<section${heroId} class="hero hero-rich ${thzShellClass(block?.content)}${heroCine}" style="${style}">${userBg}${ambientLayer}${gridLayer}${noiseLayer}${pseudoDepth}${rhythmLayer}${neuralLayer}${depthLayer}${signalLayer}${holoLayer}${dataPanels}${contentShell}</section>`;
  }
  if (type === "text") {
    const body = escapeHtml(String(block?.content?.body ?? ""));
    const vis = (block?.content?.visual || {}) as Record<string, unknown>;
    const sd = vis.sectionDepth as Record<string, unknown> | undefined;
    const contL = renderContinuityLayersStatic(vis);
    const far = sd?.farWash ? renderSectionFarWashStatic(vis) : "";
    const shell = sd?.shellShadow ? escapeHtml(String(sd.shellShadow)) : "";
    const layered = Boolean(contL || far || shell);
    const wrap = layered
      ? `position:relative;overflow:hidden;border-radius:12px;padding:10px 4px;${shell ? `box-shadow:${shell};` : ""}`
      : "";
    const tid = blockDomId(block?.content as Record<string, unknown> | undefined);
    const tidAttr = tid ? ` id="${escapeHtml(tid)}"` : "";
    return `<section${tidAttr} class="text-block" ${wrap ? `style="${wrap}"` : ""}>${far}${contL}<p style="position:relative;z-index:2;margin:0">${body}</p></section>`;
  }
  if (type === "image") {
    const src = escapeHtml(String(block?.src ?? ""));
    const alt = escapeHtml(String(block?.content?.alt ?? "image"));
    return `<section class="image-block"><img src="${src}" alt="${alt}" /></section>`;
  }
  if (type === "button") {
    const label = escapeHtml(String(block?.content?.label ?? "Learn More"));
    const href = escapeHtml(String(block?.content?.href ?? "#"));
    return `<section class="button-block"><a class="btn" href="${href}">${label}</a></section>`;
  }
  if (type === "section") {
    const title = escapeHtml(String(block?.content?.title ?? "Section"));
    const body = escapeHtml(String(block?.content?.body ?? ""));
    const thz = thzShellClass(block?.content);
    const sid = blockDomId(block?.content as Record<string, unknown> | undefined);
    const sidAttr = sid ? ` id="${escapeHtml(sid)}"` : "";
    return `<section${sidAttr} class="section-block ${thz}"><h2>${title}</h2>${body ? `<p>${body}</p>` : ""}</section>`;
  }
  if (type === "footer") {
    const body = escapeHtml(String(block?.content?.body ?? "Footer"));
    const thz = thzShellClass(block?.content);
    return `<footer class="footer-block ${thz}">${body}</footer>`;
  }
  if (type === "avatar") {
    const src = escapeHtml(String(block?.src || block?.content?.src || ""));
    const alt = escapeHtml(String(block?.content?.alt || "avatar"));
    return `<section class="avatar-block">${src ? `<img class="avatar" src="${src}" alt="${alt}" />` : `<div class="avatar-placeholder">${alt}</div>`}</section>`;
  }
  if (type === "heading") {
    const text = escapeHtml(String(block?.content?.text || block?.content?.title || "Heading"));
    const lv = String(block?.content?.level || "h2").toLowerCase();
    const tag = lv === "h3" ? "h3" : "h2";
    return `<section class="heading-block"><${tag}>${text}</${tag}></section>`;
  }
  if (type === "paragraph") {
    const text = escapeHtml(String(block?.content?.text || block?.content?.body || ""));
    const thz = thzShellClass(block?.content);
    const vis = (block?.content?.visual || {}) as Record<string, unknown>;
    const sd = vis.sectionDepth as Record<string, unknown> | undefined;
    const contL = renderContinuityLayersStatic(vis);
    const far = sd?.farWash ? renderSectionFarWashStatic(vis) : "";
    const shell = sd?.shellShadow ? escapeHtml(String(sd.shellShadow)) : "";
    const layered = Boolean(contL || far || shell);
    const wrap = layered
      ? `position:relative;overflow:hidden;border-radius:12px;padding:10px 4px;${shell ? `box-shadow:${shell};` : ""}`
      : "";
    const pid = blockDomId(block?.content as Record<string, unknown> | undefined);
    const pidAttr = pid ? ` id="${escapeHtml(pid)}"` : "";
    return `<section${pidAttr} class="paragraph-block ${thz}" ${wrap ? `style="${wrap}"` : ""}>${far}${contL}<p style="position:relative;z-index:2;margin:0">${text}</p></section>`;
  }
  if (type === "link") {
    const label = escapeHtml(String(block?.content?.label || "Link"));
    const href = escapeHtml(String(block?.href || block?.content?.href || "#"));
    return `<section class="link-block"><a class="btn link-btn" href="${href}">${label}</a></section>`;
  }
  if (type === "socials") {
    const links = Array.isArray(block?.content?.links) ? block.content.links : [];
    const rendered = links
      .map((entry: any) => {
        const label = escapeHtml(String(entry?.label || "Social"));
        const href = escapeHtml(String(entry?.href || "#"));
        const icon = socialFaviconUrl(href);
        return `<a href="${href}" class="social-chip"><img src="${icon}" alt="" /><span>${label}</span></a>`;
      })
      .join("");
    return `<section class="socials-block"><div class="socials-row">${rendered || '<span class="muted">Add social links</span>'}</div></section>`;
  }
  if (type === "image_grid") {
    const images = Array.isArray(block?.content?.images) ? block.content.images : [];
    const vis = (block?.content?.visual || {}) as Record<string, unknown>;
    const sd = vis.sectionDepth as Record<string, unknown> | undefined;
    const shell = sd?.shellShadow ? escapeHtml(String(sd.shellShadow)) : "";
    const cardSh = sd?.cardShadow ? escapeHtml(String(sd.cardShadow)) : "";
    const contL = renderContinuityLayersStatic(vis);
    const far = renderSectionFarWashStatic(vis);
    const rendered = images
      .map((entry: any) => {
        const src = escapeHtml(String(entry?.src || ""));
        const alt = escapeHtml(String(entry?.alt || "image"));
        const cs = cardSh ? `box-shadow:${cardSh};` : "";
        return src
          ? `<div class="ig-cell" style="border-radius:12px;overflow:hidden;border:1px solid rgba(255,255,255,0.1);${cs}"><img src="${src}" alt="${alt}" style="width:100%;height:auto;display:block" /></div>`
          : `<div class="ig-cell" style="aspect-ratio:1;border-radius:12px;border:1px solid rgba(255,255,255,0.08);display:grid;place-items:center;font-size:10px;color:#64748b;padding:8px;${cs}">${escapeHtml(String(entry?.alt || "Feature"))}</div>`;
      })
      .join("");
    const wrapStyle = shell
      ? `position:relative;overflow:hidden;border-radius:16px;padding:12px;border:1px solid rgba(255,255,255,0.08);box-shadow:${shell}`
      : "";
    return `<section class="image-grid-block" ${wrapStyle ? `style="${wrapStyle}"` : ""}>${far}${contL}<div class="image-grid" style="position:relative;z-index:2;display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px">${rendered || '<span class="muted">Add image URLs</span>'}</div></section>`;
  }
  if (type === "list") {
    const items = (Array.isArray(block?.items) ? block.items : Array.isArray(block?.content?.items) ? block.content.items : [])
      .map((item: any) => `<li>${escapeHtml(String(item))}</li>`)
      .join("");
    const thz = thzShellClass(block?.content);
    const variant = String(block?.content?.variant || "");
    const vis = (block?.content?.visual || {}) as Record<string, unknown>;
    const contL = variant === "trust_strip" ? renderContinuityLayersStatic(vis) : "";
    const echo =
      variant === "trust_strip" && (vis.continuity as Record<string, unknown> | undefined)?.echoSignal
        ? `<div style="position:absolute;bottom:6px;right:10px;display:flex;gap:4px;opacity:0.4;z-index:3"><span style="width:10px;height:3px;border-radius:2px;background:#22d3ee"></span><span style="width:10px;height:3px;border-radius:2px;background:#22d3ee"></span><span style="width:10px;height:3px;border-radius:2px;background:#22d3ee"></span></div>`
        : "";
    const sd = vis.sectionDepth as Record<string, unknown> | undefined;
    const far = variant === "trust_strip" ? renderSectionFarWashStatic(vis) : "";
    const shell = variant === "trust_strip" && sd?.shellShadow ? escapeHtml(String(sd.shellShadow)) : "";
    const trustWrap =
      variant === "trust_strip"
        ? `position:relative;overflow:hidden;border-radius:12px;padding:10px 8px;${shell ? `box-shadow:${shell};` : ""}`
        : "";
    const ulStyle =
      variant === "trust_strip"
        ? "position:relative;z-index:2;margin:0;padding:0;list-style:none;display:flex;flex-wrap:wrap;gap:8px"
        : "position:relative;z-index:2;margin:0;padding-left:1.2rem";
    return `<section class="list-block ${thz}" ${trustWrap ? `style="${trustWrap}"` : ""}>${far}${contL}<ul style="${ulStyle}">${items || "<li>List item</li>"}</ul>${echo}</section>`;
  }
  if (type === "divider") {
    const color = escapeHtml(String(block?.content?.color || "#334155"));
    const thickness = Number(block?.content?.thickness || 1);
    const offsetY = Number(block?.content?.offsetY || 0);
    return `<hr class="divider-block" style="border-top-color:${color};border-top-width:${Number.isFinite(thickness) ? thickness : 1}px;transform:translateY(${Number.isFinite(offsetY) ? offsetY : 0}px)" />`;
  }
  if (type === "big_link" || type === "internal_big_link") {
    const label = escapeHtml(String(block?.content?.label || "Open"));
    const href = escapeHtml(String(block?.href || block?.content?.href || "#"));
    return `<section class="big-link-block"><a class="big-link" href="${href}">${label}</a></section>`;
  }
  if (type === "header_image") {
    const src = escapeHtml(String(block?.src || block?.content?.src || ""));
    const alt = escapeHtml(String(block?.content?.alt || "header image"));
    return `<section class="header-image-block">${src ? `<img src="${src}" alt="${alt}" />` : "<div class='muted'>Add header image URL</div>"}</section>`;
  }
  if (type === "audio") {
    const src = escapeHtml(String(block?.src || block?.content?.src || ""));
    return `<section class="audio-block">${src ? `<audio controls src="${src}"></audio>` : "<div class='muted'>Add audio URL</div>"}</section>`;
  }
  if (type === "file") {
    const href = escapeHtml(String(block?.href || block?.content?.href || ""));
    const label = escapeHtml(String(block?.content?.label || "Download file"));
    return `<section class="file-block">${href ? `<a class="btn" href="${href}" download>${label}</a>` : "<div class='muted'>Add file URL</div>"}</section>`;
  }
  if (type === "video") {
    const src = escapeHtml(String(block?.src || block?.content?.src || ""));
    return `<section class="video-block">${src ? `<video controls preload="metadata" src="${src}"></video>` : "<div class='muted'>Add video URL</div>"}</section>`;
  }
  if (type === "call_to_action") {
    const title = escapeHtml(String(block?.content?.title || "Call to Action"));
    const body = escapeHtml(String(block?.content?.body || ""));
    const label = escapeHtml(String(block?.content?.label || "Continue"));
    const href = escapeHtml(String(block?.content?.href || "#"));
    const thz = thzShellClass(block?.content);
    const vis = (block?.content?.visual || {}) as Record<string, unknown>;
    const sd = vis.sectionDepth as Record<string, unknown> | undefined;
    const shell = sd?.shellShadow ? escapeHtml(String(sd.shellShadow)) : "";
    const inner = `<div style="position:relative;z-index:2"><h3>${title}</h3>${body ? `<p>${body}</p>` : ""}<a class="btn" href="${href}">${label}</a></div>`;
    const far = renderSectionFarWashStatic(vis);
    const cont = renderContinuityLayersStatic(vis);
    const layered = Boolean(far || cont || shell);
    const style = shell
      ? `position:relative;overflow:hidden;border-radius:16px;padding:18px;border:1px solid rgba(34,211,211,0.22);box-shadow:${shell}`
      : layered
        ? `position:relative;overflow:hidden;border-radius:16px;padding:18px;border:1px solid rgba(34,211,211,0.18)`
        : "";
    const cid = blockDomId(block?.content as Record<string, unknown> | undefined);
    const cidAttr = cid ? ` id="${escapeHtml(cid)}"` : "";
    return `<section${cidAttr} class="cta-block ${thz}" ${style ? `style="${style}"` : ""}>${far}${cont}${inner}</section>`;
  }
  if (type === "stat_band") {
    const stats = Array.isArray(block?.content?.stats) ? block.content.stats : [];
    const cells = stats
      .map((s: { value?: string; label?: string }) => {
        const v = escapeHtml(String(s?.value ?? "—"));
        const l = escapeHtml(String(s?.label ?? ""));
        return `<div class="stat-cell"><div class="stat-value">${v}</div><div class="stat-label">${l}</div></div>`;
      })
      .join("");
    const vis = block?.content?.visual || {};
    const bg = escapeHtml(String(vis.gradient || "linear-gradient(90deg,transparent,rgba(56,189,248,0.12),transparent)"));
    const ring = escapeHtml(resolveExportAccent(schema, vis as Record<string, unknown>, String(vis.ringAccent || vis.accent || "#38bdf8")));
    const rhythm = vis.rhythmOverlay ? escapeHtml(String(vis.rhythmOverlay)) : "";
    const sd = vis.sectionDepth as Record<string, unknown> | undefined;
    const cont = vis.continuity as Record<string, unknown> | undefined;
    const soften = cont?.softenGlow === true;
    const shell = sd?.shellShadow ? escapeHtml(String(sd.shellShadow)) : "";
    const sdEdge = sd?.edgeGlow ? escapeHtml(String(sd.edgeGlow)) : "";
    const parts: string[] = [];
    if (shell) parts.push(shell);
    if (sdEdge) parts.push(sdEdge);
    if (vis.edgeGlow === true) parts.push(soften ? `0 0 30px -10px ${ring}33` : `0 0 42px -10px ${ring}55`);
    parts.push("inset 0 0 0 1px rgba(255,255,255,0.05)");
    const edgeGlow = parts.length ? `box-shadow:${parts.join(",")};` : "";
    const rhythmLayer = rhythm
      ? `<div class="stat-rhythm" style="pointer-events:none;position:absolute;inset:0;border-radius:14px;background:${rhythm};z-index:1"></div>`
      : "";
    const thz = thzShellClass(block?.content);
    const far = renderSectionFarWashStatic(vis as Record<string, unknown>);
    const contL = renderContinuityLayersStatic(vis as Record<string, unknown>);
    const motifsArr = Array.isArray(sd?.motifs) ? (sd.motifs as string[]) : [];
    const nodeRail =
      motifsArr.includes("node_rail_fragment") || motifsArr.includes("restraint_motes")
        ? `<div class="thz-node-rail" style="display:flex;justify-content:center;gap:${motifsArr.includes("restraint_motes") && !motifsArr.includes("node_rail_fragment") ? "12px" : "10px"};margin-top:12px;opacity:${motifsArr.includes("restraint_motes") && !motifsArr.includes("node_rail_fragment") ? "0.34" : "0.45"}">${[0, 1, 2, 3, 4].map((j) => `<span style="width:${motifsArr.includes("restraint_motes") && !motifsArr.includes("node_rail_fragment") ? "3px" : "4px"};height:${motifsArr.includes("restraint_motes") && !motifsArr.includes("node_rail_fragment") ? "3px" : "4px"};border-radius:9999px;background:${ring};box-shadow:0 0 6px ${ring}"></span>`).join("")}</div>`
        : "";
    return `<section class="stat-band ${thz}" style="position:relative;overflow:hidden;background:${bg};border-radius:14px;padding:18px 12px;border:1px solid #1e293b;${edgeGlow}">${far}${contL}${rhythmLayer}<div class="stat-row" style="position:relative;z-index:2;display:flex;flex-wrap:wrap;justify-content:center;gap:28px">${cells || "<span class='muted'>Stats</span>"}</div>${nodeRail}</section>`;
  }
  if (type === "visual_break") {
    const variant = String(block?.content?.variant || "gradient_divider");
    const h = Number(block?.content?.visual?.height || (variant === "glow_strip" ? 64 : 2));
    const grad = escapeHtml(String(block?.content?.visual?.gradient || "linear-gradient(90deg,transparent,rgba(99,102,241,0.45),transparent)"));
    const shadow = escapeHtml(String(block?.content?.visual?.glowShadow || ""));
    const shimmer = block?.content?.visual?.shimmer === true;
    const shimmerBand = block?.content?.visual?.shimmerBand === true;
    const rhythm = block?.content?.visual?.rhythmOverlay ? escapeHtml(String(block.content.visual.rhythmOverlay)) : "";
    const rhythmLayer = rhythm
      ? `<div style="pointer-events:none;position:absolute;inset:0;z-index:1;mix-blend-mode:overlay;background:${rhythm};"></div>`
      : "";
    if (variant === "glow_strip") {
      const band = shimmerBand
        ? `<div class="thz-shimmer-band" style="pointer-events:none;position:absolute;inset:0;z-index:2;opacity:0.45;mix-blend-mode:screen;background:linear-gradient(100deg,transparent 30%,rgba(255,255,255,0.12) 50%,transparent 70%);background-size:200% 100%;animation:thzShimmer 12s linear infinite;"></div>`
        : "";
      return `<div class="visual-break glow-strip" style="position:relative;overflow:hidden;height:${h}px;border-radius:12px;background:${grad};box-shadow:${shadow};margin:12px 0">${rhythmLayer}${band}</div>`;
    }
    const anim = shimmer ? `background-size:200% 100%;animation:thzShimmer 10s linear infinite;` : "";
    const vis = (block?.content?.visual || {}) as Record<string, unknown>;
    const sd = vis.sectionDepth as Record<string, unknown> | undefined;
    const lip = sd?.dividerGlow ? escapeHtml(String(sd.dividerGlow)) : "";
    const lipLayer = lip
      ? `<div style="pointer-events:none;position:absolute;left:5%;right:5%;top:0;height:2px;border-radius:999px;opacity:0.75;background:${lip};z-index:3"></div>`
      : "";
    const carry =
      Array.isArray(sd?.motifs) && (sd.motifs as string[]).includes("carry_gradient")
        ? `<div style="pointer-events:none;position:absolute;inset:0;opacity:0.25;mix-blend-mode:overlay;background:linear-gradient(100deg,transparent,rgba(99,102,241,0.15),transparent);z-index:0"></div>`
        : "";
    return `<div class="visual-break gradient-divider" style="position:relative;overflow:hidden;height:${Math.max(2, h)}px;border-radius:999px;margin:12px 0">${carry}${lipLayer}${rhythmLayer}<div style="height:100%;width:100%;border-radius:999px;background:${grad};${anim}"></div></div>`;
  }
  return `<section class="unknown-block"><pre>${escapeHtml(JSON.stringify(block, null, 2))}</pre></section>`;
}

function blockDomId(content: Record<string, unknown> | undefined): string {
  const raw = String(content?.seoAnchorId || content?.aiSectionId || "").trim();
  if (!raw) return "";
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function safeJsonLd(obj: unknown): string {
  return JSON.stringify(obj).replace(/</g, "\\u003c");
}

function renderSeoHeadExtension(schema: SiteSchemaDocumentType): string {
  const m = schema.metadata;
  if (!m) return "";
  const parts: string[] = [];
  if (Array.isArray(m.keywords) && m.keywords.length) {
    parts.push(`<meta name="keywords" content="${escapeHtml(m.keywords.join(", "))}" />`);
  }
  if (m.canonicalUrl) {
    parts.push(`<link rel="canonical" href="${escapeHtml(m.canonicalUrl)}" />`);
    parts.push(`<meta property="og:url" content="${escapeHtml(m.canonicalUrl)}" />`);
  }
  if (m.robots) parts.push(`<meta name="robots" content="${escapeHtml(m.robots)}" />`);
  const og = m.openGraph;
  if (og?.title) parts.push(`<meta property="og:title" content="${escapeHtml(og.title)}" />`);
  if (og?.description) parts.push(`<meta property="og:description" content="${escapeHtml(og.description)}" />`);
  if (og?.image) parts.push(`<meta property="og:image" content="${escapeHtml(og.image)}" />`);
  if (og?.type) parts.push(`<meta property="og:type" content="${escapeHtml(og.type)}" />`);
  const tw = m.twitterCard;
  if (tw?.card) parts.push(`<meta name="twitter:card" content="${escapeHtml(tw.card)}" />`);
  if (tw?.title) parts.push(`<meta name="twitter:title" content="${escapeHtml(tw.title)}" />`);
  if (tw?.description) parts.push(`<meta name="twitter:description" content="${escapeHtml(tw.description)}" />`);
  if (Array.isArray(m.structuredData)) {
    for (const node of m.structuredData) {
      parts.push(`<script type="application/ld+json">${safeJsonLd(node)}</script>`);
    }
  }
  return parts.length ? `\n    ${parts.join("\n    ")}` : "";
}

function renderPageHtml(schema: SiteSchemaDocumentType, page: SiteSchemaDocumentType["pages"][number]) {
  const title = escapeHtml(schema.metadata?.title || "Web3 Site");
  const description = escapeHtml(schema.metadata?.description || "");
  const metadata = schema.metadata;
  const widgetBits = buildAgencyWidgetSnippetHtml(schema, page.slug);
  const paymentBits = buildPaymentIntegrationHtml(schema, page.slug);
  const removeDefaultCss = Boolean(metadata?.removeDefaultCss);
  const customCss = String(metadata?.advanced?.customCss || "").trim();
  const customJs = String(metadata?.advanced?.customJs || "").trim();
  const mode = String(metadata?.theme?.backgroundMode || "simple_gradients");
  const gradientStart = String(metadata?.theme?.gradientStart || "#0f172a");
  const gradientEnd = String(metadata?.theme?.gradientEnd || "#1e293b");
  const customGradient = String(metadata?.theme?.customGradient || "");
  const backgroundColor = String(metadata?.theme?.backgroundColor || "#020617");
  const mediaUrl = String(metadata?.theme?.mediaUrl || "");
  const mediaType = String(metadata?.theme?.mediaType || "image");
  const themeSlice = { backgroundMode: mode, gradientStart, gradientEnd, customGradient, backgroundColor };
  const visualMeta = metadata?.visualMeta;
  const cinematic = buildCinematicBackgroundFromVisualMeta(visualMeta, themeSlice, { seed: schema.metadata?.title || "export" });
  const hasVm = Boolean(visualMeta);
  const bodyInner = page.blocks
    .map((block, i) => {
      const inner = renderBlock(block, schema);
      const motion = staticMotionClassFromBlock(block);
      const c = (block as { content?: { visualEngine?: { sectionTone?: string } } }).content;
      return buildSectionWrap(i, inner, c, hasVm, motion);
    })
    .join("\n");
  const mainGap = themeSpacingForVisualMeta(schema);
  const bodyStyleAttr = cinematic.bodyStyle;
  const backgroundMedia =
    mode === "custom_media" && mediaUrl
      ? mediaType === "video"
        ? `<video class="bg-media bg-media--cinematic" autoplay muted loop playsinline><source src="${escapeHtml(mediaUrl)}" /></video>`
        : `<img class="bg-media bg-media--cinematic" src="${escapeHtml(mediaUrl)}" alt="background" />`
      : "";
  const rawMode = String(metadata?.theme?.styleMode || "");
  const troothertzMode = ["web3", "corporate", "minimal", "bold"].includes(rawMode) ? rawMode : "";
  const troothertzModeAttr = troothertzMode ? ` data-troothertz-mode="${escapeHtml(troothertzMode)}"` : "";
  const cinematicStyleTag = visualMeta && cinematic.styleBlock ? `<style id="cinematic-tokens">\n${cinematic.styleBlock}\n</style>\n` : "";
  const widgetTheming = visualMeta
    ? `<style id="cinematic-widget-bridge">[data-troo-agent-root],.troo-agent-launcher{--agent-accent:var(--cinematic-accent, #22d3ee);--agent-surface:var(--cinematic-surface, #6366f1);}</style>\n`
    : "";
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    ${description ? `<meta name="description" content="${description}" />` : ""}
    ${renderSeoHeadExtension(schema)}
    ${removeDefaultCss ? "" : `<link rel="stylesheet" href="/assets/site.css" />`}
    ${cinematicStyleTag}${widgetTheming}
    ${customCss ? `<style>${customCss}</style>` : ""}
    ${widgetBits.head}
  </head>
  <body${visualMeta ? ` class="cinematic-export${cinematic.bodyClass}"` : ""} style="${bodyStyleAttr}"${troothertzModeAttr} data-cinematic="${visualMeta ? "1" : "0"}">
    ${cinematic.overlayHtml}
    ${backgroundMedia}
    <main class="container" style="position:relative;z-index:2;${mainGap}">
      ${bodyInner}
      ${paymentBits.insideMainEnd}
    </main>
    ${paymentBits.bodyBeforeClose}
    ${customJs ? `<script>${customJs}</script>` : ""}
    ${widgetBits.bodyBeforeClose}
  </body>
</html>`;
}

export function generateStaticBundle(schema: SiteSchemaDocumentType): {
  files: GeneratedFile[];
  manifest: {
    totalFiles: number;
    totalBytes: number;
    files: Array<{ path: string; bytes: number; sha256: string; contentType: string }>;
  };
} {
  const files: GeneratedFile[] = [];

  ensureDesignSystemOnDocument(schema);
  const dsBlock = schema.metadata?.designSystem
    ? `${designSystemToCssRootBlock(schema.metadata.designSystem)}\n`
    : "";

  /* Export bundle: keep preview parity — engineered blocks (hero, stat band, grids, CTA) own their shells; avoid double borders/padding. */
  const css = `${dsBlock}
*{box-sizing:border-box}body{margin:0;font-family:Inter,system-ui,Segoe UI,Arial,sans-serif;background:#020617;color:#e2e8f0}
.container{max-width:1100px;margin:0 auto;padding:clamp(16px,4vw,40px) clamp(12px,3vw,20px);display:grid;gap:clamp(14px,2.5vw,22px)}
.hero h1{font-size:2rem;margin:0 0 10px}.hero p{color:#94a3b8}
.btn,.btn.link-btn{display:inline-block;border-radius:9999px;padding:10px 16px;background:#06b6d4;color:#00121a;text-decoration:none;font-weight:700}
.site-builder-payment-wall{margin-top:clamp(12px,2.5vw,28px);padding:14px 16px;border-radius:14px;border:1px solid rgba(148,163,184,0.28);background:rgba(15,23,42,0.92)}.site-builder-payment-wall .site-builder-payment-link.btn{background:#0070ba;color:#fff}.site-builder-payment-invalid{margin:0;color:#f87171;font-size:14px}.site-builder-paypal-sdk-placeholder{padding:12px;border-radius:12px;border:1px dashed rgba(100,116,139,0.5);background:rgba(2,6,23,0.5)}
img{max-width:100%;height:auto;border-radius:12px}
.container > section:not(.hero-rich):not(.stat-band):not(.image-grid-block):not(.cta-block),
.container > footer.footer-block{border:1px solid #1e293b;background:#0f172a;padding:16px;border-radius:16px}
body[data-troothertz-mode="minimal"] .container > section:not(.hero-rich):not(.stat-band):not(.image-grid-block):not(.cta-block),
body[data-troothertz-mode="minimal"] .container > footer.footer-block{background:rgba(15,23,42,0.58);border-color:rgba(51,65,85,0.88)}
body[data-troothertz-mode="corporate"] .container > section:not(.hero-rich):not(.stat-band):not(.image-grid-block):not(.cta-block),
body[data-troothertz-mode="corporate"] .container > footer.footer-block{border-color:rgba(71,85,105,0.95)}
body[data-troothertz-mode="bold"] .container > section:not(.hero-rich):not(.stat-band):not(.image-grid-block):not(.cta-block),
body[data-troothertz-mode="bold"] .container > footer.footer-block{border-color:rgba(167,139,250,0.38);box-shadow:inset 0 1px 0 rgba(255,255,255,0.05)}
.bg-media{position:fixed;inset:0;object-fit:cover;width:100%;height:100%;z-index:-1;opacity:.35}
.bg-media--cinematic{z-index:0;opacity:0.32}
.cinematic-export .container{z-index:2}
.cine-sec{padding:2px 0;margin:0 0 clamp(10px,1.5vw,18px) 0;border-radius:14px;transition:opacity 0.35s ease}
.cine-sec--a{background:linear-gradient(180deg,rgba(15,23,42,0.4),transparent 60%)}
.cine-sec--b{background:linear-gradient(180deg,rgba(2,6,23,0.55),transparent 58%)}
.cine-sec--light{background:linear-gradient(180deg,rgba(255,255,255,0.04),transparent 50%)}
.cine-sec--dark{background:linear-gradient(180deg,rgba(0,0,0,0.12),transparent 55%)}
.cine-sec--visual{background:linear-gradient(110deg,rgba(99,102,241,0.08),rgba(2,6,23,0.1),transparent 62%)}
.thz-static-motion-fade{opacity:0.99;animation:thzCineFade 0.6s ease-out both}
.thz-static-motion-slide{animation:thzCineSlide 0.5s ease-out both}
.thz-static-motion-parallax{transform:translate3d(0,2px,0);animation:thzCinePar 0.45s ease-out both}
@keyframes thzCineFade{from{opacity:0.75}to{opacity:0.99}}
@keyframes thzCineSlide{from{opacity:0.85;transform:translate3d(0,8px,0)}to{opacity:1;transform:translate3d(0,0,0)}}
@keyframes thzCinePar{from{transform:translate3d(0,4px,0)}to{transform:translate3d(0,0,0)}}
body.cinematic-v2,body.cinematic-export{--cinematic-peek:1}
.thz-hero-cinematic{box-shadow:0 20px 60px -24px rgba(0,0,0,0.5),inset 0 1px 0 rgba(255,255,255,0.05)}
.hero-cta-link:hover{transform:scale(1.02);box-shadow:0 0 36px rgba(34,211,238,0.35),0 14px 32px -12px rgba(0,0,0,0.55) !important}
.hero-user-bg--image{min-height:80px}
.avatar{width:96px;height:96px;border-radius:9999px;object-fit:cover}
.avatar-placeholder{width:96px;height:96px;border-radius:9999px;background:#1e293b;display:grid;place-items:center}
.socials-row{display:flex;flex-wrap:nowrap;gap:8px;overflow-x:auto}.social-chip{padding:6px 10px;border-radius:9999px;border:1px solid #334155;text-decoration:none;color:#93c5fd;display:inline-flex;align-items:center;gap:6px;white-space:nowrap}.social-chip img{width:16px;height:16px;border-radius:4px}
.image-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px}
.divider-block{border:none;border-top:1px solid #334155;margin:8px 0}
.big-link{display:flex;justify-content:center;align-items:center;min-height:72px;border-radius:14px;border:1px solid #06b6d4;text-decoration:none;color:#67e8f9;font-weight:700}
.video-block video,.audio-block audio{width:100%}.muted{color:#94a3b8}
.stat-value{font-size:1.6rem;font-weight:700;letter-spacing:-0.02em;color:#f8fafc}
.stat-label{font-size:0.65rem;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;margin-top:4px}
.hero-rich h1{font-size:1.75rem;margin:0 0 8px;line-height:1.15}
.hero-rich p{color:#94a3b8;margin:0}
@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
.hero-rich .hero-rich-anim{animation:fadeUp .5s ease-out both}
@keyframes thzShift{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}
@keyframes thzShimmer{0%{background-position:0% 50%}100%{background-position:200% 50%}}
@keyframes thzSpin{to{transform:rotate(360deg)}}
.thz-hero-far-wrap{animation:thzHeroFarDrift 19s ease-in-out infinite}
@keyframes thzHeroFarDrift{0%,100%{transform:translate3d(-3px,-7px,0)}50%{transform:translate3d(4px,7px,0)}}
.thz-hero-far-drift{will-change:transform}
.thz-anchor-holo{pointer-events:none;position:absolute;inset:0;z-index:2;opacity:0.34;mix-blend-mode:screen;border-radius:16px;background:conic-gradient(from 180deg at 50% 50%,rgba(34,211,238,0.22),transparent 42%,rgba(244,114,182,0.16) 72%,transparent);animation:thzSpin 48s linear infinite}
.thz-sec.thz-tone-light{background:linear-gradient(180deg,rgba(255,255,255,0.045),transparent 48%)}
.thz-sec.thz-tone-dark{background:linear-gradient(180deg,rgba(0,0,0,0.16),transparent 52%)}
.thz-sec.thz-tone-visual{background:linear-gradient(105deg,rgba(99,102,241,0.08),transparent 58%)}
.paragraph-block.thz-sec,.list-block.thz-sec,.section-block.thz-sec,.cta-block.thz-sec,.footer-block.thz-sec{padding:14px}
@media (max-width:640px){
.container{gap:16px;padding-left:14px;padding-right:14px}
.hero-rich h1{font-size:clamp(1.35rem,5.2vw,1.75rem)}
.stat-band .stat-row{flex-direction:column!important;gap:18px!important;align-items:center}
.image-grid-block .image-grid{grid-template-columns:repeat(auto-fill,minmax(120px,1fr))!important;gap:10px!important}
}
`;
  files.push({
    path: "assets/site.css",
    contentType: "text/css",
    content: css,
    bytes: Buffer.byteLength(css, "utf8"),
    sha256: sha256Hex(css),
  });

  for (const page of schema.pages) {
    const slug = page.slug === "/" ? "index" : page.slug.replaceAll("/", "").trim() || "index";
    const filename = `${slug}.html`;
    const html = renderPageHtml(schema, page);
    files.push({
      path: filename,
      contentType: "text/html",
      content: html,
      bytes: Buffer.byteLength(html, "utf8"),
      sha256: sha256Hex(html),
    });
  }

  const manifest = {
    totalFiles: files.length,
    totalBytes: files.reduce((sum, file) => sum + file.bytes, 0),
    files: files.map((file) => ({
      path: file.path,
      bytes: file.bytes,
      sha256: file.sha256,
      contentType: file.contentType,
    })),
  };

  return { files, manifest };
}
