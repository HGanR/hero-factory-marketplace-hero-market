import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  normalizeExecutiveInboxUploadFile,
  resolveExecutiveInboxUploadMime,
} from "@/lib/executive-inbox/executive-inbox-upload-mime";

describe("executive-inbox-upload-mime", () => {
  it("infers zip mime from filename when browser sends empty type", () => {
    assert.equal(resolveExecutiveInboxUploadMime("", "client-site.zip"), "application/zip");
    assert.equal(
      resolveExecutiveInboxUploadMime("application/octet-stream", "project.zip"),
      "application/zip",
    );
  });

  it("normalizes File objects for upload", () => {
    const raw = new File([new Uint8Array([1, 2, 3])], "demo.zip", { type: "" });
    const norm = normalizeExecutiveInboxUploadFile(raw);
    assert.equal(norm.type, "application/zip");
    assert.equal(norm.name, "demo.zip");
  });
});
