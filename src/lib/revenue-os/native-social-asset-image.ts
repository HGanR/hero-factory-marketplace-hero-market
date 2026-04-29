/**
 * Template-based “native” social card (SVG) — no third-party generative model.
 * For Meta/IG you still need a public HTTPS image URL; Pinata can lift this SVG when configured.
 */

export type NativeSocialImageLayout = "card" | "quote" | "promo" | "event" | "tip" | "pro" | "square";

export type NativeSocialImageSpec = {
  title: string;
  subtitle?: string;
  /** Short line (e.g. CTA, date, or visual prompt) */
  line3?: string;
  width: number;
  height: number;
  /** CSS color / hex */
  accent: string;
  background: string;
  /**
   * Visual branch for Social Studio templates. Defaults to `card` (legacy single layout).
   */
  layout?: NativeSocialImageLayout;
  /** Replaces the small footer (e.g. business name) */
  brandFootline?: string;
};

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function footerLine(spec: NativeSocialImageSpec): string {
  return spec.brandFootline
    ? `${esc(spec.brandFootline)} · Social Studio`
    : "Hero Factory · AI Revenue OS";
}

function buildCardLike(spec: NativeSocialImageSpec, roundInner: boolean): string {
  const w = spec.width;
  const h = spec.height;
  const t = esc(spec.title.slice(0, 140));
  const sub = spec.subtitle ? esc(spec.subtitle.slice(0, 180)) : "";
  const l3 = spec.line3 ? esc(spec.line3.slice(0, 120)) : "";
  const inner = roundInner
    ? `<rect x="32" y="32" width="${w - 64}" height="${h - 64}" rx="24" fill="none" stroke="${esc(
        spec.accent
      )}" stroke-width="4" opacity="0.55"/>`
    : `<line x1="32" y1="48" x2="${w - 32}" y2="48" stroke="${esc(spec.accent)}" stroke-width="2" opacity="0.35" />`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${esc(spec.background)}"/>
      <stop offset="100%" stop-color="#0f172a"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)"/>
  ${inner}
  <text x="56" y="${Math.floor(h * 0.35)}" fill="#f8fafc" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="${Math.floor(
    w / 20
  )}" font-weight="700">${t}</text>
  ${
    sub
      ? `<text x="56" y="${Math.floor(h * 0.48)}" fill="#94a3b8" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="${Math.floor(
          w / 32
        )}">${sub}</text>`
      : ""
  }
  ${
    l3
      ? `<text x="56" y="${Math.floor(h * 0.62)}" fill="${esc(spec.accent)}" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="${Math.floor(
          w / 28
        )}" font-weight="600">${l3}</text>`
      : ""
  }
  <text x="56" y="${h - 48}" fill="#64748b" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="14">${footerLine(spec)}</text>
</svg>`;
}

function buildQuoteLayout(spec: NativeSocialImageSpec): string {
  const w = spec.width;
  const h = spec.height;
  const t = esc(spec.title.slice(0, 200));
  const sub = spec.subtitle ? esc("— " + spec.subtitle.slice(0, 120)) : "";
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="100%" height="100%" fill="${esc(spec.background)}"/>
  <rect x="48" y="0" width="6" height="${h}" fill="${esc(spec.accent)}" opacity="0.8"/>
  <text x="80" y="${Math.floor(h * 0.4)}" fill="#e2e8f0" font-family="Georgia, 'Times New Roman', serif" font-size="${Math.floor(
    w / 16
  )}" font-style="italic">${t}</text>
  <text x="80" y="${Math.floor(h * 0.7)}" fill="#94a3b8" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="${Math.floor(
    w / 24
  )}">${sub}</text>
  <text x="80" y="${h - 40}" fill="#64748b" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="13">${footerLine(
    spec
  )}</text>
</svg>`;
}

function buildPromoLayout(spec: NativeSocialImageSpec): string {
  const w = spec.width;
  const h = spec.height;
  const t = esc(spec.title.slice(0, 100));
  const sub = spec.subtitle ? esc(spec.subtitle.slice(0, 100)) : "";
  const cta = spec.line3 ? esc(spec.line3.slice(0, 80)) : "Learn more";
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <radialGradient id="rg" cx="0.3" cy="0.2" r="1">
      <stop offset="0%" stop-color="${esc(spec.accent)}" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="${esc(spec.background)}" stop-opacity="1"/>
    </radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#rg)"/>
  <text x="48" y="${Math.floor(h * 0.38)}" fill="#f8fafc" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="${Math.floor(
    w / 14
  )}" font-weight="800">${t}</text>
  <text x="48" y="${Math.floor(h * 0.5)}" fill="#cbd5e1" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="${Math.floor(
    w / 20
  )}">${sub}</text>
  <rect x="48" y="${Math.floor(h * 0.58)}" width="${Math.min(420, w - 96)}" height="48" rx="8" fill="${esc(spec.accent)}" opacity="0.9"/>
  <text x="64" y="${Math.floor(h * 0.58) + 32}" fill="#0f172a" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="18" font-weight="700">${cta}</text>
  <text x="48" y="${h - 32}" fill="#94a3b8" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="12">${footerLine(
    spec
  )}</text>
</svg>`;
}

function buildEventLayout(spec: NativeSocialImageSpec): string {
  const w = spec.width;
  const h = spec.height;
  const t = esc(spec.title.slice(0, 120));
  const when = spec.line3 ? esc(spec.line3.slice(0, 100)) : "";
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="100%" height="100%" fill="${esc(spec.background)}"/>
  <text x="48" y="64" fill="${esc(spec.accent)}" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="12" font-weight="700" letter-spacing="0.1em">EVENT</text>
  <text x="48" y="${Math.floor(h * 0.4)}" fill="#f1f5f9" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="${Math.floor(
    w / 18
  )}" font-weight="700">${t}</text>
  <text x="48" y="${Math.floor(h * 0.55)}" fill="#94a3b8" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="${Math.floor(
    w / 24
  )}">${when}</text>
  <text x="48" y="${h - 40}" fill="#64748b" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="13">${footerLine(
    spec
  )}</text>
</svg>`;
}

function buildTipLayout(spec: NativeSocialImageSpec): string {
  const w = spec.width;
  const h = spec.height;
  const t = esc(spec.title.slice(0, 160));
  const sub = spec.subtitle ? esc(spec.subtitle.slice(0, 200)) : "";
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="100%" height="100%" fill="${esc(spec.background)}"/>
  <rect x="48" y="40" width="80" height="28" rx="6" fill="${esc(spec.accent)}" opacity="0.25"/>
  <text x="56" y="60" fill="${esc(spec.accent)}" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="12" font-weight="700">TIP</text>
  <text x="48" y="${Math.floor(h * 0.4)}" fill="#f8fafc" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="${Math.floor(
    w / 20
  )}" font-weight="600">${t}</text>
  <text x="48" y="${Math.floor(h * 0.55)}" fill="#94a3b8" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="${Math.floor(
    w / 26
  )}">${sub}</text>
  <text x="48" y="${h - 40}" fill="#64748b" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="12">${footerLine(
    spec
  )}</text>
</svg>`;
}

function buildProLayout(spec: NativeSocialImageSpec): string {
  const w = spec.width;
  const h = spec.height;
  const t = esc(spec.title.slice(0, 120));
  const sub = spec.subtitle ? esc(spec.subtitle.slice(0, 150)) : "";
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="100%" height="100%" fill="#0f172a"/>
  <g opacity="0.08" stroke="#ffffff">
    <line x1="0" y1="0" x2="${w}" y2="${h}"/>
    <line x1="${w}" y1="0" x2="0" y2="${h}"/>
  </g>
  <line x1="48" y1="100" x2="220" y2="100" stroke="${esc(spec.accent)}" stroke-width="3"/>
  <text x="48" y="${Math.floor(h * 0.4)}" fill="#e2e8f0" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="${Math.floor(
    w / 20
  )}" font-weight="600" letter-spacing="-0.02em">${t}</text>
  <text x="48" y="${Math.floor(h * 0.52)}" fill="#94a3b8" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="${Math.floor(
    w / 28
  )}">${sub}</text>
  <text x="48" y="${h - 40}" fill="#64748b" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="12">${footerLine(
    spec
  )}</text>
</svg>`;
}

/**
 * Renders a branded SVG document suitable for static hosting.
 */
export function buildNativeSocialImageSvg(spec: NativeSocialImageSpec): string {
  const layout = spec.layout ?? "card";
  switch (layout) {
    case "quote":
      return buildQuoteLayout(spec);
    case "promo":
      return buildPromoLayout(spec);
    case "event":
      return buildEventLayout(spec);
    case "tip":
      return buildTipLayout(spec);
    case "pro":
      return buildProLayout(spec);
    case "square":
      return buildCardLike(spec, true);
    case "card":
    default:
      return buildCardLike(spec, true);
  }
}

export function svgToUtf8Buffer(svg: string): Buffer {
  return Buffer.from(svg, "utf8");
}

export function svgDataUrl(svg: string): string {
  const b64 = Buffer.from(svg, "utf8").toString("base64");
  return `data:image/svg+xml;base64,${b64}`;
}
