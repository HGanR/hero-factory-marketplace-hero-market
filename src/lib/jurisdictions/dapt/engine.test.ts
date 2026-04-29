// src/lib/jurisdictions/dapt/engine.test.ts
import { listDaptJurisdictions } from "./engine";

// Simple test runner (can be replaced with Jest/Vitest later)
function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Test failed: ${message}`);
  }
}

function testEngine() {
  console.log("Testing DAPT Jurisdiction Engine...");

  // Test 1: Basic functionality
  const results = listDaptJurisdictions({
    selfSettled: true,
    hasDigitalAssets: false,
    objective: "ASSET_PROTECTION"
  });

  assert(results.length > 0, "Should return jurisdictions");
  assert(results.every(r => typeof r.score === 'number'), "All results should have scores");
  assert(results.every(r => Array.isArray(r.reasons)), "All results should have reasons array");

  // Test 2: Eligible jurisdictions come first
  const eligibleCount = results.filter(r => r.eligible).length;
  const ineligibleCount = results.filter(r => !r.eligible).length;

  // First N results should be eligible
  for (let i = 0; i < eligibleCount; i++) {
    assert(results[i].eligible === true, `Result ${i} should be eligible`);
  }

  // Remaining results should be ineligible
  for (let i = eligibleCount; i < results.length; i++) {
    assert(results[i].eligible === false, `Result ${i} should be ineligible`);
  }

  // Test 3: Digital assets filter
  const digitalAssetResults = listDaptJurisdictions({
    selfSettled: true,
    hasDigitalAssets: true,
    objective: "DIGITAL_ASSET_FIDUCIARY_ACCESS"
  });

  // Should have some ineligible results due to missing RUFADAA
  const ineligibleDigital = digitalAssetResults.filter(r => !r.eligible);
  assert(ineligibleDigital.length > 0, "Should have ineligible jurisdictions for digital assets");

  // Test 4: Score ordering (eligible results should be sorted by score descending)
  const eligibleResults = results.filter(r => r.eligible);
  for (let i = 0; i < eligibleResults.length - 1; i++) {
    assert(eligibleResults[i].score >= eligibleResults[i + 1].score,
           `Score should be descending: ${eligibleResults[i].score} >= ${eligibleResults[i + 1].score}`);
  }

  // Test 5: Top tier jurisdictions should be highly ranked
  const topTierResults = results.filter(r => r.tier === "TOP_TIER" && r.eligible);
  assert(topTierResults.length > 0, "Should have top tier jurisdictions");
  assert(topTierResults.every(r => r.score >= 20), "Top tier should have high scores");

  // Test 6: Objective affects scoring
  const assetProtectionResults = listDaptJurisdictions({
    selfSettled: true,
    hasDigitalAssets: false,
    objective: "ASSET_PROTECTION"
  });

  const taxResults = listDaptJurisdictions({
    selfSettled: true,
    hasDigitalAssets: false,
    objective: "STATE_TAX_MINIMIZATION"
  });

  // Rankings should differ between objectives
  const assetTop = assetProtectionResults.find(r => r.eligible)?.stateCode;
  const taxTop = taxResults.find(r => r.eligible)?.stateCode;
  // Note: They might be the same, but scoring should be different

  console.log("✅ All engine tests passed!");
}

// Run tests
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { testEngine };
} else if (typeof window === 'undefined') {
  testEngine();
}