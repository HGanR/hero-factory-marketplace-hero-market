/**
 * @jest-environment node
 */
import { describe, expect, it, jest } from "@jest/globals";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { JarvaDocumentAssemblyReadinessPanel } from "./JarvaDocumentAssemblyReadinessPanel";

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children }: { href: string; children: React.ReactNode }) =>
    React.createElement("a", { href }, children),
}));

describe("JarvaDocumentAssemblyReadinessPanel", () => {
  const tid = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

  it("renders readiness UI when at least one flag is true", () => {
    const html = renderToStaticMarkup(
      <JarvaDocumentAssemblyReadinessPanel
        trustId={tid}
        hints={{
          ppmDraftReadyForGeneration: true,
          certificatePackageReady: false,
          bondDocumentationReady: false,
          trustReviewPacketReady: false,
          lines: [],
        }}
      />
    );
    expect(html).toContain("jarva-document-assembly-readiness");
    expect(html).toContain("PPM draft assembly");
    expect(html).not.toContain("Certificate package");
    expect(html).toContain(`/trusts/${tid}/issue-security`);
    expect(html).toContain("Open Issue Security");
    expect(html).toContain("Continue in Issue Security");
  });

  it("uses Trust Records Certificates tab for certificate readiness", () => {
    const html = renderToStaticMarkup(
      <JarvaDocumentAssemblyReadinessPanel
        trustId={tid}
        hints={{
          ppmDraftReadyForGeneration: false,
          certificatePackageReady: true,
          bondDocumentationReady: false,
          trustReviewPacketReady: false,
          lines: [],
        }}
      />
    );
    expect(html).toContain("tab=registry");
    expect(html).toContain("Open Certificates");
    expect(html).not.toContain("PPM draft assembly");
  });

  it("uses Trust Records Bonds tab for bond readiness", () => {
    const html = renderToStaticMarkup(
      <JarvaDocumentAssemblyReadinessPanel
        trustId={tid}
        hints={{
          ppmDraftReadyForGeneration: false,
          certificatePackageReady: false,
          bondDocumentationReady: true,
          trustReviewPacketReady: false,
          lines: [],
        }}
      />
    );
    expect(html).toContain("tab=bonds");
    expect(html).toContain("Open Bonds");
  });

  it("renders nothing when no signals", () => {
    const html = renderToStaticMarkup(
      <JarvaDocumentAssemblyReadinessPanel
        trustId={tid}
        hints={{
          ppmDraftReadyForGeneration: false,
          certificatePackageReady: false,
          bondDocumentationReady: false,
          trustReviewPacketReady: false,
          lines: [],
        }}
      />
    );
    expect(html).toBe("");
  });

  it("can render supporting lines without booleans", () => {
    const html = renderToStaticMarkup(
      <JarvaDocumentAssemblyReadinessPanel
        trustId={tid}
        hints={{
          ppmDraftReadyForGeneration: false,
          certificatePackageReady: false,
          bondDocumentationReady: false,
          trustReviewPacketReady: false,
          lines: ["**DRAFT** — counsel review still required."],
        }}
      />
    );
    expect(html).toContain("jarva-document-assembly-readiness");
    expect(html).toMatch(/DRAFT/);
  });
});
