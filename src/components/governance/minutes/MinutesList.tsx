"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Plus, Search, Eye } from "lucide-react";
import Link from "next/link";

type MinuteItem = {
  id: string;
  recordType: string;
  title: string;
  actionDate: string;
  status: string;
  resolutions?: any[];
  approvals?: any[];
};

export default function MinutesList({
  trustId,
  entityId,
  clientId,
}: {
  trustId?: string | null;
  entityId?: string | null;
  clientId?: string | null;
}) {
  const [items, setItems] = useState<MinuteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (trustId) params.set("trustId", trustId);
        if (entityId) params.set("entityId", entityId);

        const res = await fetch(`/api/governance/minutes?${params.toString()}`, { credentials: "include" });
        const json = await res.json();
        if (json.ok) {
          setItems(json.items || []);
        }
      } catch (error) {
        console.error("Failed to load minutes:", error);
      } finally {
        setLoading(false);
      }
    })();
  }, [trustId, entityId]);

  const filteredItems = items.filter((item) => {
    if (statusFilter !== "all" && item.status !== statusFilter) return false;
    if (searchQuery && !item.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "outline"> = {
      draft: "outline",
      pending: "secondary",
      approved: "default",
      locked: "default",
    };
    return (
      <Badge variant={variants[status] || "outline"} className="capitalize">
        {status}
      </Badge>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Minutes & Resolutions</h2>
        <Button asChild>
          <Link href={`/trust-records/governance/minutes/new?trustId=${trustId || ""}&entityId=${entityId || ""}`}>
            <Plus className="mr-2 h-4 w-4" />
            New Minute / Resolution
          </Link>
        </Button>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search minutes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="locked">Locked</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      ) : filteredItems.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No minutes found. Create your first minute or resolution.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredItems.map((item) => (
            <Card key={item.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <h3 className="font-semibold">{item.title}</h3>
                      {getStatusBadge(item.status)}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {new Date(item.actionDate).toLocaleDateString()} • {item.recordType === "meeting" ? "Meeting" : "Written Consent"}
                    </div>
                    {item.resolutions && item.resolutions.length > 0 && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {item.resolutions.length} resolution{item.resolutions.length !== 1 ? "s" : ""}
                      </div>
                    )}
                  </div>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/trust-records/governance/minutes/${item.id}`}>
                      <Eye className="mr-2 h-4 w-4" />
                      View
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
