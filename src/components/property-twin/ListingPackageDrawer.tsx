"use client";

import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function ListingPackageDrawer({
  open,
  onOpenChange,
  markdown,
  onCopy,
  copyLabel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  markdown: string;
  onCopy: () => void;
  copyLabel: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!fixed !left-auto !right-2 !top-2 !bottom-2 !translate-x-0 !translate-y-0 z-50 flex h-[calc(100vh-1rem)] w-[min(100vw-1rem,28rem)] max-w-[calc(100vw-1rem)] flex-col gap-0 overflow-hidden border-white/10 bg-slate-950 p-0 sm:rounded-l-xl sm:rounded-r-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:slide-in-from-right-8 data-[state=closed]:slide-out-to-right-8">
        <DialogHeader className="shrink-0 border-b border-white/10 p-4 text-left">
          <DialogTitle className="text-white">Listing package</DialogTitle>
          <DialogDescription>
            Server-built Markdown — copy into email, Notion, or print to PDF. Figures are illustrative until
            tied to comps.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          <pre className="text-xs text-slate-300 whitespace-pre-wrap font-mono bg-black/40 p-3 rounded border border-white/10">
            {markdown || "—"}
          </pre>
        </div>
        <DialogFooter className="shrink-0 border-t border-white/10 p-4">
          <Button variant="outline" className="border-white/15 w-full sm:w-auto" onClick={() => onCopy()}>
            <Copy className="w-4 h-4 mr-2" />
            {copyLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
