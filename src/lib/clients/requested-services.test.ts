import test from "node:test";
import assert from "node:assert/strict";
import { mergeRequestedServicesLists, parseRequestedServicesJson } from "./requested-services";

test("parseRequestedServicesJson returns [] for empty / invalid", () => {
  assert.deepEqual(parseRequestedServicesJson(null), []);
  assert.deepEqual(parseRequestedServicesJson(""), []);
  assert.deepEqual(parseRequestedServicesJson("not json"), []);
  assert.deepEqual(parseRequestedServicesJson("{}"), []);
});

test("parseRequestedServicesJson parses CRM-style JSON array", () => {
  const raw = JSON.stringify(["TRUST", "WEBSITE", "TRUST"]);
  assert.deepEqual(parseRequestedServicesJson(raw), ["TRUST", "WEBSITE"]);
});

test("mergeRequestedServicesLists keeps CRM order and appends hub-only", () => {
  assert.deepEqual(
    mergeRequestedServicesLists(["TRUST", "WEBSITE"], ["OS REVENUE", "TRUST"]),
    ["TRUST", "WEBSITE", "OS REVENUE"],
  );
});

test("workspace DTO helper: trust row CRM JSON maps to requestedServices list", () => {
  const crmJson = JSON.stringify(["LLC", "ACCOUNTING"]);
  assert.deepEqual(parseRequestedServicesJson(crmJson), ["LLC", "ACCOUNTING"]);
});
