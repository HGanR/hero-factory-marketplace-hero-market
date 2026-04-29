import type { AssetStrategy, DeploymentTarget, RoutingMode } from "@/lib/site-builder/refinement-schema";
import type { SiteSchemaDocumentType } from "@/lib/site-builder/schema";

export type ReadmeContext = {
  target: DeploymentTarget;
  routingMode: RoutingMode;
  assetStrategy: AssetStrategy;
  remoteUrlsNote?: boolean;
};

function manifestBlurb(target: DeploymentTarget): string[] {
  const lines = [
    `## Machine-readable manifests`,
    `- **site.tokens.json** — site title, style/theme hints, deployment settings, route list, asset registry summary.`,
    `- **site.content-map.json** — per-page block types, target-specific file paths, bundled media paths, “where to edit” hints.`,
  ];
  if (target === "wordpress_theme") {
    lines.push(`- *WordPress:* both JSON files live in this theme folder next to \`style.css\`.`);
  }
  return lines;
}

function whereToEditSection(target: DeploymentTarget): string[] {
  const lines = [`## Where to edit what`, ``];
  switch (target) {
    case "vercel_nextjs":
      lines.push(`- **Copy & sections:** \`app/<segment>/page.tsx\` wires components; section HTML lives in \`components/site-builder-export/<route>/*.tsx\` (replace with real React over time).`);
      lines.push(`- **Global layout / SEO:** \`app/layout.tsx\`.`);
      lines.push(`- **Styling:** \`app/globals.css\` (includes builder CSS).`);
      lines.push(`- **Assets:** \`public/images\`, \`public/video\`, \`public/icons\` (bundle step may add files when strategy is “bundle locally”).`);
      break;
    case "wordpress_theme":
      lines.push(`- **Landing body:** \`template-parts/site-export-front-main.php\`.`);
      lines.push(`- **Nav links:** \`template-parts/site-export-nav.php\` (update if WordPress permalinks differ).`);
      lines.push(`- **Extra routes:** optional \`template-*.php\` files — assign in the page editor or merge into standard pages.`);
      lines.push(`- **Styling:** \`style.css\` (full builder stylesheet).`);
      lines.push(`- **Assets:** \`assets/images\`, \`assets/video\`.`);
      lines.push(`- **Hooks:** \`functions.php\` for enqueue and theme supports.`);
      break;
    case "gohighlevel_embed":
      lines.push(`- **Funnel body:** paste \`embed/section.html\` into a **Custom HTML** block.`);
      lines.push(`- **Full document:** \`embed/full-page.html\` for preview or iframe embeds.`);
      lines.push(`- **Styling:** \`embed/styles.css\` — link in page header custom code or host on your CDN.`);
      lines.push(`- **Script:** \`embed/script.js\` — load after markup; keep minimal for CSP.`);
      lines.push(`- **Assets:** \`embed/assets/images\`, \`embed/assets/video\`.`);
      break;
    case "static":
    case "netlify_static":
    case "ipfs":
    case "custom":
    default:
      lines.push(`- **Copy & structure:** one \`.html\` per route at the ZIP root (e.g. \`index.html\`, \`about.html\`).`);
      lines.push(`- **Styling:** \`styles.css\`.`);
      lines.push(`- **Behavior:** \`scripts.js\` (light stub; extend as needed).`);
      lines.push(`- **Assets:** \`assets/images\`, \`assets/video\`, \`assets/icons\` — see \`assets/README.txt\`.`);
  }
  lines.push(``);
  return lines;
}

function limitationsSection(target: DeploymentTarget, routingMode: RoutingMode): string[] {
  const lines = [`## Limitations`, ``];
  switch (target) {
    case "vercel_nextjs":
      lines.push(`- Export is a **handoff starter**, not production auth/CMS/analytics — add those in your app.`);
      lines.push(`- Section files use \`dangerouslySetInnerHTML\`; sanitize or refactor before user-generated content goes live.`);
      if (routingMode === "multi_page") {
        lines.push(`- **Multi-page:** each route is a separate App Router folder; shared chrome belongs in \`layout.tsx\` or shared components.`);
      }
      break;
    case "wordpress_theme":
      lines.push(`- This is a **classic theme**, not a plugin — no builder UI inside wp-admin.`);
      lines.push(`- \`front-page.php\` mirrors exported HTML; WordPress blocks/widgets are not auto-mapped.`);
      lines.push(`- Set **Settings → Reading** for a static front page if needed; create real WP pages for long-term CMS workflows.`);
      if (routingMode === "multi_page") {
        lines.push(`- **Multi-page:** \`template-*.php\` files mirror builder routes; you still assign templates or paste content in admin.`);
      }
      break;
    case "gohighlevel_embed":
      lines.push(
        `- **GoHighLevel (GHL)** is **section-first**; there is no full site router — one embed per funnel step is typical.`,
      );
      lines.push(`- Third-party scripts and remote CSS may be constrained by GHL CSP — test in a real funnel.`);
      if (routingMode === "multi_page") {
        lines.push(`- **Multi-page:** see \`embed/MULTI_PAGE_NOTE.md\` — duplicate the section per step or host extra HTML elsewhere.`);
      }
      break;
    case "static":
    case "netlify_static":
    case "ipfs":
    case "custom":
    default:
      lines.push(`- **No server runtime** — forms, auth, and dynamic data need another service or host.`);
      lines.push(`- **Asset strategy:** with “remote URLs”, links stay as-is; “bundle locally” only includes files the server could read at export time.`);
      if (routingMode === "multi_page") {
        lines.push(`- **Multi-page:** navigation is a lightweight bar with relative links; adjust if you move files into subfolders.`);
      }
  }
  lines.push(``);
  return lines;
}

export function buildDeploymentReadme(ctx: ReadmeContext, schema?: SiteSchemaDocumentType): string {
  const { target, routingMode, assetStrategy, remoteUrlsNote = false } = ctx;
  const pay = schema?.metadata?.paymentIntegration;
  const lines: string[] = [
    `# Site builder export`,
    ``,
    `Agency handoff package generated from the Hero site builder. Use this README with **site.tokens.json** and **site.content-map.json** for automation or onboarding.`,
    ``,
    `## Deployment summary`,
    `- **Target:** \`${target}\``,
    `- **Routing:** ${routingMode.replace("_", " ")}`,
    `- **Assets:** ${assetStrategy.replace("_", " ")}`,
    ``,
    `## AI Agency widget`,
    `If **site.tokens.json** shows \`site.widget.attached: true\`, this handoff includes the Agency widget bootstrap (\`TROO_AGENT_CONFIG\` + \`/widget/loader.js\`) where the target allows it. Set **metadata.widgetIntegration.loaderOrigin** (or **NEXT_PUBLIC_SITE_URL** at export time) to your app’s public origin, and allow the deployed domain on the widget in AI Agency.`,
    ``,
  ];

  if (pay?.provider === "paypal") {
    lines.push(
      `## PayPal payment surface`,
      `**site.tokens.json** includes \`site.payment\` when PayPal is configured in the builder. Hosted **payment links** and **buy button** snippets are injected into exported HTML per **metadata.paymentIntegration.placement** (CTA area, page end, or global footer). SDK mode exports a visible placeholder until you wire the PayPal JS SDK client-side.`,
      ``,
    );
  }

  if (remoteUrlsNote) {
    lines.push(`> Note: Remote URL mode was requested; see asset section below.`, ``);
  }

  if (assetStrategy === "local_bundle") {
    lines.push(
      `Empty **.gitkeep** folders mark where media belongs. Binaries are copied into the ZIP only when uploads exist on the server at export time.`,
    );
  } else {
    lines.push(
      `**Remote asset URLs** from your schema are preserved. App-hosted paths (e.g. \`/api/site-builder/assets/...\`) only work while this application serves them — switch to **bundle locally** for fully portable ZIPs.`,
    );
  }
  lines.push(``);

  lines.push(`## What was generated`, ``);
  switch (target) {
    case "static":
      lines.push(`- Static HTML pages, shared **styles.css**, **scripts.js**, and **assets/** placeholders.`);
      lines.push(`- Entry: **index.html**. Multi-page exports add one \`.html\` per route with a small top-of-page nav.`);
      break;
    case "vercel_nextjs":
      lines.push(`- Next.js **App Router** project: \`app/layout.tsx\`, \`app/globals.css\`, \`app/page.tsx\`, and optional \`app/<segment>/page.tsx\`.`);
      lines.push(`- Section markup split under **components/site-builder-export/** with \`display: contents\` wrappers.`);
      lines.push(`- **public/** holds bundled media; **package.json** / **tsconfig.json** / **next.config.ts** are ready for \`npm install\` / \`npm run build\`.`);
      break;
    case "netlify_static":
      lines.push(`- Same as static export plus **netlify.toml** (publish = \`.\`).`);
      break;
    case "ipfs":
      lines.push(`- Static HTML/CSS/JS with **relative** asset paths suitable for IPFS gateways.`);
      break;
    case "wordpress_theme":
      lines.push(`- Complete **classic theme** folder: **style.css**, **functions.php**, **header.php**, **footer.php**, **front-page.php**, **page.php**, **index.php**, **template-parts/**.`);
      lines.push(`- Optional **template-*.php** files mirror extra builder routes when routing is multi-page.`);
      break;
    case "gohighlevel_embed":
      lines.push(`- **embed/** kit: **section.html**, **full-page.html**, **styles.css**, **script.js**, **embed/assets/**.`);
      lines.push(`- Root **README** + manifests describe paste points; **MULTI_PAGE_NOTE.md** appears when multiple routes exist.`);
      break;
    case "custom":
    default:
      lines.push(`- Generic static layout (HTML, CSS, JS, assets) for you to adapt to a custom stack.`);
  }
  lines.push(``);

  lines.push(...whereToEditSection(target));

  lines.push(`## Run & deploy`, ``);
  switch (target) {
    case "static":
      lines.push(`1. Upload the entire folder to your host (S3, Cloudflare Pages, GitHub Pages, etc.).`);
      lines.push(`2. Ensure **index.html** is the default document.`);
      break;
    case "vercel_nextjs":
      lines.push(`1. \`npm install\``);
      lines.push(`2. \`npm run dev\` locally; \`npm run build\` then \`npm start\` or deploy with [Vercel](https://vercel.com).`);
      lines.push(`3. Connect this directory as a Next.js project; no extra config required for a basic handoff.`);
      break;
    case "netlify_static":
      lines.push(`1. Drag-and-drop the folder to Netlify or connect a repo with publish directory \`.\`.`);
      lines.push(`2. **netlify.toml** already sets the publish root.`);
      break;
    case "ipfs":
      lines.push(`1. Pin the folder with your IPFS tooling; use a gateway that serves **index.html** at the root CID.`);
      lines.push(`2. Keep links relative — no dependency on this app’s origin.`);
      break;
    case "wordpress_theme":
      lines.push(`1. Zip the **theme folder** inside this export (the directory that contains **style.css**).`);
      lines.push(`2. WordPress admin → **Appearance → Themes → Add New → Upload**, or copy into \`wp-content/themes/\` and activate.`);
      lines.push(`3. Configure **Settings → Reading** and create pages in WP as needed — exported PHP is a starting point, not a full CMS mapping.`);
      break;
    case "gohighlevel_embed":
      lines.push(`1. Upload **embed/styles.css** and **embed/script.js** to GHL file storage or your CDN (note the final URLs).`);
      lines.push(`2. In the funnel/page, add **Custom HTML** and paste **embed/section.html**; add a **Custom Code** header block with \`<link>\` / \`<script src="...">\` pointing at your hosted CSS/JS.`);
      lines.push(`3. Prefer \`defer\` on **script.js** so it runs after the section markup.`);
      break;
    case "custom":
    default:
      lines.push(`1. Treat as static files; integrate into your pipeline (framework, CI, CDN) as needed.`);
  }
  lines.push(``);

  lines.push(...limitationsSection(target, routingMode));
  lines.push(...manifestBlurb(target));
  lines.push(``);

  lines.push(`---`, `Generated by Hero site builder export.`);
  return lines.join("\n");
}
