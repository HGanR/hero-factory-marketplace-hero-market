"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Building2,
  Calendar,
  ExternalLink,
  FileText,
  Rocket,
  Trash2,
  Wallet,
} from "lucide-react";
import {
  createStarFleetDocument,
  deleteStarFleetDocument,
  deployStarFleetEntity,
  getStarFleetDeployment,
  getStarFleetEntityById,
  listStarFleetDocumentsByEntity,
  type StarFleetBlockchain,
  type StarFleetDocument,
  type StarFleetDocumentCategory,
  type StarFleetDeployment,
  type StarFleetEntity,
  updateStarFleetEntity,
} from "@/lib/starfleet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function StarFleetEntityDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const entityId = params?.id;

  const [entity, setEntity] = useState<StarFleetEntity | null>(null);
  const [tab, setTab] = useState<"overview" | "documents" | "blockchain">("overview");

  // Documents
  const [docs, setDocs] = useState<StarFleetDocument[]>([]);
  const [docCategory, setDocCategory] = useState<StarFleetDocumentCategory>("other");
  const [docBusy, setDocBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // Deployment
  const [deployment, setDeployment] = useState<StarFleetDeployment | null>(null);
  const [chain, setChain] = useState<StarFleetBlockchain>("polygon");
  const [ownerAddress, setOwnerAddress] = useState("");
  const [deployBusy, setDeployBusy] = useState(false);

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
    if (!entityId) return;
    setEntity(getStarFleetEntityById(entityId));
    setDocs(listStarFleetDocumentsByEntity(entityId));
    setDeployment(getStarFleetDeployment(entityId));

    const onStorage = () => {
      setEntity(getStarFleetEntityById(entityId));
      setDocs(listStarFleetDocumentsByEntity(entityId));
      setDeployment(getStarFleetDeployment(entityId));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [entityId]);

  const createdDate = useMemo(() => {
    if (!entity?.createdAt) return "—";
    try {
      return new Date(entity.createdAt).toLocaleDateString();
    } catch {
      return entity.createdAt;
    }
  }, [entity?.createdAt]);

  const explorerBase = useMemo(() => {
    const m: Record<StarFleetBlockchain, string> = {
      polygon: "https://polygonscan.com",
      ethereum: "https://etherscan.io",
      base: "https://basescan.org",
      xrp: "https://livenet.xrpl.org",
    };
    return deployment ? m[deployment.blockchain] : m[chain];
  }, [deployment, chain]);

  async function readFileAsDataUrl(file: File) {
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function onUploadDoc(files: FileList | null) {
    if (!entityId) return;
    const file = files?.[0];
    if (!file) return;

    // localStorage is small; keep this conservative
    const MAX_BYTES = 2 * 1024 * 1024; // 2MB
    if (file.size > MAX_BYTES) {
      alert("For the demo, please upload a file under 2MB (stored in localStorage).");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }

    setDocBusy(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      createStarFleetDocument({
        entityId,
        filename: file.name,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
        category: docCategory,
        dataUrl,
      });
      setDocs(listStarFleetDocumentsByEntity(entityId));
      if (fileRef.current) fileRef.current.value = "";
    } finally {
      setDocBusy(false);
    }
  }

  function onDeleteDoc(docId: string) {
    if (!entityId) return;
    if (!confirm("Delete this document from local Star Fleet storage?")) return;
    deleteStarFleetDocument(docId);
    setDocs(listStarFleetDocumentsByEntity(entityId));
  }

  function onSetStatus(next: StarFleetEntity["status"]) {
    if (!entityId) return;
    const updated = updateStarFleetEntity(entityId, { status: next });
    setEntity(updated);
  }

  function onDeploy() {
    if (!entityId) return;
    setDeployBusy(true);
    try {
      if (chain !== "xrp" && !ownerAddress.trim()) {
        alert("Please provide an owner wallet address for EVM chains (Polygon/Ethereum/Base).");
        return;
      }
      const next = deployStarFleetEntity({
        entityId,
        blockchain: chain,
        network: "testnet",
        ownerAddress: chain === "xrp" ? undefined : ownerAddress.trim(),
      });
      setDeployment(next);
    } finally {
      setDeployBusy(false);
    }
  }

  if (!entityId) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="w-full px-6 py-6 border-b border-white/10 bg-slate-900/60 backdrop-blur">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Building2 className="h-6 w-6 text-cyan-300" />
            <div>
              <h1 className="text-2xl font-bold">Entity Detail</h1>
              <p className="text-sm text-slate-300">Star Fleet entity record</p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <Link href="/star-fleet/entities" className="text-slate-300 hover:text-white underline">
              Back to Entities
            </Link>
            <Link href="/star-fleet" className="text-slate-300 hover:text-white underline">
              Star Fleet Home
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-10">
        {!entity ? (
          <div className="rounded-xl border border-white/10 bg-white/5 p-6">
            <div className="text-xl font-semibold">Entity Not Found</div>
            <div className="text-sm text-slate-300 mt-2">
              This entity doesn’t exist in this browser’s local Star Fleet storage.
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <Card className="border-white/10 bg-white/5">
              <CardHeader className="pb-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <CardTitle className="text-2xl break-words">{entity.name}</CardTitle>
                    <div className="mt-1 text-sm text-slate-300">
                      {entity.jurisdiction} • status: <span className="font-semibold">{entity.status}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="px-3 py-1 rounded-full text-xs border border-white/10 bg-slate-950/30 text-slate-200">
                      {entity.id}
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        onClick={() => onSetStatus("pending")}
                        className="h-8 px-3"
                        disabled={entity.status === "pending"}
                      >
                        Pending
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => onSetStatus("active")}
                        className="h-8 px-3"
                        disabled={entity.status === "active"}
                      >
                        Active
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => onSetStatus("closed")}
                        className="h-8 px-3"
                        disabled={entity.status === "closed"}
                      >
                        Closed
                      </Button>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                    <div className="text-xs text-slate-400">Created</div>
                    <div className="mt-2 flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-slate-300" />
                      <span className="text-slate-50">{createdDate}</span>
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                    <div className="text-xs text-slate-400">Wallet Address</div>
                    {entity.walletAddress ? (
                      <div className="mt-2 flex items-center justify-between gap-3">
                        <code className="text-xs break-all text-slate-50">{entity.walletAddress}</code>
                        <a
                          href={`${explorerBase}/address/${entity.walletAddress}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-cyan-300 hover:text-cyan-200 inline-flex items-center gap-1 text-xs"
                        >
                          View <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    ) : (
                      <div className="mt-2 text-sm text-slate-400">—</div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
              <TabsList className="w-full justify-start bg-slate-950 border border-slate-800">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="documents" className="gap-2">
                  <FileText className="h-4 w-4" />
                  Documents
                </TabsTrigger>
                <TabsTrigger value="blockchain" className="gap-2">
                  <Rocket className="h-4 w-4" />
                  Blockchain
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Entity Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {entity.businessPurpose ? (
                      <div>
                        <div className="text-xs text-slate-400">Business Purpose</div>
                        <div className="mt-2 whitespace-pre-wrap text-sm text-slate-100">
                          {entity.businessPurpose}
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-slate-300">
                        No business purpose recorded yet.
                      </div>
                    )}

                    <div className="flex flex-wrap gap-3">
                      <Button asChild variant="secondary" className="gap-2">
                        <Link href="/star-fleet/entities">
                          <Building2 className="h-4 w-4" />
                          Back to Entities
                        </Link>
                      </Button>
                      <Button asChild variant="secondary" className="gap-2">
                        <Link href="/star-fleet/plugins">
                          <Wallet className="h-4 w-4" />
                          Plugins
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="documents" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Entity Documents (local demo)</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="space-y-2 md:col-span-1">
                        <Label>Category</Label>
                        <Select value={docCategory} onValueChange={(v) => setDocCategory(v as StarFleetDocumentCategory)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="operating_agreement">Operating Agreement</SelectItem>
                            <SelectItem value="articles">Articles</SelectItem>
                            <SelectItem value="contract">Contract</SelectItem>
                            <SelectItem value="tax">Tax</SelectItem>
                            <SelectItem value="compliance">Compliance</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                        <div className="text-xs text-slate-400">
                          Demo storage: uploads are kept in this browser (localStorage).
                        </div>
                      </div>

                      <div className="space-y-2 md:col-span-2">
                        <Label>Upload (max 2MB)</Label>
                        <Input
                          ref={fileRef}
                          type="file"
                          accept=".pdf,.doc,.docx,.txt,image/*"
                          onChange={(e) => onUploadDoc(e.target.files)}
                          disabled={docBusy}
                        />
                      </div>
                    </div>

                    {docs.length === 0 ? (
                      <div className="text-sm text-slate-300">No documents yet. Upload one above.</div>
                    ) : (
                      <div className="space-y-3">
                        {docs.map((d) => (
                          <div
                            key={d.id}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950 p-4"
                          >
                            <div className="min-w-0">
                              <div className="font-medium break-words">{d.filename}</div>
                              <div className="text-xs text-slate-400">
                                {d.category} • {new Date(d.uploadedAt).toLocaleDateString()} •{" "}
                                {(d.sizeBytes / 1024).toFixed(1)} KB
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button asChild variant="secondary" className="h-9 gap-2">
                                <a href={d.dataUrl} download={d.filename}>
                                  <ExternalLink className="h-4 w-4" />
                                  Download
                                </a>
                              </Button>
                              <Button
                                variant="secondary"
                                className="h-9 gap-2"
                                onClick={() => onDeleteDoc(d.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                                Delete
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="blockchain" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Blockchain Deployment (demo)</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {deployment ? (
                      <div className="space-y-4">
                        <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                          <div className="text-xs text-slate-400">Deployed Network</div>
                          <div className="mt-1 font-semibold text-slate-50">
                            {deployment.blockchain} • {deployment.network}
                          </div>
                        </div>

                        <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                          <div className="text-xs text-slate-400">Contract Address</div>
                          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                            <code className="text-xs break-all text-slate-50">{deployment.contractAddress}</code>
                            {deployment.blockchain !== "xrp" ? (
                              <a
                                href={`${explorerBase}/address/${deployment.contractAddress}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-cyan-300 hover:text-cyan-200 inline-flex items-center gap-1 text-xs"
                              >
                                View <ExternalLink className="h-3 w-3" />
                              </a>
                            ) : null}
                          </div>
                        </div>

                        <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                          <div className="text-xs text-slate-400">Transaction Hash</div>
                          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                            <code className="text-xs break-all text-slate-50">{deployment.transactionHash}</code>
                            {deployment.blockchain !== "xrp" ? (
                              <a
                                href={`${explorerBase}/tx/${deployment.transactionHash}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-cyan-300 hover:text-cyan-200 inline-flex items-center gap-1 text-xs"
                              >
                                View <ExternalLink className="h-3 w-3" />
                              </a>
                            ) : null}
                          </div>
                        </div>

                        <div className="text-xs text-slate-400">
                          Demo note: this deployment is simulated for UX only.
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label>Blockchain</Label>
                            <Select value={chain} onValueChange={(v) => setChain(v as StarFleetBlockchain)}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="polygon">Polygon</SelectItem>
                                <SelectItem value="ethereum">Ethereum</SelectItem>
                                <SelectItem value="base">Base</SelectItem>
                                <SelectItem value="xrp">XRP Ledger</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {chain !== "xrp" ? (
                            <div className="space-y-2">
                              <Label>Owner Wallet Address</Label>
                              <Input
                                value={ownerAddress}
                                onChange={(e) => setOwnerAddress(e.target.value)}
                                placeholder="0x..."
                              />
                              <div className="text-xs text-slate-400">
                                This will be stored with the deployment record (demo).
                              </div>
                            </div>
                          ) : null}
                        </div>

                        <Button onClick={onDeploy} disabled={deployBusy} className="gap-2">
                          <Rocket className="h-4 w-4" />
                          {deployBusy ? "Deploying…" : "Deploy (Demo)"}
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>
    </div>
  );
}


