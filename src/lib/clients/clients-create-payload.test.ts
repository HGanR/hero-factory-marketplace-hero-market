import test from "node:test";
import assert from "node:assert/strict";
import {
  validateCreateClientPayload,
  validatePatchClientBody,
  validatePatchClientLogoPayload,
} from "./clients-create-payload";

const minimal = {
  first_name: "A",
  last_name: "B",
  email: "a@b.co",
  phone: null,
  address: {
    line1: "1 Main",
    city: "NYC",
    state: "NY",
    postal_code: "10001",
    country: "USA",
  },
};

test("validateCreateClientPayload succeeds with USA country alias", () => {
  const r = validateCreateClientPayload(minimal);
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.value.countryCode, "US");
});

test("validateCreateClientPayload rejects unknown country", () => {
  const r = validateCreateClientPayload({
    ...minimal,
    address: { ...minimal.address, country: "Atlantis" },
  });
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.status, 400);
    assert.match(r.error, /Unknown country/i);
  }
});

test("validateCreateClientPayload coerces short phone to null", () => {
  const r = validateCreateClientPayload({
    ...minimal,
    phone: "12",
  });
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.value.phone, null);
});

test("validatePatchClientLogoPayload accepts null", () => {
  const r = validatePatchClientLogoPayload({ business_logo_data_url: null });
  assert.equal(r.ok, true);
});

test("validatePatchClientBody accepts requested_services only", () => {
  const r = validatePatchClientBody({ requested_services: ["TRUST", "WEBSITE"] });
  assert.equal(r.ok, true);
  if (r.ok) assert.deepEqual(r.value.requested_services, ["TRUST", "WEBSITE"]);
});

test("validatePatchClientBody accepts logo only", () => {
  const r = validatePatchClientBody({ business_logo_data_url: null });
  assert.equal(r.ok, true);
});

test("validatePatchClientBody rejects empty body", () => {
  const r = validatePatchClientBody({});
  assert.equal(r.ok, false);
});

test("validatePatchClientBody rejects invalid requested_services entry", () => {
  const r = validatePatchClientBody({ requested_services: ["NOT VALID"] });
  assert.equal(r.ok, false);
});

test("validateCreateClientPayload trims email", () => {
  const r = validateCreateClientPayload({
    ...minimal,
    email: "  a@b.co  ",
  });
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.value.email, "a@b.co");
});

test("validateCreateClientPayload accepts requested_services array", () => {
  const r = validateCreateClientPayload({
    ...minimal,
    requested_services: ["TRUST", "WEBSITE", "AI AGENT"],
  });
  assert.equal(r.ok, true);
  if (r.ok) assert.deepEqual(r.value.requested_services, ["TRUST", "WEBSITE", "AI AGENT"]);
});

test("validateCreateClientPayload defaults omitted requested_services to []", () => {
  const r = validateCreateClientPayload(minimal);
  assert.equal(r.ok, true);
  if (r.ok) assert.deepEqual(r.value.requested_services, []);
});

test("validateCreateClientPayload rejects invalid requested_services entry", () => {
  const r = validateCreateClientPayload({
    ...minimal,
    requested_services: ["NOT A REAL SERVICE"],
  });
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.status, 400);
    assert.match(r.error, /requested_services/i);
  }
});
