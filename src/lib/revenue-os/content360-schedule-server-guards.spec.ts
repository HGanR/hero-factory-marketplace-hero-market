import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertCampaignClientMatchesRequest } from "@/lib/revenue-os/content360-schedule-guards";

describe("assertCampaignClientMatchesRequest", () => {
  it("403 when client mismatch", () => {
    const r = assertCampaignClientMatchesRequest({
      campaignClientId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      requestClientId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.status, 403);
  });

  it("400 when campaign has no client", () => {
    const r = assertCampaignClientMatchesRequest({
      campaignClientId: "",
      requestClientId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.status, 400);
  });

  it("ok when ids match", () => {
    const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const r = assertCampaignClientMatchesRequest({
      campaignClientId: id,
      requestClientId: id,
    });
    assert.equal(r.ok, true);
  });
});
