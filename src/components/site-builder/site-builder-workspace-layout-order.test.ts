import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SiteBuilderWorkspaceLayout } from "@/components/site-builder/SiteBuilderWorkspaceLayout";

test("workspace layout DOM order: assistant rail before preview (left assistant, right preview)", () => {
  const html = renderToStaticMarkup(
    createElement(SiteBuilderWorkspaceLayout, {
      assistant: createElement("div", { "data-testid": "assistant-rail" }, "AI"),
      preview: createElement("div", { "data-testid": "preview-rail" }, "Preview"),
    }),
  );
  const a = html.indexOf("data-testid=\"assistant-rail\"");
  const p = html.indexOf("data-testid=\"preview-rail\"");
  assert.ok(a >= 0 && p >= 0 && a < p, `expected assistant before preview, got:\n${html}`);
});
