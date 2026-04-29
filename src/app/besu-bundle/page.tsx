"use client";

import React, { useMemo, useState } from "react";
import { Download, FileText, Package, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BESU_PUBLIC_FILES, type BesuPublicCategory } from "@/lib/besuBundle";

const CATEGORIES: { value: "all" | BesuPublicCategory; label: string }[] = [
  { value: "all", label: "All Files" },
  { value: "components", label: "React Components" },
  { value: "interfaces", label: "TypeScript Interfaces" },
  { value: "abi", label: "Smart Contract ABI" },
  { value: "other", label: "Other" },
];

export default function BesuBundlePublicPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"all" | BesuPublicCategory>("all");

  const files = useMemo(() => {
    const q = query.trim().toLowerCase();
    return BESU_PUBLIC_FILES.filter((f) => {
      const matchesCategory = category === "all" || f.category === category;
      const matchesQuery =
        !q ||
        f.name.toLowerCase().includes(q) ||
        f.description.toLowerCase().includes(q) ||
        f.tags.some((t) => t.toLowerCase().includes(q));
      return matchesCategory && matchesQuery;
    });
  }, [query, category]);

  const downloadOne = (filename: string) => {
    const a = document.createElement("a");
    a.href = `/api/download/${encodeURIComponent(filename)}`;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const downloadAll = () => files.forEach((f) => downloadOne(f.name));

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="border-b border-slate-800 bg-slate-950/70 backdrop-blur sticky top-0 z-40">
        <div className="mx-auto max-w-6xl px-4 py-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
              <Package className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">BESU Bundle</h1>
              <p className="text-sm text-slate-300">Public (non-sensitive) integration files</p>
            </div>
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search files, tags, descriptions…"
                className="pl-9 bg-slate-900 border-slate-800"
              />
            </div>
            <Select value={category} onValueChange={(v) => setCategory(v as any)}>
              <SelectTrigger className="w-full md:w-[240px] bg-slate-900 border-slate-800">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={downloadAll} disabled={files.length === 0} className="gap-2">
              <Download className="h-4 w-4" />
              Download All ({files.length})
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-8">
        {files.length === 0 ? (
          <div className="text-slate-300">No files found.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {files.map((f) => (
              <Card key={f.id} className="border-slate-800 bg-slate-900">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center justify-between gap-3">
                    <span className="truncate">{f.name}</span>
                    <Badge variant="secondary" className="gap-1">
                      <FileText className="h-3 w-3" />
                      {f.type}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-sm text-slate-300">{f.description}</div>
                  <div className="flex flex-wrap gap-2">
                    {f.tags.map((t) => (
                      <Badge key={t} variant="outline" className="border-slate-700 text-slate-200">
                        {t}
                      </Badge>
                    ))}
                  </div>
                  <div className="flex justify-end">
                    <Button variant="secondary" size="sm" className="gap-2" onClick={() => downloadOne(f.name)}>
                      <Download className="h-4 w-4" />
                      Download
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}



