"use client";

import React, { useState, useRef, useEffect } from "react";
import { SimpleImageUpload } from "@/components/galaxy/SimpleImageUploadComponent";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Download } from "lucide-react";

/**
 * DemoUploadPage
 *
 * Shows how to use SimpleImageUpload for seal and watermark uploads
 * with preview and export functionality.
 *
 * This is a complete working example for Next.js 16 projects.
 */

interface UploadedImage {
  blob: Blob;
  previewUrl: string;
  fileName: string;
}

export default function DemoUploadPage() {
  const [seal, setSeal] = useState<UploadedImage | null>(null);
  const [watermark, setWatermark] = useState<UploadedImage | null>(null);
  const [certificatePreview, setCertificatePreview] = useState<string>("");

  // Create certificate preview with seal and watermark
  useEffect(() => {
    if (seal || watermark) {
      setCertificatePreview(
        `Certificate Preview:\n- Seal: ${seal ? "✓ Loaded" : "✗ Not loaded"}\n- Watermark: ${watermark ? "✓ Loaded" : "✗ Not loaded"}`
      );
    } else {
      setCertificatePreview("Upload seal and watermark to preview certificate");
    }
  }, [seal, watermark]);

  const handleSealSelected = (blob: Blob, previewUrl: string) => {
    setSeal({
      blob,
      previewUrl,
      fileName: `seal-${Date.now()}.${blob.type.split("/")[1]}`,
    });
  };

  const handleWatermarkSelected = (blob: Blob, previewUrl: string) => {
    setWatermark({
      blob,
      previewUrl,
      fileName: `watermark-${Date.now()}.${blob.type.split("/")[1]}`,
    });
  };

  const handleExport = async () => {
    const exportData: any = {
      exportedAt: new Date().toISOString(),
      seal: null,
      watermark: null,
    };

    if (seal) {
      const sealBase64 = await blobToBase64(seal.blob);
      exportData.seal = {
        fileName: seal.fileName,
        mimeType: seal.blob.type,
        size: seal.blob.size,
        data: sealBase64,
      };
    }

    if (watermark) {
      const watermarkBase64 = await blobToBase64(watermark.blob);
      exportData.watermark = {
        fileName: watermark.fileName,
        mimeType: watermark.blob.type,
        size: watermark.blob.size,
        data: watermarkBase64,
      };
    }

    const jsonStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `certificate-assets-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-slate-950 p-8">
      <div className="mx-auto max-w-4xl space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-white">Certificate Upload Demo</h1>
          <p className="mt-2 text-slate-400">Simple, reliable image upload for seal and watermark</p>
        </div>

        {/* Upload Section */}
        <Card className="border-slate-700 bg-slate-900">
          <CardHeader>
            <CardTitle className="text-white">Upload Assets</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <SimpleImageUpload label="Seal" onImageSelected={handleSealSelected} currentPreviewUrl={seal?.previewUrl} onRemove={() => setSeal(null)} maxSizeMB={10} />
            </div>

            <Separator className="border-slate-700" />

            <div>
              <SimpleImageUpload
                label="Watermark"
                onImageSelected={handleWatermarkSelected}
                currentPreviewUrl={watermark?.previewUrl}
                onRemove={() => setWatermark(null)}
                maxSizeMB={10}
              />
            </div>
          </CardContent>
        </Card>

        {/* Preview Section */}
        <Card className="border-slate-700 bg-slate-900">
          <CardHeader>
            <CardTitle className="text-white">Certificate Preview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="min-h-48 rounded-lg border border-slate-700 bg-slate-800 p-6">
              <pre className="whitespace-pre-wrap text-sm text-slate-300">{certificatePreview}</pre>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Seal:</span>
                <span className={seal ? "text-green-400" : "text-slate-500"}>{seal ? `✓ ${seal.fileName}` : "✗ Not uploaded"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Watermark:</span>
                <span className={watermark ? "text-green-400" : "text-slate-500"}>{watermark ? `✓ ${watermark.fileName}` : "✗ Not uploaded"}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Export Section */}
        {(seal || watermark) && (
          <Card className="border-slate-700 bg-slate-900">
            <CardHeader>
              <CardTitle className="text-white">Export</CardTitle>
            </CardHeader>
            <CardContent>
              <Button onClick={handleExport} className="gap-2 bg-blue-600 hover:bg-blue-700">
                <Download className="h-4 w-4" />
                Export as JSON
              </Button>
              <p className="mt-3 text-xs text-slate-400">Exports seal and watermark as base64-encoded JSON for storage or transmission</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

