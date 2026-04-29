/**
 * Bentley-native URLs for Policy Deployments — query params only; no client-side deployment building.
 */

export function buildPolicyDeploymentsWorkbenchHref(input: {
  scenarioId?: string | null;
  rollbackPackageId?: string | null;
  rolloutPlanId?: string | null;
  clientId?: string | null;
  trustId?: string | null;
}): string {
  const sp = new URLSearchParams();
  const sid = input.scenarioId?.trim();
  const rid = input.rollbackPackageId?.trim();
  const pid = input.rolloutPlanId?.trim();
  const cid = input.clientId?.trim();
  const tid = input.trustId?.trim();
  if (sid) sp.set("scenarioId", sid);
  if (rid) sp.set("rollbackPackageId", rid);
  if (pid) sp.set("rolloutPlanId", pid);
  if (cid) sp.set("clientId", cid);
  if (tid) sp.set("trustId", tid);
  const q = sp.toString();
  return q ? `/dashboard/bentley/policy-deployments?${q}` : "/dashboard/bentley/policy-deployments";
}
