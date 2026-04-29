// src/app/api/trust-records/[trustId]/jurisdiction/route.test.ts
import { JurisdictionUpdateSchema } from "./route";

// Simple API contract tests (can be run against a test server)
async function testJurisdictionAPI(baseUrl: string, trustId: string, authToken: string) {
  console.log("Testing Jurisdiction API...");

  // Test 1: GET existing jurisdiction
  const getResponse = await fetch(`${baseUrl}/api/trust-records/${trustId}/jurisdiction`, {
    headers: { "Authorization": `Bearer ${authToken}` }
  });

  if (getResponse.ok) {
    const getData = await getResponse.json();
    console.log("GET response:", getData);

    if (getData.ok && getData.jurisdiction) {
      // Validate response structure
      const jur = getData.jurisdiction;
      if (!jur.situsStateCode || !jur.objective || typeof jur.hasDigitalAssets !== 'boolean') {
        throw new Error("Invalid jurisdiction response structure");
      }
    }
  }

  // Test 2: PATCH jurisdiction update
  const updateData = {
    situsStateCode: "NV",
    objective: "ASSET_PROTECTION" as const,
    selfSettled: true,
    hasDigitalAssets: false,
    score: 85,
    reasons: ["Top tier jurisdiction", "Strong asset protection", "No state income tax"]
  };

  // Validate schema first
  const validation = JurisdictionUpdateSchema.safeParse(updateData);
  if (!validation.success) {
    throw new Error(`Schema validation failed: ${validation.error.message}`);
  }

  const patchResponse = await fetch(`${baseUrl}/api/trust-records/${trustId}/jurisdiction`, {
    method: "PATCH",
    headers: {
      "Authorization": `Bearer ${authToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(updateData)
  });

  if (!patchResponse.ok) {
    const errorData = await patchResponse.json();
    throw new Error(`PATCH failed: ${errorData.error?.message || patchResponse.statusText}`);
  }

  const patchData = await patchResponse.json();
  if (!patchData.ok) {
    throw new Error(`PATCH returned not ok: ${JSON.stringify(patchData)}`);
  }

  console.log("PATCH response:", patchData);

  // Test 3: Verify GET returns updated data
  const verifyResponse = await fetch(`${baseUrl}/api/trust-records/${trustId}/jurisdiction`, {
    headers: { "Authorization": `Bearer ${authToken}` }
  });

  if (!verifyResponse.ok) {
    throw new Error("Verification GET failed");
  }

  const verifyData = await verifyResponse.json();
  if (!verifyData.ok || !verifyData.jurisdiction) {
    throw new Error("Verification GET returned no jurisdiction");
  }

  const jur = verifyData.jurisdiction;
  if (jur.situsStateCode !== updateData.situsStateCode ||
      jur.objective !== updateData.objective ||
      jur.hasDigitalAssets !== updateData.hasDigitalAssets) {
    throw new Error("Updated jurisdiction data doesn't match");
  }

  console.log("✅ All API tests passed!");
}

// Export for use in test runners
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { testJurisdictionAPI };
}

// Example usage:
// testJurisdictionAPI("http://localhost:3000", "trust-123", "auth-token-here")
//   .catch(console.error);