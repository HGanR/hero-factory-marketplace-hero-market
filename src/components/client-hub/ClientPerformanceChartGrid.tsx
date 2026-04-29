"use client";

import { ClientMetricTrendCard } from "@/components/client-hub/ClientMetricTrendCard";

type SeriesMap = {
  leads: { label: string; value: number }[];
  conversations: { label: string; value: number }[];
  messages: { label: string; value: number }[];
  bookings: { label: string; value: number }[];
};

export function ClientPerformanceChartGrid({ series }: { series: SeriesMap }) {
  return (
    <section className="grid gap-3 md:grid-cols-2">
      <ClientMetricTrendCard title="Leads over time" points={series.leads} />
      <ClientMetricTrendCard title="Conversations over time" points={series.conversations} />
      <ClientMetricTrendCard title="Widget messages over time" points={series.messages} />
      <ClientMetricTrendCard title="Bookings over time" points={series.bookings} />
    </section>
  );
}
