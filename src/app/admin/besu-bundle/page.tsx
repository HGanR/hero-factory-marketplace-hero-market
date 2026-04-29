"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Download, Lock, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BESU_ADMIN_FILES, type BesuAdminCategory } from "@/lib/besuBundle";

const CATEGORIES: { value: "all" | BesuAdminCategory; label: string }[] = [
  { value: "all", label: "All Files" },
  { value: "deployment", label: "Deployment" },
  { value: "configuration", label: "Configuration" },
  { value: "services", label: "Services / Procedures" },
  { value: "database", label: "Database" },
  { value: "testing", label: "Testing" },
  { value: "other", label: "Other" },
];

export default function BesuBundleAdminPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"all" | BesuAdminCategory>("all");
  const [highOnly, setHighOnly] = useState(false);

  useEffect(() => {
    try {
      const isAdmin = localStorage.getItem("adminLoggedIn") === "true";
      if (!isAdmin) router.push("/admin");
    } catch {
      router.push("/admin");
    }
  }, [router]);

  const files = useMemo(() => {
    const q = query.trim().toLowerCase();
    return BESU_ADMIN_FILES.filter((f) => {
      const matchesCategory = category === "all" || f.category === category;
      const matchesQuery =
        !q ||
        f.name.toLowerCase().includes(q) ||
        f.description.toLowerCase().includes(q) ||
        f.tags.some((t) => t.toLowerCase().includes(q));
      const matchesSensitivity = !highOnly || f.sensitivity === "high";
      return matchesCategory && matchesQuery && matchesSensitivity;
    });
  }, [query, category, highOnly]);

  const downloadOne = (filename: string) => {
    const a = document.createElement("a");
    a.href = `/api/admin/download/${encodeURIComponent(filename)}`;
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
            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center">
              <Lock className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">BESU Bundle (Admin)</h1>
              <p className="text-sm text-slate-300">Sensitive deployment + backend files (admin-token required)</p>
            </div>
          </div>

          <div className="rounded-xl border border-orange-900/50 bg-orange-950/20 px-4 py-3 text-sm text-orange-100 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 mt-0.5 text-orange-300" />
            <div>
              <div className="font-semibold">Security reminder</div>
              <div className="text-orange-100/90">
                These files are protected and should not be shared publicly.
              </div>
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
            <Button
              variant={highOnly ? "default" : "secondary"}
              onClick={() => setHighOnly((v) => !v)}
              className="gap-2"
            >
              <AlertTriangle className="h-4 w-4" />
              High Sensitivity Only
            </Button>
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
          <div className="space-y-3">
            {files.map((f) => (
              <Card
                key={f.id}
                className="border-slate-800 bg-slate-900 border-l-4"
                style={{
                  borderLeftColor:
                    f.sensitivity === "high" ? "#ef4444" : f.sensitivity === "medium" ? "#eab308" : "#22c55e",
                }}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="flex flex-wrap items-center justify-between gap-3">
                    <span className="truncate">{f.name}</span>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">{f.type}</Badge>
                      <Badge
                        variant="outline"
                        className={
                          f.sensitivity === "high"
                            ? "border-red-400 text-red-200"
                            : f.sensitivity === "medium"
                              ? "border-yellow-400 text-yellow-200"
                              : "border-green-400 text-green-200"
                        }
                      >
                        {f.sensitivity}
                      </Badge>
                    </div>
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



