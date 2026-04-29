import type { ReactNode } from "react";
import { ClientHubSidebar } from "./ClientHubSidebar";
import { ClientHubTabs } from "./ClientHubTabs";

type Props = {
  clientId: string;
  clientName: string;
  children: ReactNode;
};

/**
 * Reusable client hub frame: dark shell, nav sidebar, section tabs, main area.
 * Keep Mission Path and personal onboarding UI out of this tree.
 */
export function ClientHubShell({ clientId, clientName, children }: Props) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <div className="mt-0 flex flex-col gap-6 lg:flex-row lg:items-start">
          <ClientHubSidebar clientId={clientId} clientName={clientName} />
          <div className="min-w-0 flex-1 space-y-4">
            <ClientHubTabs clientId={clientId} />
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
