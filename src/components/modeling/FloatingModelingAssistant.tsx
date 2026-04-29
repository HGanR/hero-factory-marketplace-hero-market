"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Box, Send, X, BookMarked } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const QUICK_PROMPTS = [
  "Family office HQ",
  "Conference room 10x8",
  "Vault room",
  "Podium for certificate",
];

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

type ModelingProvider = "auto" | "hiber3d";

/** BuildPlan from parametric parser */
export type BuildPlanPayload = Record<string, unknown>;

export type SaveToLibraryParams = { glbBase64: string; kind: string; prompt?: string; category?: string };

export interface FloatingModelingAssistantProps {
  /** Called when the agent returns a model URL (library asset) */
  onLoadModel?: (modelUrl: string) => void;
  /** Called when the agent returns a parametric plan (prompt-driven creation) */
  onGenerateFromPlan?: (plan: BuildPlanPayload) => void;
  /** Called when user clicks "Save Asset to Library". If provided, parent handles Tier7 sign + register. Else we call API directly (works for admin). */
  onSaveToLibrary?: (params: SaveToLibraryParams) => Promise<boolean>;
  /** Default: "Add a model by describing it" */
  bubbleLabel?: string;
  /** Default: "Model Assistant" */
  panelTitle?: string;
  /** If set, subtle pulse after this many ms of idle */
  highlightAfterIdleMs?: number;
  className?: string;
}

export function FloatingModelingAssistant({
  onLoadModel,
  onGenerateFromPlan,
  onSaveToLibrary,
  bubbleLabel = "Add a model by describing it",
  panelTitle = "Model Assistant",
  highlightAfterIdleMs,
  className,
}: FloatingModelingAssistantProps) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [provider, setProvider] = useState<ModelingProvider>("auto");
  const [lastPreview, setLastPreview] = useState<SaveToLibraryParams | null>(null);
  const [saving, setSaving] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const sendRequest = useCallback(
    async (text?: string) => {
      const messageText = (text || inputValue).trim();
      if (!messageText || busy) return;

      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: messageText,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setInputValue("");
      setBusy(true);

      try {
        const res = await fetch("/api/modeling/agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ message: messageText, provider }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error || "Request failed");
        }

        const assistantMsg: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: data.message ?? "Done.",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMsg]);

        if (data.plan && typeof data.plan === "object" && onGenerateFromPlan) {
          onGenerateFromPlan(data.plan as BuildPlanPayload);
        }
        if (data.modelUrl && typeof data.modelUrl === "string" && onLoadModel) {
          onLoadModel(data.modelUrl);
        }
        if (data.glbBase64 && typeof data.glbBase64 === "string" && onLoadModel) {
          onLoadModel(`data:model/gltf-binary;base64,${data.glbBase64}`);
        }
        if (data.suggestedAsset && typeof data.suggestedAsset === "object" && onLoadModel) {
          const sa = data.suggestedAsset as { modelUrl?: string; assetUri?: string };
          const uri = sa.modelUrl ?? sa.assetUri;
          if (uri) onLoadModel(uri.startsWith("ipfs://") ? uri.replace("ipfs://", "https://nftstorage.link/ipfs/") : uri);
        }
        if (data._path === "ai_asset_gen" && data.glbBase64 && data.suggestedAsset) {
          const sa = data.suggestedAsset as { query?: string };
          const spec = (data as { spec?: { kind?: string; category?: string } }).spec;
          setLastPreview({
            glbBase64: data.glbBase64,
            kind: spec?.kind ?? "crate",
            prompt: sa?.query ?? messageText,
            category: spec?.category ?? "prop",
          });
        } else {
          setLastPreview(null);
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Something went wrong. Try again.";
        const assistantMsg: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: errorMsg,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } finally {
        setBusy(false);
      }
    },
    [inputValue, busy, onLoadModel, onGenerateFromPlan, provider]
  );

  const handleSaveToLibrary = useCallback(async () => {
    if (!lastPreview || saving) return;
    setSaving(true);
    try {
      if (onSaveToLibrary) {
        const ok = await onSaveToLibrary(lastPreview);
        if (ok) {
          toast.success("Asset saved to library");
          setLastPreview(null);
        }
      } else {
        const res = await fetch("/api/oasis/assets/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            glbBase64: lastPreview.glbBase64,
            kind: lastPreview.kind,
            prompt: lastPreview.prompt,
            category: lastPreview.category ?? "prop",
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          toast.error(data?.error ?? "Failed to save. Tier 7 or admin required.");
          return;
        }
        toast.success(data?.message ?? "Asset saved to library");
        setLastPreview(null);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [lastPreview, saving, onSaveToLibrary]);

  useEffect(() => {
    if (!highlightAfterIdleMs || open) return;
    const t = setTimeout(() => setHighlight(true), highlightAfterIdleMs);
    return () => clearTimeout(t);
  }, [highlightAfterIdleMs, open]);

  const handleOpen = () => {
    setHighlight(false);
    setOpen(true);
    if (messages.length === 0) {
      setMessages([
        {
          id: "greeting",
          role: "assistant",
          content: "Describe what to build—e.g. 'family office HQ', 'conference room 10x8', 'vault room', 'podium'. I'll generate it parametrically.",
          timestamp: new Date(),
        },
      ]);
    }
  };

  return (
    <>
      {!open ? (
        <button
          onClick={handleOpen}
          className={cn(
            "fixed bottom-6 left-6 z-50 flex flex-col items-center gap-1 rounded-2xl border border-slate-600/80 bg-slate-900/95 px-4 py-3 shadow-lg backdrop-blur transition hover:border-amber-500/50 hover:bg-slate-800/95",
            highlight && "animate-pulse ring-2 ring-amber-500/40 ring-offset-2 ring-offset-slate-950",
            className
          )}
          aria-label="Open model assistant"
        >
          <Box className="h-6 w-6 text-amber-400" />
          <span className="text-xs font-medium text-slate-300 max-w-[140px] text-center leading-tight">
            {bubbleLabel}
          </span>
        </button>
      ) : (
        <div
          className={cn(
            "fixed bottom-6 left-6 z-50 flex w-[380px] max-w-[calc(100vw-3rem)] flex-col rounded-2xl border border-slate-600/80 bg-slate-900/95 shadow-xl backdrop-blur",
            className
          )}
        >
          <div className="flex items-center justify-between border-b border-slate-700/50 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white">{panelTitle}</span>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value as ModelingProvider)}
                className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-[11px] text-slate-200"
                title="Model provider"
              >
                <option value="auto">Auto</option>
                <option value="hiber3d">Hiber3D</option>
              </select>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-700/50 hover:text-white"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <ScrollArea className="h-[280px] px-4 py-3">
            <div className="space-y-3">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={cn(
                    "rounded-lg px-3 py-2 text-sm",
                    m.role === "user"
                      ? "ml-8 bg-amber-600/30 text-amber-100"
                      : "mr-8 bg-slate-800/60 text-slate-200"
                  )}
                >
                  {m.content}
                </div>
              ))}
              <div ref={scrollRef} />
            </div>
          </ScrollArea>

          <div className="border-t border-slate-700/50 p-3 space-y-2">
            {lastPreview && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={saving}
                onClick={handleSaveToLibrary}
                className="w-full border-cyan-600/50 text-cyan-300 hover:bg-cyan-900/30"
              >
                <BookMarked className="h-4 w-4 mr-2" />
                {saving ? "Saving..." : "Save Asset to Library"}
              </Button>
            )}
            <div className="flex flex-wrap gap-1.5">
              {QUICK_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => sendRequest(prompt)}
                  disabled={busy}
                  className="rounded-lg bg-slate-800/80 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-700 disabled:opacity-50"
                >
                  {prompt}
                </button>
              ))}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendRequest();
              }}
              className="flex gap-2"
            >
              <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="e.g. Family office HQ, conference room"
                className="flex-1 border-slate-600 bg-slate-800/80 text-sm text-white placeholder:text-slate-500"
                disabled={busy}
              />
              <Button
                type="submit"
                size="sm"
                disabled={!inputValue.trim() || busy}
                className="shrink-0"
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
