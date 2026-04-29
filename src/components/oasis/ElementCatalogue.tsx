"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { startPlacement, type WorldCurrency } from "@/stores/worldStore";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Library } from "lucide-react";

type OasisElement = {
  id: number | string;
  name: string;
  description: string | null;
  assetUri: string;
  previewImageUri?: string | null;
  categoryId?: number | null;
  price?: string | number | null;
  currency?: string | null;
  tags?: string | string[] | null;
};

type Category = { id: number; name: string; slug: string };

export interface ElementCatalogueProps {
  onElementSelected?: (element: OasisElement) => void;
  canSelectElement?: (element: OasisElement) => boolean;
  onSelectBlocked?: (element: OasisElement) => void;
  disabled?: boolean;
  categories?: Category[];
  className?: string;
}

export function ElementCatalogue({
  onElementSelected,
  canSelectElement,
  onSelectBlocked,
  disabled = false,
  categories = [],
  className,
}: ElementCatalogueProps) {
  const [open, setOpen] = useState(false);
  const [elements, setElements] = useState<OasisElement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | "all">("all");

  const loadElements = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/oasis/elements");
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load elements");
      setElements(Array.isArray(data.elements) ? data.elements : []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load elements");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadElements();
  }, [loadElements]);

  const uniqueCategories = useMemo(() => {
    const seen = new Set<string>();
    const next: Category[] = [];
    for (const c of categories) {
      const key = (c.slug || c.name || "").toLowerCase().trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      next.push(c);
    }
    return next;
  }, [categories]);

  const filteredElements = useMemo(() => {
    let list = selectedCategoryId === "all" ? elements : elements.filter((e) => e.categoryId === selectedCategoryId);
    // Exclude static hub buildings – not placeable, interact-only
    list = list.filter((e) => {
      const tags = e.tags;
      if (!tags) return true;
      try {
        const arr = typeof tags === "string" ? JSON.parse(tags) : tags;
        if (!Array.isArray(arr)) return true;
        const lower = arr.map((t: string) => String(t).toLowerCase());
        if (lower.includes("hub") || lower.includes("not-for-sale")) return false;
      } catch {
        /* ignore */
      }
      return true;
    });
    return list;
  }, [elements, selectedCategoryId]);

  const handleSelect = (element: OasisElement) => {
    if (disabled) return;
    if (canSelectElement && !canSelectElement(element)) {
      onSelectBlocked?.(element);
      return;
    }
    const validCurrencies: WorldCurrency[] = ["TROO", "TROO_POO", "TROO_COIN"];
    const currency: WorldCurrency =
      validCurrencies.includes((element.currency || "TROO") as WorldCurrency)
        ? (element.currency as WorldCurrency)
        : "TROO";
    startPlacement({
      name: element.name,
      type: element.categoryId ? String(element.categoryId) : "custom",
      modelUrl: element.assetUri,
      category: element.categoryId ? String(element.categoryId) : "custom",
      price: element.price ? Number(element.price) : 0,
      currency,
      isStackable: true,
      isEnterable: false,
      isCustomizable: true,
      metadata: {
        source: "db",
        dbElementId: element.id,
        preview: element.previewImageUri,
        description: element.description,
      },
    });
    onElementSelected?.(element);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className={`gap-2 bg-cyan-500/20 border-cyan-500/50 hover:bg-cyan-500/30 text-cyan-300 ${className}`}
          disabled={disabled}
        >
          <Library className="h-4 w-4" />
          Element Catalogue
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-cyan-200">Element Catalogue</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-slate-400">
          Elements transferred from the Modeling Editor to the library. Select a category, then pick an element to place.
        </p>
        <div className="mt-3">
          <div className="text-xs font-semibold text-slate-300 mb-2">Categories</div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={`px-3 py-1.5 rounded-xl border text-sm ${
                selectedCategoryId === "all" ? "bg-slate-700 border-slate-500" : "border-slate-700 hover:border-slate-600"
              }`}
              onClick={() => setSelectedCategoryId("all")}
            >
              All
            </button>
            {uniqueCategories.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`px-3 py-1.5 rounded-xl border text-sm ${
                  selectedCategoryId === c.id ? "bg-slate-700 border-slate-500" : "border-slate-700 hover:border-slate-600"
                }`}
                onClick={() => setSelectedCategoryId(c.id)}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>
        <ScrollArea className="flex-1 min-h-[200px] mt-3 pr-2">
          {error ? (
            <div className="text-amber-200 text-sm py-4">{error}</div>
          ) : isLoading ? (
            <div className="text-slate-400 text-sm py-4">Loading elements…</div>
          ) : filteredElements.length === 0 ? (
            <div className="text-slate-400 text-sm py-4">
              No elements in this category. Add elements via Modeling Editor → Save to Oasis.
            </div>
          ) : (
            <div className="space-y-2 pb-4">
              {filteredElements.map((el) => {
                const priceLabel = el.price && el.currency ? `${el.price} ${String(el.currency).replace("_", " ")}` : null;
                return (
                  <button
                    key={el.id}
                    type="button"
                    onClick={() => handleSelect(el)}
                    className="w-full text-left rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 p-3 transition"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium truncate">{el.name}</span>
                      {priceLabel ? (
                        <span className="text-xs text-slate-300 shrink-0">{priceLabel}</span>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

export default ElementCatalogue;
