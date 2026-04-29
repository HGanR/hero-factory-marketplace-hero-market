"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AdminElementPreviewCard from "@/components/oasis/AdminElementPreviewCard";
import GlbPreview from "@/components/oasis/GlbPreview";
import { isModelFile, openFilePicker, pickFirstFile } from "@/lib/oasisUploadUtils";
import GlbUploadSection, { type GlbUploadStatus } from "@/components/oasis/GlbUploadSection";
import MobileWalletButton from "@/components/MobileWalletButton";
import { useAccount, useDisconnect } from "wagmi";
import LibraryElementEditor from "@/components/oasis/LibraryElementEditor";

type Category = { id: number; name: string; slug: string };
type Currency = "TROO" | "TROO_POO" | "XRP" | "SOL" | "POL" | "BTC" | "ETH" | "BNB" | "USDC";
type AdminElementRow = {
  id: number;
  categoryId: number;
  name: string;
  slug?: string | null;
  description: string | null;
  assetUri: string;
  previewImageUri: string | null;
  creatorWallet?: string | null;
  payoutSplits?: string | null;
  acceptedCurrencies?: string | null;
  price?: string;
  currency?: string;
  createdAt: string;
};

function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

export default function OasisElementsAdminPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategorySlug, setNewCategorySlug] = useState("");

  const [elementName, setElementName] = useState("");
  const [elementSlug, setElementSlug] = useState("");
  const [elementDescription, setElementDescription] = useState("");
  const [creatorWallet, setCreatorWallet] = useState("");
  const [payoutSplits, setPayoutSplits] = useState<Array<{ wallet: string; pct: string }>>([{ wallet: "", pct: "" }]);
  const [acceptedCurrencies, setAcceptedCurrencies] = useState<Currency[]>(["TROO"]);
  const [categoryId, setCategoryId] = useState<number | "">("");
  const [assetFile, setAssetFile] = useState<File | null>(null);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const assetFileInputRef = useRef<HTMLInputElement | null>(null);
  const previewFileInputRef = useRef<HTMLInputElement | null>(null);
  const [assetDragOver, setAssetDragOver] = useState(false);
  const [previewDragOver, setPreviewDragOver] = useState(false);
  const [assetSource, setAssetSource] = useState<"local" | "ipfs">("local");
  const [localModels, setLocalModels] = useState<string[]>([]);
  const [localPreviews, setLocalPreviews] = useState<string[]>([]);
  const [selectedLocalModel, setSelectedLocalModel] = useState<string>("");
  const [selectedLocalPreview, setSelectedLocalPreview] = useState<string>("");
  const [price, setPrice] = useState<string>("0");
  const [currency, setCurrency] = useState<Currency>("TROO");
  const [busy, setBusy] = useState(false);
  const [ipfsUploadStatus, setIpfsUploadStatus] = useState<GlbUploadStatus>("idle");
  const [ipfsUploadMessage, setIpfsUploadMessage] = useState<string>("");

  const [elements, setElements] = useState<AdminElementRow[]>([]);
  const [previewId, setPreviewId] = useState<number | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editSlug, setEditSlug] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editCategoryId, setEditCategoryId] = useState<number | "">("");
  const [editAssetUri, setEditAssetUri] = useState("");
  const [editPreviewUri, setEditPreviewUri] = useState<string>("");
  const [editPrice, setEditPrice] = useState<string>("0");
  const [editCurrency, setEditCurrency] = useState<Currency>("TROO");

  // If an admin connects a wallet, auto-fill the Creator Payout Wallet field (but don't overwrite manual edits).
  useEffect(() => {
    if (!isConnected || !address) return;
    setCreatorWallet((prev) => (prev.trim() ? prev : String(address)));
  }, [isConnected, address]);

  useEffect(() => {
    try {
      const isAdmin = localStorage.getItem("adminLoggedIn") === "true";
      if (!isAdmin) router.push("/admin");
    } catch {
      router.push("/admin");
    }
  }, [router]);

  function throwIfUnauthorized(res: Response, data: any) {
    if (res.status === 401) {
      throw new Error("Admin session expired. Please log in again on /admin.");
    }
    if (!res.ok) {
      throw new Error(data?.error || `Request failed (${res.status})`);
    }
  }

  async function loadCategories() {
    const res = await fetch("/api/admin/oasis/categories");
    const raw = await res.text();
    const data = raw ? JSON.parse(raw) : {};
    throwIfUnauthorized(res, data);
    setCategories(Array.isArray(data.categories) ? data.categories : []);
  }

  async function loadLocalAssets() {
    const res = await fetch("/api/admin/oasis/models");
    const data = await res.json();
    throwIfUnauthorized(res, data);
    setLocalModels(Array.isArray(data.models) ? data.models : []);
    setLocalPreviews(Array.isArray(data.previews) ? data.previews : []);
  }

  async function loadElements() {
    const res = await fetch("/api/admin/oasis/elements");
    const data = await res.json();
    throwIfUnauthorized(res, data);
    setElements(Array.isArray(data.elements) ? data.elements : []);
    // Keep preview selection stable; do not auto-select (a broken model should never crash the page on load).
    setPreviewId((prev) => {
      const list = Array.isArray(data.elements) ? (data.elements as AdminElementRow[]) : [];
      if (prev && list.some((e) => e.id === prev)) return prev;
      return null;
    });
  }

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        await loadCategories();
        await loadLocalAssets();
        await loadElements();
      } catch (e: any) {
        const msg = e?.message || "Failed to load admin data";
        alert(msg);
        if (String(msg).toLowerCase().includes("admin session expired")) {
          router.push("/admin");
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function isImageFile(file: File) {
    const type = (file.type || "").toLowerCase();
    return type.startsWith("image/");
  }

  const canCreateCategory = useMemo(() => newCategoryName.trim().length >= 2, [newCategoryName]);
  const canUploadElement = useMemo(() => {
    if (busy) return false;
    if (!elementName.trim() || !categoryId) return false;
    if (assetSource === "local") return !!selectedLocalModel;
    // For IPFS uploads, require a creator payout wallet (used for payouts + stored as metadata).
    if (!creatorWallet.trim()) return false;
    return !!assetFile;
  }, [elementName, categoryId, assetFile, busy, assetSource, selectedLocalModel, creatorWallet]);

  async function createCategory() {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/oasis/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCategoryName, slug: newCategorySlug || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      throwIfUnauthorized(res, data);
      setNewCategoryName("");
      setNewCategorySlug("");
      await loadCategories();
    } catch (e: any) {
      const msg = e?.message || "Failed to create category";
      alert(msg);
      if (String(msg).toLowerCase().includes("admin session expired")) router.push("/admin");
    } finally {
      setBusy(false);
    }
  }

  async function uploadElement() {
    if (!categoryId) return;
    setBusy(true);
    setIpfsUploadStatus("idle");
    setIpfsUploadMessage("");
    try {
      // Yield so the "Working…" button state renders before any heavier sync work.
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const normalizeSplits = () => {
        const cleaned = payoutSplits
          .map((s) => ({ wallet: s.wallet.trim(), pct: s.pct.trim() }))
          .filter((s) => s.wallet.length > 0);
        if (cleaned.length <= 1) return null; // single payout handled by creatorWallet

        // Compute pct values: if none specified, equal split; else distribute remaining equally among blanks.
        const specified = cleaned
          .map((s) => ({ wallet: s.wallet, pct: s.pct ? Number(s.pct) : null }))
          .filter((s) => s.wallet);
        const specifiedSum = specified.reduce((acc, s) => acc + (s.pct ?? 0), 0);
        if (!Number.isFinite(specifiedSum) || specifiedSum > 100.000001) {
          throw new Error("Payout splits total percent must be <= 100");
        }
        const blanks = specified.filter((s) => s.pct === null);
        const remaining = Math.max(0, 100 - specifiedSum);
        const fill = blanks.length ? remaining / blanks.length : 0;
        const final = specified.map((s) => ({ wallet: s.wallet, pct: s.pct ?? fill }));
        // Drop any zeros
        const filtered = final.filter((s) => s.wallet && s.pct > 0);
        return filtered.length ? filtered : null;
      };

      if (assetSource === "local") {
        const splits = normalizeSplits();
        const res = await fetch("/api/admin/oasis/elements", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: elementName,
            slug: elementSlug || undefined,
            description: elementDescription,
            categoryId,
            assetUri: selectedLocalModel,
            previewImageUri: selectedLocalPreview || null,
            creatorWallet: creatorWallet || undefined,
            payoutSplits: splits || undefined,
            acceptedCurrencies,
            price,
            currency,
          }),
        });
        const data = await res.json().catch(() => ({}));
        throwIfUnauthorized(res, data);

        setElementName("");
        setElementSlug("");
        setElementDescription("");
        setCreatorWallet("");
        setPayoutSplits([{ wallet: "", pct: "" }]);
        setAcceptedCurrencies(["TROO"]);
        setCategoryId("");
        setSelectedLocalModel("");
        setSelectedLocalPreview("");
        setPrice("0");
        setCurrency("TROO");
        await loadElements();
        alert("Element added to library.");
        return;
      }

      if (!assetFile) return;
      if (!creatorWallet.trim()) {
        setIpfsUploadStatus("error");
        setIpfsUploadMessage("Creator payout wallet is required for IPFS uploads.");
        return;
      }
      const n = assetFile.name?.toLowerCase?.() || "";
      if (!n.endsWith(".glb") && !n.endsWith(".gltf")) {
        setIpfsUploadStatus("error");
        setIpfsUploadMessage("Asset must be a .glb or .gltf file");
        return;
      }
      const splits = normalizeSplits();
      const form = new FormData();
      form.set("name", elementName);
      form.set("slug", elementSlug || slugify(elementName));
      form.set("description", elementDescription);
      form.set("categoryId", String(categoryId));
      if (creatorWallet.trim()) form.set("creatorWallet", creatorWallet.trim());
      if (splits) form.set("payoutSplits", JSON.stringify(splits));
      form.set("acceptedCurrencies", acceptedCurrencies.join(","));
      form.set("price", price);
      form.set("currency", currency);
      form.set("asset", assetFile);
      if (previewFile) form.set("preview", previewFile);

      const res = await fetch("/api/admin/oasis/elements", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      throwIfUnauthorized(res, data);

      setElementName("");
      setElementSlug("");
      setElementDescription("");
      setCreatorWallet("");
      setPayoutSplits([{ wallet: "", pct: "" }]);
      setAcceptedCurrencies(["TROO"]);
      setCategoryId("");
      setAssetFile(null);
      setPreviewFile(null);
      setSelectedLocalModel("");
      setSelectedLocalPreview("");
      setPrice("0");
      setCurrency("TROO");
      await loadElements();
      setIpfsUploadStatus("success");
      setIpfsUploadMessage(
        data?.assetUri
          ? `✓ Element uploaded. Asset: ${String(data.assetUri)}`
          : "✓ Element uploaded."
      );
    } catch (e: any) {
      const msg = e?.message || "Failed to upload element";
      setIpfsUploadStatus("error");
      setIpfsUploadMessage(msg);
      if (String(msg).toLowerCase().includes("admin session expired")) router.push("/admin");
    } finally {
      setBusy(false);
    }
  }

  async function startEdit(el: AdminElementRow) {
    setEditId(el.id);
    setEditName(el.name);
    setEditSlug(String(el.slug ?? ""));
    setEditDescription(el.description || "");
    setEditCategoryId(el.categoryId);
    setEditAssetUri(el.assetUri);
    setEditPreviewUri(el.previewImageUri || "");
    setEditPrice(String(el.price ?? "0"));
    setEditCurrency(((el.currency as Currency) ?? "TROO") as Currency);
  }

  async function saveEdit() {
    if (!editId) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/oasis/elements", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editId,
          name: editName,
          slug: editSlug || undefined,
          description: editDescription,
          categoryId: editCategoryId,
          assetUri: editAssetUri,
          previewImageUri: editPreviewUri || null,
          price: editPrice,
          currency: editCurrency,
        }),
      });
      const data = await res.json().catch(() => ({}));
      throwIfUnauthorized(res, data);
      setEditId(null);
      await loadElements();
      alert("Element updated (library updated for everyone).");
    } catch (e: any) {
      const msg = e?.message || "Failed to update element";
      alert(msg);
      if (String(msg).toLowerCase().includes("admin session expired")) router.push("/admin");
    } finally {
      setBusy(false);
    }
  }

  async function deleteElement(id: number) {
    if (!confirm("Delete this element from the library?")) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/oasis/elements", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json().catch(() => ({}));
      throwIfUnauthorized(res, data);
      if (editId === id) setEditId(null);
      await loadElements();
    } catch (e: any) {
      const msg = e?.message || "Failed to delete element";
      alert(msg);
      if (String(msg).toLowerCase().includes("admin session expired")) router.push("/admin");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="w-full px-6 py-6 border-b border-white/10 bg-slate-900/60 backdrop-blur">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">OASIS ELEMENTS</h1>
            <p className="text-sm text-slate-300">Manage Custom World Elements categories + uploads</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <Link href="/admin" className="text-slate-300 hover:text-white underline">
              Admin
            </Link>
            <Link href="/oasis" className="text-slate-300 hover:text-white underline">
              OASIS
            </Link>
            <Link href="/modeling" className="text-slate-300 hover:text-white underline">
              MODELING
            </Link>
            <Link href="/dashboard" className="text-slate-300 hover:text-white underline">
              Dashboard
            </Link>

            <div className="ml-2 flex items-center gap-2">
              {isConnected && address ? (
                <>
                  <div className="text-xs text-slate-300 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                    Connected:{" "}
                    <span className="font-mono text-white">
                      {String(address).slice(0, 6)}…{String(address).slice(-4)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => disconnect()}
                    className="px-4 py-2 bg-white/10 hover:bg-white/15 border border-white/20 text-white font-semibold rounded-lg transition-colors"
                  >
                    Disconnect
                  </button>
                </>
              ) : (
                <MobileWalletButton />
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">
        <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-lg font-semibold">Categories</h2>
          <p className="text-sm text-slate-300 mt-2">
            These categories are what users will see on the OASIS “World Elements” tiles.
          </p>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <div className="md:col-span-1">
              <label className="text-xs text-slate-400">Category Name</label>
              <input
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                className="mt-1 w-full rounded-lg bg-slate-950/40 border border-white/10 px-3 py-2"
                placeholder="e.g. Furniture"
              />
            </div>
            <div className="md:col-span-1">
              <label className="text-xs text-slate-400">Slug (optional)</label>
              <input
                value={newCategorySlug}
                onChange={(e) => setNewCategorySlug(e.target.value)}
                className="mt-1 w-full rounded-lg bg-slate-950/40 border border-white/10 px-3 py-2"
                placeholder="e.g. furniture"
              />
            </div>
            <div className="md:col-span-1 flex items-end">
              <button
                disabled={!canCreateCategory || busy}
                onClick={createCategory}
                className="w-full px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-black font-semibold rounded-lg disabled:opacity-50"
              >
                {busy ? "Working…" : "Add Category"}
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {categories.length === 0 ? (
              <div className="text-slate-300">No categories yet.</div>
            ) : (
              categories.map((c) => (
                <div key={c.id} className="rounded-xl border border-white/10 bg-slate-950/30 p-4">
                  <div className="font-semibold">{c.name}</div>
                  <div className="text-xs text-slate-400 mt-1">{c.slug}</div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-lg font-semibold">Upload Element</h2>
          <p className="text-sm text-slate-300 mt-2">
            Upload a model from your computer (Desktop) via <span className="text-white">Upload to IPFS</span>, or reference a file already bundled in{" "}
            <span className="text-white">public/models/</span> via <span className="text-white">Local</span>.
          </p>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="text-xs text-slate-400">Asset Source</label>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setAssetSource("local")}
                  className={`px-3 py-2 rounded-lg border text-sm ${
                    assetSource === "local" ? "bg-cyan-500/20 border-cyan-400/60" : "bg-white/5 border-white/10 hover:bg-white/10"
                  }`}
                >
                  Local (public/models)
                </button>
                <button
                  type="button"
                  onClick={() => setAssetSource("ipfs")}
                  className={`px-3 py-2 rounded-lg border text-sm ${
                    assetSource === "ipfs" ? "bg-cyan-500/20 border-cyan-400/60" : "bg-white/5 border-white/10 hover:bg-white/10"
                  }`}
                >
                  Upload to IPFS
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-400">Element Name</label>
              <input
                value={elementName}
                onChange={(e) => {
                  const v = e.target.value;
                  setElementName(v);
                  // If slug is empty or matches previous slugified name, keep it in sync.
                  setElementSlug((prev) => (prev.trim() ? prev : slugify(v)));
                }}
                className="mt-1 w-full rounded-lg bg-slate-950/40 border border-white/10 px-3 py-2"
                placeholder="e.g. Marble Table"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400">Slug</label>
              <input
                value={elementSlug}
                onChange={(e) => setElementSlug(slugify(e.target.value))}
                className="mt-1 w-full rounded-lg bg-slate-950/40 border border-white/10 px-3 py-2"
                placeholder="e.g. marble-table"
              />
              <div className="text-[11px] text-slate-400 mt-1">
                Used as a stable identifier. If left blank, it defaults from the name.
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-400">Category</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : "")}
                className="mt-1 w-full rounded-lg bg-slate-950/40 border border-white/10 px-3 py-2"
              >
                <option value="">Select…</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          <div>
            <label className="text-xs text-slate-400">Price</label>
            <input
              type="number"
              min={0}
              step="0.000001"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="mt-1 w-full rounded-lg bg-slate-950/40 border border-white/10 px-3 py-2"
              placeholder="0"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400">Currency</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value as Currency)}
              className="mt-1 w-full rounded-lg bg-slate-950/40 border border-white/10 px-3 py-2"
            >
              <option value="TROO">TROO</option>
              <option value="TROO_POO">TROO POO</option>
              <option value="POL">POL</option>
              <option value="XRP">XRP</option>
              <option value="SOL">SOL</option>
                <option value="BTC">BTC</option>
                <option value="ETH">ETH</option>
                <option value="BNB">BNB</option>
                <option value="USDC">USDC</option>
            </select>
          </div>
            <div>
              <label className="text-xs text-slate-400">Creator Payout Wallet (optional for now)</label>
              <input
                value={creatorWallet}
                onChange={(e) => setCreatorWallet(e.target.value)}
                className="mt-1 w-full rounded-lg bg-slate-950/40 border border-white/10 px-3 py-2"
                placeholder="Wallet address to receive creator revenue"
              />
              <div className="text-[11px] text-slate-400 mt-1">
                Used by the purchase flow to route funds to the creator + treasury.
              </div>
            </div>
            <div className="md:col-span-2">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <label className="text-xs text-slate-400">Additional Payout Beneficiaries (optional)</label>
                <button
                  type="button"
                  onClick={() => setPayoutSplits((prev) => [...prev, { wallet: "", pct: "" }])}
                  className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-xs"
                >
                  + Add payout beneficiary
                </button>
              </div>
              <div className="mt-2 grid gap-2">
                {payoutSplits.map((row, idx) => (
                  <div key={idx} className="grid gap-2 md:grid-cols-[1fr_140px_80px] items-center">
                    <input
                      value={row.wallet}
                      onChange={(e) => {
                        const v = e.target.value;
                        setPayoutSplits((prev) => prev.map((p, i) => (i === idx ? { ...p, wallet: v } : p)));
                      }}
                      className="w-full rounded-lg bg-slate-950/40 border border-white/10 px-3 py-2 text-sm"
                      placeholder={idx === 0 ? "Primary payout wallet (creator)" : "Beneficiary wallet address"}
                    />
                    <input
                      value={row.pct}
                      onChange={(e) => {
                        const v = e.target.value;
                        setPayoutSplits((prev) => prev.map((p, i) => (i === idx ? { ...p, pct: v } : p)));
                      }}
                      className="w-full rounded-lg bg-slate-950/40 border border-white/10 px-3 py-2 text-sm"
                      placeholder="% (optional)"
                    />
                    <button
                      type="button"
                      onClick={() => setPayoutSplits((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)))}
                      disabled={payoutSplits.length <= 1}
                      className="px-3 py-2 rounded-lg bg-red-500/20 border border-red-500/40 hover:bg-red-500/30 text-xs disabled:opacity-50"
                      title="Remove"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
              <div className="text-[11px] text-slate-400 mt-2">
                If percents are blank, we split equally across the listed wallets. If some percents are provided, the remainder is split equally across blanks.
                Total must be ≤ 100%.
              </div>
            </div>
            <div className="md:col-span-1">
              <label className="text-xs text-slate-400">Accepted Currencies</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {(["TROO","TROO_POO","POL","XRP","SOL","BTC","ETH","BNB","USDC"] as Currency[]).map((c) => (
                  <label key={c} className="inline-flex items-center gap-2 text-xs text-slate-200 border border-white/10 bg-white/5 rounded-lg px-2 py-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={acceptedCurrencies.includes(c)}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setAcceptedCurrencies((prev) => {
                          const next = checked ? Array.from(new Set([...prev, c])) : prev.filter((x) => x !== c);
                          return next.length ? next : [currency];
                        });
                      }}
                    />
                    {c}
                  </label>
                ))}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                Used by the Oasis World purchase UI to show valid payment options.
              </div>
          </div>
            <div className="md:col-span-2">
              <label className="text-xs text-slate-400">Description (optional)</label>
              <textarea
                value={elementDescription}
                onChange={(e) => setElementDescription(e.target.value)}
                className="mt-1 w-full rounded-lg bg-slate-950/40 border border-white/10 px-3 py-2 min-h-[90px]"
                placeholder="Short description for the element…"
              />
            </div>
            {assetSource === "local" ? (
              <>
                <div>
                  <label className="text-xs text-slate-400">Local Model (required)</label>
                  <select
                    value={selectedLocalModel}
                    onChange={(e) => setSelectedLocalModel(e.target.value)}
                    className="mt-1 w-full rounded-lg bg-slate-950/40 border border-white/10 px-3 py-2"
                  >
                    <option value="">Select model…</option>
                    {localModels.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <div className="text-xs text-slate-400 mt-2">
                    Add files under <span className="text-white">public/models/</span> and they will appear here.
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-400">Local Preview (optional)</label>
                  <select
                    value={selectedLocalPreview}
                    onChange={(e) => setSelectedLocalPreview(e.target.value)}
                    className="mt-1 w-full rounded-lg bg-slate-950/40 border border-white/10 px-3 py-2"
                  >
                    <option value="">None</option>
                    {localPreviews.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            ) : (
              <>
                <div className="md:col-span-2">
                  <label className="text-xs text-slate-400">Asset File (required)</label>
                  <GlbUploadSection
                    file={assetFile}
                    onFileChange={(f) => setAssetFile(f)}
                    uploading={busy}
                    onUpload={uploadElement}
                    status={ipfsUploadStatus}
                    message={ipfsUploadMessage}
                    walletAddress={creatorWallet.trim() || undefined}
                    isConnected={Boolean(creatorWallet.trim())}
                    requireWallet={true}
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400">Preview Image (optional)</label>
                  <input
                    id="oasis-preview-file"
                    type="file"
                    accept="image/*"
                    onChange={(e) => setPreviewFile(e.target.files?.[0] || null)}
                    className="hidden"
                    ref={previewFileInputRef}
                  />
                  <div
                    className={[
                      "mt-2 rounded-xl border border-dashed p-3 transition",
                      previewDragOver ? "border-cyan-300 bg-cyan-500/10" : "border-white/15 bg-white/5",
                    ].join(" ")}
                    onDragEnter={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setPreviewDragOver(true);
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setPreviewDragOver(true);
                      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setPreviewDragOver(false);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setPreviewDragOver(false);
                      const f = pickFirstFile(e.dataTransfer);
                      if (!f) return;
                      if (!isImageFile(f)) {
                        alert("Please drop an image file (png/jpg/webp).");
                        return;
                      }
                      setPreviewFile(f);
                    }}
                  >
                    <div className="flex items-center gap-3 flex-wrap">
                    <button
                      type="button"
                      className="inline-flex items-center justify-center rounded-lg bg-white/5 border border-white/15 px-4 py-2 text-sm font-semibold text-white cursor-pointer select-none hover:bg-white/10 hover:border-white/25 active:scale-[0.99] transition"
                      title="Choose an image file"
                      onPointerDown={() => openFilePicker(previewFileInputRef.current)}
                      onClick={() => openFilePicker(previewFileInputRef.current)}
                    >
                      Choose Preview Image
                    </button>
                    <div className="text-xs text-slate-300">
                      {previewFile ? (
                        <>
                          Selected: <span className="text-white font-semibold">{previewFile.name}</span>
                        </>
                      ) : (
                        <span className="text-slate-400">No image selected</span>
                      )}
                    </div>
                    </div>
                    <div className="mt-2 text-[11px] text-slate-400">
                      Tip: you can also drag & drop an <span className="text-white">image</span> here.
                    </div>
                  </div>
                </div>
              </>
            )}

            <div className="md:col-span-2">
              <button
                disabled={!canUploadElement}
                onClick={uploadElement}
                className="w-full px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-black font-semibold rounded-lg disabled:opacity-50"
              >
                {busy ? "Working…" : assetSource === "local" ? "Add to Library" : "Upload Element"}
              </button>
              {assetSource === "ipfs" ? (
                <div className="text-xs text-slate-400 mt-2">
                  Requires your server IPFS provider to be configured in Vercel (recommended: IPFS_PROVIDER=pinata + PINATA_JWT).
                </div>
              ) : null}
            </div>

            {/* Selected Library Element Preview (radio selection below renders here) */}
            <div className="md:col-span-2">
              <div className="mt-4 rounded-2xl border border-white/10 bg-slate-900/40 p-4">
                <div className="text-sm font-semibold text-white">Preview Selected Library Element</div>
                <div className="text-xs text-slate-400 mt-1">
                  Select an element (radio button) below to preview it here.
                </div>
                <div className="mt-3">
                  {(() => {
                    if (!previewId) {
                      return (
                        <div className="rounded-xl border border-white/10 bg-slate-950/30 p-4 text-sm text-slate-300">
                          No element selected.
                        </div>
                      );
                    }
                    const selected = elements.find((e) => e.id === previewId);
                    if (!selected) {
                      return (
                        <div className="rounded-xl border border-white/10 bg-slate-950/30 p-4 text-sm text-slate-300">
                          Selected element not found.
                        </div>
                      );
                    }
                    return (
                      <LibraryElementEditor
                        element={selected}
                        walletAddress={address ? String(address) : undefined}
                        creatorWallet={creatorWallet}
                        onSaved={async () => {
                          await loadElements();
                        }}
                      />
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>

          {/* Library Elements (moved here from the bottom section for faster workflow) */}
          <div className="mt-8 border-t border-white/10 pt-6">
            <h3 className="text-lg font-semibold">Library Elements</h3>
            <p className="text-sm text-slate-300 mt-2">
              These are the items users can place. Updating an element updates the library for everyone. Already-placed items will keep their original snapshot.
            </p>

            {elements.length === 0 ? (
              <div className="mt-4 text-slate-300">No elements yet.</div>
            ) : (
              <div className="mt-4 space-y-3">
                  {elements.map((el) => {
                    const isEditing = editId === el.id;
                    return (
                      <div key={el.id} className="rounded-xl border border-white/10 bg-slate-950/30 p-4">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div className="flex items-start gap-3">
                            <label className="mt-1 inline-flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
                              <input
                                type="radio"
                                name="oasis-element-preview"
                                checked={previewId === el.id}
                                onChange={() => setPreviewId(el.id)}
                              />
                              Preview
                            </label>
                            <div>
                              <div className="font-semibold">{el.name}</div>
                              <div className="text-xs text-slate-400 mt-1">
                                #{el.id} • Category {el.categoryId} • {el.assetUri}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => (isEditing ? setEditId(null) : startEdit(el))}
                              className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-sm"
                            >
                              {isEditing ? "Close" : "Edit"}
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteElement(el.id)}
                              className="px-3 py-2 rounded-lg bg-red-500/20 border border-red-500/40 hover:bg-red-500/30 text-sm text-red-200"
                            >
                              Delete
                            </button>
                          </div>
                        </div>

                        {isEditing ? (
                          <div className="mt-4 grid gap-3 md:grid-cols-2">
                            <div>
                              <label className="text-xs text-slate-400">Name</label>
                              <input
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="mt-1 w-full rounded-lg bg-slate-950/40 border border-white/10 px-3 py-2"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-slate-400">Slug</label>
                              <input
                                value={editSlug}
                                onChange={(e) => setEditSlug(slugify(e.target.value))}
                                className="mt-1 w-full rounded-lg bg-slate-950/40 border border-white/10 px-3 py-2"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-slate-400">Category</label>
                              <select
                                value={editCategoryId}
                                onChange={(e) => setEditCategoryId(e.target.value ? Number(e.target.value) : "")}
                                className="mt-1 w-full rounded-lg bg-slate-950/40 border border-white/10 px-3 py-2"
                              >
                                <option value="">Select…</option>
                                {categories.map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="md:col-span-2">
                              <label className="text-xs text-slate-400">Description</label>
                              <textarea
                                value={editDescription}
                                onChange={(e) => setEditDescription(e.target.value)}
                                className="mt-1 w-full rounded-lg bg-slate-950/40 border border-white/10 px-3 py-2 min-h-[80px]"
                              />
                            </div>

                            <div>
                              <label className="text-xs text-slate-400">Local Model</label>
                              <select
                                value={editAssetUri}
                                onChange={(e) => setEditAssetUri(e.target.value)}
                                className="mt-1 w-full rounded-lg bg-slate-950/40 border border-white/10 px-3 py-2"
                              >
                                <option value={el.assetUri}>{el.assetUri}</option>
                                {localModels.map((m) => (
                                  <option key={m} value={m}>
                                    {m}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="text-xs text-slate-400">Preview (optional)</label>
                              <select
                                value={editPreviewUri}
                                onChange={(e) => setEditPreviewUri(e.target.value)}
                                className="mt-1 w-full rounded-lg bg-slate-950/40 border border-white/10 px-3 py-2"
                              >
                                <option value="">None</option>
                                {localPreviews.map((p) => (
                                  <option key={p} value={p}>
                                    {p}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label className="text-xs text-slate-400">Price</label>
                              <input
                                type="number"
                                min={0}
                                step="0.000001"
                                value={editPrice}
                                onChange={(e) => setEditPrice(e.target.value)}
                                className="mt-1 w-full rounded-lg bg-slate-950/40 border border-white/10 px-3 py-2"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-slate-400">Currency</label>
                              <select
                                value={editCurrency}
                                onChange={(e) => setEditCurrency(e.target.value as Currency)}
                                className="mt-1 w-full rounded-lg bg-slate-950/40 border border-white/10 px-3 py-2"
                              >
                                <option value="TROO">TROO</option>
                                <option value="TROO_POO">TROO POO</option>
                                <option value="POL">POL</option>
                                <option value="XRP">XRP</option>
                                <option value="SOL">SOL</option>
                              </select>
                            </div>

                            <div className="md:col-span-2">
                              <button
                                type="button"
                                onClick={saveEdit}
                                disabled={busy || !editName.trim() || !editCategoryId || !editAssetUri}
                                className="w-full px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-black font-semibold rounded-lg disabled:opacity-50"
                              >
                                {busy ? "Saving…" : "Save Changes"}
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}


