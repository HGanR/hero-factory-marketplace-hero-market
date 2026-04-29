"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Package, AlertCircle } from "lucide-react";

interface OasisElement {
  id: number;
  name: string;
  assetUri: string;
  categoryId: number;
  isEnterable: boolean;
  hasDoor: boolean;
  hasGlass: boolean;
  tags?: string[];
}

interface PrefabPaletteProps {
  onPlacePrefab: (element: OasisElement) => void;
  isVisible: boolean;
}

export function PrefabPalette({ onPlacePrefab, isVisible }: PrefabPaletteProps) {
  const [elements, setElements] = useState<OasisElement[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isVisible) {
      loadElements();
    }
  }, [isVisible]);

  const loadElements = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/oasis/elements');
      if (!response.ok) throw new Error('Failed to load elements');
      const data = await response.json();
      setElements(data.elements || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isVisible) return null;

  // Filter to show interior-appropriate elements
  const interiorElements = elements.filter(el =>
    !el.isEnterable && // Don't show buildings inside buildings
    el.assetUri // Must have an asset
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Package className="h-4 w-4" />
          Prefab Library
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {error && (
          <Alert className="border-red-700/50 bg-red-900/20">
            <AlertCircle className="h-4 w-4 text-red-400" />
            <AlertDescription className="text-red-300 text-xs">
              {error}
            </AlertDescription>
          </Alert>
        )}

        {loading ? (
          <div className="text-xs text-slate-400 text-center py-4">
            Loading prefabs...
          </div>
        ) : interiorElements.length === 0 ? (
          <div className="text-xs text-slate-400 text-center py-4">
            No prefabs available. Publish some elements first.
          </div>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {interiorElements.map((element) => (
              <div
                key={element.id}
                className="flex items-center justify-between p-2 rounded border border-slate-700 hover:border-slate-600 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">
                    {element.name}
                  </div>
                  <div className="flex gap-1 mt-1">
                    {element.hasDoor && <Badge variant="outline" className="text-xs px-1 py-0">Door</Badge>}
                    {element.hasGlass && <Badge variant="outline" className="text-xs px-1 py-0">Glass</Badge>}
                    {element.tags?.slice(0, 2).map(tag => (
                      <Badge key={tag} variant="secondary" className="text-xs px-1 py-0">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
                <Button
                  onClick={() => onPlacePrefab(element)}
                  size="sm"
                  variant="outline"
                  className="text-xs ml-2"
                >
                  Place
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}