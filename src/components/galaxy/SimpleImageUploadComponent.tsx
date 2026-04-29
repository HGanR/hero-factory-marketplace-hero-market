"use client";

import React, { useCallback, useId, useRef, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { XCircle, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ImageUploadProps {
  label: string;
  onImageSelected: (blob: Blob, previewUrl: string) => void;
  currentPreviewUrl?: string;
  onRemove?: () => void;
  maxSizeMB?: number;
  acceptedFormats?: string[];
}

export function SimpleImageUpload({
  label,
  onImageSelected,
  currentPreviewUrl,
  onRemove,
  maxSizeMB = 10,
  acceptedFormats = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"],
}: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const [error, setError] = useState<string | null>(null);

  const maxBytes = maxSizeMB * 1024 * 1024;

  const handleFileSelect = useCallback(
    (file: File) => {
      setError(null);

      if (!acceptedFormats.includes(file.type)) {
        setError(`Invalid file type. Accepted: ${acceptedFormats.map((t) => t.split("/")[1]).join(", ")}`);
        return;
      }

      if (file.size > maxBytes) {
        setError(`File too large. Max size: ${maxSizeMB}MB`);
        return;
      }

      const previewUrl = URL.createObjectURL(file);
      onImageSelected(file, previewUrl);
    },
    [acceptedFormats, maxBytes, maxSizeMB, onImageSelected]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
    e.target.value = "";
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={acceptedFormats.join(",")}
        onChange={handleInputChange}
        className="sr-only"
        aria-label={`Upload ${label.toLowerCase()}`}
      />

      <div className="flex flex-wrap items-center gap-2">
        <label
          htmlFor={inputId}
          className={cn(buttonVariants({ variant: "secondary" }), "gap-2 cursor-pointer")}
        >
          <ImageIcon className="h-4 w-4" />
          {`Choose ${label}`}
        </label>

        {currentPreviewUrl && onRemove && (
          <Button variant="secondary" type="button" onClick={onRemove} className="gap-2">
            <XCircle className="h-4 w-4" />
            Remove
          </Button>
        )}
      </div>

      {error && <div className="text-sm text-red-400">{error}</div>}

      {currentPreviewUrl ? (
        <div className="mt-3 rounded-lg border border-slate-700 bg-slate-900 p-3">
          <div className="mb-2 text-xs text-slate-400">Preview</div>
          <img alt={label} src={currentPreviewUrl} className="h-24 w-24 rounded-full border border-slate-600 object-cover" />
        </div>
      ) : (
        <div className="text-xs text-slate-400">No image uploaded. Max size: {maxSizeMB}MB</div>
      )}
    </div>
  );
}





