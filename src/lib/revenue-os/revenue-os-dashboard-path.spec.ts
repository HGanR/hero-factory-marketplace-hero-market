/**
 * @jest-environment node
 */
import { isRevenueOsDashboardPath } from "@/lib/revenue-os/revenue-os-dashboard-path";

describe("isRevenueOsDashboardPath", () => {
  it("is true only for dashboard route segment", () => {
    expect(isRevenueOsDashboardPath("/revenue-os/dashboard")).toBe(true);
    expect(isRevenueOsDashboardPath("/revenue-os/dashboard/foo")).toBe(true);
    expect(isRevenueOsDashboardPath("/ai-revenue-os")).toBe(false);
    expect(isRevenueOsDashboardPath(null)).toBe(false);
  });
});
