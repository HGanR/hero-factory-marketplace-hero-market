import { renderToStaticMarkup } from "react-dom/server";
import { ClientMetricTrendCard } from "@/components/client-hub/ClientMetricTrendCard";

describe("ClientMetricTrendCard", () => {
  it("renders empty-state label when no data", () => {
    const html = renderToStaticMarkup(
      <ClientMetricTrendCard
        title="Leads over time"
        points={[
          { label: "Mon", value: 0 },
          { label: "Tue", value: 0 },
        ]}
      />,
    );
    expect(html).toContain("No historical data yet.");
  });

  it("renders bars when data exists", () => {
    const html = renderToStaticMarkup(
      <ClientMetricTrendCard
        title="Leads over time"
        points={[
          { label: "Mon", value: 1 },
          { label: "Tue", value: 3 },
        ]}
      />,
    );
    expect(html).toContain("Mon");
    expect(html).toContain("Tue");
  });
});
