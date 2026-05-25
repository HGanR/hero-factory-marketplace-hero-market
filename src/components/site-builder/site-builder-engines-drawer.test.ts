import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SiteBuilderEnginesDrawer } from "@/components/site-builder/SiteBuilderEnginesDrawer";

test("engines drawer renders children when open", () => {
  const html = renderToStaticMarkup(
    createElement(
      SiteBuilderEnginesDrawer,
      { open: true, onClose: () => {}, children: createElement("div", { "data-testid": "engines-body" }, "X") },
    ),
  );
  assert.match(html, /engines-body/);
  assert.match(html, /Engines/);
});
