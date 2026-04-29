/**
 * stdin: JSON `SiteSchemaDocument` — stdout: parity preview HTML (Tailwind CDN harness).
 * Invoked from Playwright via `tsx` so React SSR runs outside Playwright's bundled test harness
 * (which otherwise injects invalid element metadata and breaks `renderToStaticMarkup`).
 */
import fs from "fs";
import { buildPreviewParityHtmlString } from "../src/lib/site-builder/parity-preview-html";
import { SiteSchemaDocument } from "../src/lib/site-builder/schema";

const raw = fs.readFileSync(0, "utf8");
const doc = SiteSchemaDocument.parse(JSON.parse(raw));
process.stdout.write(buildPreviewParityHtmlString(doc));
