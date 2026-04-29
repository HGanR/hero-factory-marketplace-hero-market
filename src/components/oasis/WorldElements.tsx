"use client";

import React, { useMemo, useState, useEffect } from "react";
import { startPlacement } from "@/stores/worldStore";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";

type OasisElement = {
  id: number | string;
  name: string;
  description: string | null;
  assetUri: string;
  previewImageUri?: string | null;
  categoryId?: number | null;
  price?: string | number | null;
  currency?: string | null;
};

export interface WorldElementsProps {
  onElementSelected?: (element: OasisElement) => void;
  className?: string;
}

export function WorldElements({ onElementSelected, className }: WorldElementsProps) {
  const [value, setValue] = useState<string>("");
  const [elements, setElements] = useState<OasisElement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/oasis/elements");
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Failed to load elements");
        if (!cancelled) setElements(Array.isArray(data.elements) ? data.elements : []);
      } catch (err: any) {
        if (!cancelled) setError(err?.message || "Failed to load elements");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  const byId = useMemo(() => {
    const m = new Map<string, OasisElement>();
    elements.forEach((el) => m.set(String(el.id), el));
    return m;
  }, [elements]);

  const handleSelect = (id: string) => {
    const element = byId.get(id);
    if (!element) return;

    const allowedCurrencies = ["TROO", "TROO_POO", "XRP", "SOL", "POL"] as const;
    const currency = allowedCurrencies.includes((element.currency || "TROO") as any)
      ? (element.currency || "TROO")
      : "TROO";

    startPlacement({
      name: element.name,
      type: element.categoryId ? String(element.categoryId) : "custom",
      modelUrl: element.assetUri,
      category: element.categoryId ? String(element.categoryId) : "custom",
      price: element.price ? Number(element.price) : 0,
      currency: currency as any,
      isStackable: true,
      isEnterable: false,
      isCustomizable: true,
      metadata: {
        source: "admin-library",
        elementId: element.id,
        preview: element.previewImageUri,
        description: element.description,
      },
    });

    onElementSelected?.(element);
    setValue(id);
  };

  return (
    <div className={className}>
      <div className="flex items-center gap-2">
        <Button variant="outline" className="gap-2 bg-cyan-500/20 border-cyan-500/50 hover:bg-cyan-500/30 text-cyan-300">
          Admin Library
        </Button>

        <div className="flex-1 min-w-0">
          <Select value={value} onValueChange={handleSelect} disabled={isLoading || elements.length === 0 || !!error}>
            <SelectTrigger className="border-cyan-500/30 focus:ring-cyan-500 bg-slate-950/30">
              <SelectValue
                placeholder={
                  error
                    ? "Failed to load elements"
                    : isLoading
                    ? "Loading elements…"
                    : elements.length === 0
                    ? "No elements yet"
                    : "Pick an element…"
                }
              />
            </SelectTrigger>
            <SelectContent className="border-cyan-500/20">
              <SelectGroup>
                <SelectLabel className="text-cyan-300">Admin uploads</SelectLabel>
                {elements.map((el) => (
                  <SelectItem key={el.id} value={String(el.id)}>
                    {el.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="mt-2 text-[11px] text-slate-400">
        Selecting an element enables placement. Only items uploaded via Admin → Oasis Elements are shown.
      </div>
    </div>
  );
}

export default WorldElements;

