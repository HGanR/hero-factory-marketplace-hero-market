"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Coins,
  Wallet,
  Globe,
  FileSignature,
  Users,
  TrendingUp,
  CheckCircle2,
  Plus,
} from "lucide-react";
import {
  installStarFleetPlugin,
  listStarFleetPluginsByEntity,
  loadStarFleetEntities,
  type StarFleetEntity,
  type StarFleetPluginInstall,
  type StarFleetPluginType,
} from "@/lib/starfleet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type PluginInfo = {
  id: StarFleetPluginType;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  features: string[];
  ctaHref?: string;
};

const plugins: PluginInfo[] = [
  {
    id: "token_minting",
    name: "Mint Tokens",
    description: "Issue an ERC-20 token on behalf of your entity (demo)",
    icon: <Coins className="h-6 w-6" />,
    color: "bg-yellow-500",
    features: ["Token name + symbol", "Supply configuration", "Multi-chain demo flow"],
    ctaHref: "/star-fleet/plugins/token-minting",
  },
  {
    id: "entity_wallet",
    name: "Entity Wallet",
    description: "Set up a company wallet to hold assets (demo)",
    icon: <Wallet className="h-6 w-6" />,
    color: "bg-blue-500",
    features: ["Dedicated wallet record", "Basic ownership metadata"],
  },
  {
    id: "ens",
    name: "ENS",
    description: "Create a subdomain name for your entity wallet (demo)",
    icon: <Globe className="h-6 w-6" />,
    color: "bg-purple-500",
    features: ["Human-readable names", "Wallet link placeholder"],
  },
  {
    id: "document_signing",
    name: "Sign Documents",
    description: "On-chain verifiable signatures (placeholder)",
    icon: <FileSignature className="h-6 w-6" />,
    color: "bg-green-500",
    features: ["Signature workflow placeholder", "Audit trail placeholder"],
  },
  {
    id: "member_management",
    name: "Add Members",
    description: "Ownership & member registry (placeholder)",
    icon: <Users className="h-6 w-6" />,
    color: "bg-indigo-500",
    features: ["Member directory", "Ownership allocation placeholder"],
  },
  {
    id: "otogo",
    name: "OtoGo",
    description: "Staking-based launchpool (placeholder)",
    icon: <TrendingUp className="h-6 w-6" />,
    color: "bg-pink-500",
    features: ["Fundraising placeholder", "Allocation placeholder"],
  },
];

export default function StarFleetPluginsPage() {
  const router = useRouter();
  const [entities, setEntities] = useState<StarFleetEntity[]>([]);
  const [entityId, setEntityId] = useState<string>("");
  const [installs, setInstalls] = useState<StarFleetPluginInstall[]>([]);

  useEffect(() => {
    try {
      const hasUser = !!localStorage.getItem("user");
      const hasAdmin = localStorage.getItem("adminLoggedIn") === "true";
      if (!hasUser && !hasAdmin) router.push("/");
    } catch {
      router.push("/");
    }
  }, [router]);

  useEffect(() => {
    const loaded = loadStarFleetEntities();
    setEntities(loaded);
    if (!entityId && loaded[0]?.id) setEntityId(loaded[0].id);
  }, [entityId]);

  useEffect(() => {
    if (!entityId) {
      setInstalls([]);
      return;
    }
    setInstalls(listStarFleetPluginsByEntity(entityId));
  }, [entityId]);

  const installedSet = useMemo(() => {
    const s = new Set<StarFleetPluginType>();
    for (const i of installs) {
      if (i.status === "active") s.add(i.pluginType);
    }
    return s;
  }, [installs]);

  function install(plugin: PluginInfo) {
    if (!entityId) return;
    installStarFleetPlugin(entityId, plugin.id);
    setInstalls(listStarFleetPluginsByEntity(entityId));
    if (plugin.ctaHref) router.push(plugin.ctaHref);
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="w-full px-6 py-6 border-b border-white/10 bg-slate-900/60 backdrop-blur">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">Star Fleet Plugins</h1>
            <p className="text-sm text-slate-300">Enable extra capabilities for an entity (demo)</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <Link href="/star-fleet" className="text-slate-300 hover:text-white underline">
              Back to Star Fleet
            </Link>
            <Link href="/star-fleet/entities" className="text-slate-300 hover:text-white underline">
              Entities
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-10 space-y-6">
        <Card className="border-white/10 bg-white/5">
          <CardHeader>
            <CardTitle>Select Entity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Select value={entityId} onValueChange={setEntityId}>
              <SelectTrigger className="max-w-xl">
                <SelectValue placeholder={entities.length ? "Select an entity..." : "Create an entity first"} />
              </SelectTrigger>
              <SelectContent>
                {entities.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name} ({e.jurisdiction})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!entities.length ? (
              <div className="text-sm text-slate-300">
                No entities yet.{" "}
                <Link href="/star-fleet/entities/new" className="text-cyan-300 hover:text-cyan-200 underline">
                  Create one
                </Link>{" "}
                to install plugins.
              </div>
            ) : null}
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {plugins.map((p) => {
            const installed = entityId ? installedSet.has(p.id) : false;
            return (
              <Card key={p.id} className="relative">
                {installed ? (
                  <div className="absolute top-4 right-4 inline-flex items-center gap-1 rounded-full bg-green-600/20 border border-green-600/40 px-3 py-1 text-xs text-green-200">
                    <CheckCircle2 className="h-3 w-3" />
                    Installed
                  </div>
                ) : null}
                <CardHeader>
                  <div className={`inline-flex p-3 rounded-lg ${p.color} text-white w-fit mb-2`}>{p.icon}</div>
                  <CardTitle>{p.name}</CardTitle>
                  <p className="text-sm text-slate-300">{p.description}</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="text-sm text-slate-300 space-y-1">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <span className="text-cyan-300 mt-0.5">•</span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="w-full gap-2"
                    variant={installed ? "secondary" : "default"}
                    disabled={!entityId || installed}
                    onClick={() => install(p)}
                  >
                    {installed ? (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        Installed
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4" />
                        Install
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}


