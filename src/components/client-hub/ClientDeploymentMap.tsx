"use client";

import type { ClientCommandCenterPayload } from "@/lib/revenue-os/client-command-center-data";
import { ClientDeploymentNode } from "@/components/client-hub/ClientDeploymentNode";

export function ClientDeploymentMap({ deployment }: { deployment: ClientCommandCenterPayload["deployment"] }) {
  return (
    <section>
      <h2 className="text-sm font-semibold text-cyan-200/90">Deployment map</h2>
      <p className="mt-1 text-xs text-slate-500">Live wiring across client record, website, agent, widget, CRM, portal, and campaigns.</p>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {deployment.map((n) => (
          <ClientDeploymentNode key={n.key} node={n} />
        ))}
      </ul>
    </section>
  );
}
