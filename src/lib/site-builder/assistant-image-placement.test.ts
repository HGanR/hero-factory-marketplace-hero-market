import test from "node:test";
import assert from "node:assert/strict";
import {
  applyAssistantImagePlacement,
  parseImagePlacementFromPrompt,
  shouldAskImagePlacement,
  stripImagePlacementPhrasesFromPrompt,
} from "@/lib/site-builder/assistant-image-placement";

const asset = { assetId: "a1", publicUrl: "https://cdn.example/x.png", mimeType: "image/png" };

test("parseImagePlacementFromPrompt detects hero background", () => {
  assert.equal(parseImagePlacementFromPrompt("put this in the hero background"), "hero_background");
});

test("parseImagePlacementFromPrompt detects logo", () => {
  assert.equal(parseImagePlacementFromPrompt("use as logo please"), "logo");
});

test("parseImagePlacementFromPrompt returns null when unclear", () => {
  assert.equal(parseImagePlacementFromPrompt("make it nicer"), null);
});

test("shouldAskImagePlacement when attachments and no placement", () => {
  assert.equal(shouldAskImagePlacement("", 1), true);
  assert.equal(shouldAskImagePlacement("hero background", 1), false);
});

test("applyAssistantImagePlacement sets hero visual background", () => {
  const base = JSON.stringify({
    pages: [{ slug: "/", blocks: [{ type: "hero", content: { title: "T" } }] }],
    metadata: {},
  });
  const out = applyAssistantImagePlacement(base, "hero_background", asset);
  const doc = JSON.parse(out) as {
    pages: Array<{ blocks: Array<{ content?: { visual?: { background?: { value?: string } } } }> }>;
  };
  assert.equal(doc.pages[0].blocks[0].content?.visual?.background?.value, asset.publicUrl);
});

test("stripImagePlacementPhrasesFromPrompt leaves edit instruction after hero placement", () => {
  const raw = "hero background and add a pricing section with three tiers";
  assert.equal(parseImagePlacementFromPrompt(raw), "hero_background");
  assert.equal(
    stripImagePlacementPhrasesFromPrompt(raw, "hero_background"),
    "add a pricing section with three tiers",
  );
});

test("applyAssistantImagePlacement appends gallery image", () => {
  const base = JSON.stringify({
    pages: [{ slug: "/", blocks: [{ type: "image_grid", content: { images: [{ src: "old", alt: "a" }] } }] }],
    metadata: {},
  });
  const out = JSON.parse(applyAssistantImagePlacement(base, "gallery", asset)) as {
    pages: Array<{ blocks: Array<{ content?: { images?: Array<{ src?: string }> } }> }>;
  };
  const imgs = out.pages[0].blocks[0].content?.images;
  assert.ok(imgs && imgs.length >= 2);
  assert.equal(imgs?.[imgs.length - 1]?.src, asset.publicUrl);
});
