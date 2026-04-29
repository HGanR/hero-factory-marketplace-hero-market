"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { HolographicCard, HOLO_TILE_SM } from "./HolographicCard";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

type ToolLink = { href: string; label: string };
type ToolSection = { title: string; links: ToolLink[] };

/** Build / Worlds / … / Trade — all tools except Developer + footer. */
export const DASHBOARD_TOOL_MAIN_SECTIONS: ToolSection[] = [
  {
    title: "Build",
    links: [
      { href: "/site-builder", label: "Site Builder" },
      { href: "/property-twin", label: "Property Twin" },
      { href: "/entity-maps", label: "Entity Mapping" },
      { href: "/trust-records?tab=settings", label: "Trust Records" },
      { href: "/seal-maker", label: "Seal Maker" },
      { href: "/trademark-prep", label: "Trademark Prep" },
      { href: "/copyright-steps", label: "Copyright Steps" },
    ],
  },
  {
    title: "Worlds",
    links: [
      { href: "/troo-town", label: "Troo Town" },
      { href: "/worlds", label: "World Explorer" },
      { href: "/star-fleet", label: "Star Fleet" },
    ],
  },
  {
    title: "Financial",
    links: [{ href: "/financial-readiness", label: "Financial Readiness Center" }],
  },
  {
    title: "Operate",
    links: [
      { href: "/app/agents", label: "AI Agency" },
      { href: "/ret", label: "RET" },
      { href: "/workflows", label: "Workflows" },
      { href: "/accounting", label: "Accounting" },
      { href: "/grant-writing", label: "Grant Writing" },
      { href: "/meet", label: "Meetings" },
      { href: "/avatars", label: "Avatar" },
      { href: "/wreck-room", label: "Wreck Room" },
      { href: "/platform/events", label: "Platform Activity" },
    ],
  },
  {
    title: "Community",
    links: [
      { href: "/community", label: "Community" },
      { href: "/mission-path", label: "Mission Path" },
      { href: "/ai-revenue-os", label: "Road Map" },
    ],
  },
  {
    title: "Trade",
    links: [
      { href: "/dashboard/market", label: "Crypto Market" },
      { href: "/nft-marketplace", label: "NFT Market" },
      { href: "/apps", label: "App Marketplace" },
      { href: "/merch-creation", label: "Merch Creation" },
      { href: "/securities", label: "Certified Securities" },
      { href: "/ai-revenue-os", label: "AI Revenue OS" },
    ],
  },
];

/** Developer / platform and legacy quick links */
export const DASHBOARD_TOOL_ADVANCED_SECTION: ToolSection = {
  title: "Developer",
  links: [
    { href: "/developers", label: "Developer Portal" },
    { href: "/platform-map", label: "Platform Map" },
  ],
};

export const DASHBOARD_FOOTER_LINKS: ToolLink[] = [
  { href: "/trust", label: "Digital Asset Trust" },
  { href: "/qr-maker", label: "QR Gen" },
  { href: "/otoco-mirror", label: "Otoco" },
];

function ModuleLink({ href, label }: ToolLink) {
  return (
    <Link
      href={href}
      className={`${HOLO_TILE_SM} block px-3 py-2.5 text-sm font-medium text-slate-100 hover:text-white transition-colors`}
    >
      {label}
    </Link>
  );
}

function CollapsibleToolsPanel({
  title,
  openLabel,
  defaultOpen = false,
  children,
  id,
}: {
  title: string;
  openLabel: string;
  defaultOpen?: boolean;
  children: ReactNode;
  id: string;
}) {
  return (
    <Collapsible id={id} defaultOpen={defaultOpen} className="rounded-xl border border-white/10 bg-black/20">
      <CollapsibleTrigger
        className="group flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-semibold text-cyan-100 hover:bg-white/5
          data-[state=open]:bg-white/[0.04] focus:outline-none focus:ring-2 focus:ring-cyan-400/40 rounded-xl"
      >
        {title}
        <span className="text-xs text-slate-500 font-normal">{openLabel}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t border-white/10 px-4 py-4">{children}</CollapsibleContent>
    </Collapsible>
  );
}

export function DashboardToolModules() {
  return (
    <HolographicCard accent="cyan">
      <div className="p-6">
        <h2 className="text-lg font-semibold text-cyan-100 mb-2 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-cyan-400/70" />
          Platform tools
        </h2>
        <p className="text-sm text-slate-400 mb-6">Same modules as the classic layout — group your own way.</p>

        <div className="space-y-4">
          <CollapsibleToolsPanel title="All Tools" openLabel="Expand" id="dashboard-all-tools">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-8">
              {DASHBOARD_TOOL_MAIN_SECTIONS.map((section) => (
                <div key={section.title}>
                  <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-3">
                    {section.title}
                  </h3>
                  <div className="flex flex-col gap-2">
                    {section.links.map((link) => (
                      <ModuleLink key={`${section.title}-${link.href}`} {...link} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CollapsibleToolsPanel>

          <CollapsibleToolsPanel title="Advanced" openLabel="Developer & links" id="dashboard-advanced-tools">
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-3">
                {DASHBOARD_TOOL_ADVANCED_SECTION.title}
              </h3>
              <div className="flex flex-col gap-2 mb-6">
                {DASHBOARD_TOOL_ADVANCED_SECTION.links.map((link) => (
                  <ModuleLink key={link.href} {...link} />
                ))}
              </div>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-3">Quick links</h3>
              <div className="flex flex-wrap gap-2">
                {DASHBOARD_FOOTER_LINKS.map((link) => (
                  <ModuleLink key={link.href} {...link} />
                ))}
              </div>
            </div>
          </CollapsibleToolsPanel>
        </div>
      </div>
    </HolographicCard>
  );
}
