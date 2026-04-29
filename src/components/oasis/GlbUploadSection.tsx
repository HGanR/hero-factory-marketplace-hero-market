"use client";

import React, { useMemo, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Upload } from "lucide-react";
import {
  isModelFile,
  openFilePicker,
  pickFirstFile,
  validateWalletConnection,
} from "@/lib/oasisUploadUtils";
import GlbPreview from "@/components/oasis/GlbPreview";

export type GlbUploadStatus = "idle" | "success" | "error";

export function GlbUploadSection({
  file,
  onFileChange,
  uploading,
  onUpload,
  walletAddress,
  isConnected = true,
  requireWallet = false,
  status = "idle",
  message = "",
  maxMb = 100,
}: {
  file: File | null;
  onFileChange: (file: File | null) => void;
  uploading: boolean;
  onUpload: () => Promise<void> | void;
  walletAddress?: string;
  isConnected?: boolean;
  requireWallet?: boolean;
  status?: GlbUploadStatus;
  message?: string;
  maxMb?: number;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const fileSizeMb = useMemo(() => (file ? file.size / 1024 / 1024 : 0), [file]);
  const fileTooLarge = useMemo(() => (file ? fileSizeMb > maxMb : false), [file, fileSizeMb, maxMb]);
  const walletValidation = useMemo(() => {
    if (!requireWallet) return { valid: true as const };
    return validateWalletConnection(walletAddress, Boolean(isConnected));
  }, [requireWallet, walletAddress, isConnected]);

  function handleFile(file: File | null) {
    if (!file) {
      onFileChange(null);
      return;
    }
    if (!isModelFile(file)) {
      onFileChange(null);
      return;
    }
    if (file.size > maxMb * 1024 * 1024) {
      onFileChange(file); // still set so user sees name; parent can show error
      return;
    }
    onFileChange(file);
  }

  return (
    <div className="space-y-4">
      {requireWallet && !walletValidation.valid ? (
        <div className="rounded-lg border border-amber-700/50 bg-amber-900/20 p-3 text-xs text-amber-200">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-amber-400 mt-0.5" />
            <div>{walletValidation.message || "Wallet address required."}</div>
          </div>
        </div>
      ) : null}

      <input
        ref={fileInputRef}
        type="file"
        accept=".glb,.gltf,model/gltf-binary,model/gltf+json"
        onChange={(e) => handleFile(e.target.files?.[0] || null)}
        className="hidden"
      />

      <div
        className={[
          "rounded-xl border-2 border-dashed p-6 transition",
          dragOver ? "border-cyan-400 bg-cyan-500/10" : "border-white/15 bg-white/5 hover:border-white/25",
        ].join(" ")}
        onDragEnter={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragOver(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragOver(true);
          if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragOver(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragOver(false);
          const f = pickFirstFile(e.dataTransfer);
          if (!f) return;
          handleFile(f);
        }}
      >
        <div className="flex flex-col items-center gap-3">
          <div className="text-3xl">📦</div>
          <div className="text-center">
            <p className="text-sm font-semibold text-white">
              {file ? file.name : "Drop your GLB/GLTF file here"}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {file ? `${fileSizeMb.toFixed(2)} MB` : "or click to browse"}
            </p>
          </div>

          <button
            type="button"
            className="mt-2 inline-flex items-center gap-2 rounded-lg bg-white/10 border border-white/20 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15 hover:border-white/30 active:scale-[0.99] transition disabled:opacity-60"
            onPointerDown={() => openFilePicker(fileInputRef.current)}
            onClick={() => openFilePicker(fileInputRef.current)}
            disabled={uploading}
          >
            <Upload className="h-4 w-4" />
            Choose File
          </button>

          <p className="text-xs text-slate-500 mt-2">
            Supported: .glb, .gltf (Max {maxMb}MB)
          </p>
        </div>
      </div>

      {file ? (
        <div>
          <label className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Preview</label>
          <div className="mt-2">
            <GlbPreview file={file} heightClassName="h-80" />
          </div>
          {fileTooLarge ? (
            <div className="mt-2 rounded-lg border border-red-700/50 bg-red-900/20 p-3 text-xs text-red-200">
              File too large. Maximum {maxMb}MB.
            </div>
          ) : null}
          {!isModelFile(file) ? (
            <div className="mt-2 rounded-lg border border-red-700/50 bg-red-900/20 p-3 text-xs text-red-200">
              Invalid file type. Please choose a .glb or .gltf file.
            </div>
          ) : null}
        </div>
      ) : null}

      {status !== "idle" ? (
        <div
          className={[
            "rounded-lg p-3 border text-xs",
            status === "success"
              ? "border-green-700/50 bg-green-900/20 text-green-200"
              : "border-red-700/50 bg-red-900/20 text-red-200",
          ].join(" ")}
        >
          <div className="flex items-start gap-2">
            {status === "success" ? (
              <CheckCircle2 className="h-4 w-4 text-green-400 mt-0.5" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-400 mt-0.5" />
            )}
            <div className="break-words">{message}</div>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-black font-semibold rounded-lg disabled:opacity-50"
        onClick={() => onUpload()}
        disabled={!file || uploading || fileTooLarge || !isModelFile(file) || (requireWallet && !walletValidation.valid)}
      >
        {uploading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Uploading…
          </>
        ) : (
          <>
            <Upload className="h-4 w-4" />
            Upload Element
          </>
        )}
      </button>
    </div>
  );
}

export default GlbUploadSection;


