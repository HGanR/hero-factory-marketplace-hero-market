import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { zipSync } from "fflate";
import {
  extractBuilderSchemaJsonFromZipBuffer,
  probeSiteProjectZipBuffer,
} from "./executive-inbox-site-project.ts";
import {
  validateExecutiveInboxAttachmentsArray,
  EXECUTIVE_INBOX_UPLOAD_MIME_TYPES,
} from "./executive-inbox-attachments.ts";
import { SITE_BUILDER_SCHEMA_ZIP_PATH } from "@/lib/site-builder/project-export/builder-schema-artifact";

describe("executive inbox site project zip", () => {
  it("accepts zip mime types in upload allowlist", () => {
    assert.ok(EXECUTIVE_INBOX_UPLOAD_MIME_TYPES.has("application/zip"));
  });

  it("probes Next.js project markers", () => {
    const zip = zipSync({
      "package.json": new TextEncoder().encode('{"name":"demo"}'),
      "next.config.ts": new TextEncoder().encode("export default {}"),
      "app/page.tsx": new TextEncoder().encode("export default function Page(){return null}"),
    });
    const probe = probeSiteProjectZipBuffer(zip);
    assert.equal(probe.valid, true);
    assert.equal(probe.hasNextJsMarkers, true);
    assert.equal(probe.hasBuilderSchema, false);
  });

  it("extracts site.builder-schema.json for Site Builder import", () => {
    const schema = {
      version: "1",
      metadata: { title: "Demo" },
      pages: [{ slug: "/", blocks: [] }],
    };
    const zip = zipSync({
      [SITE_BUILDER_SCHEMA_ZIP_PATH]: new TextEncoder().encode(JSON.stringify(schema)),
      "package.json": new TextEncoder().encode('{"name":"demo"}'),
    });
    const raw = extractBuilderSchemaJsonFromZipBuffer(zip);
    assert.ok(raw);
    assert.match(raw, /"title": "Demo"/);
  });

  it("validates site_project attachment round-trip", () => {
    const row = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      kind: "site_project" as const,
      filename: "client-site.zip",
      mimeType: "application/zip",
      sizeBytes: 4096,
      url: "https://gateway.pinata.cloud/ipfs/QmTestHash1234567890",
      projectType: "vercel_nextjs" as const,
    };
    const validated = validateExecutiveInboxAttachmentsArray([row]);
    assert.ok(validated);
    assert.equal(validated?.[0]?.kind, "site_project");
  });
});
