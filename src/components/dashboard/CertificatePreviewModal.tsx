"use client";

import React, { useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, ZoomIn, ZoomOut, RotateCcw, Copy, Share2, FileJson, X } from "lucide-react";

export interface CertificateTheme {
  entityName: string;
  entityType: string;
  sealDataUrl?: string;
  watermarkDataUrl?: string;
  watermarkOpacity: number;
  watermarkScale: number;
  watermarkRotateDeg: number;
}

export interface CertificateWithTheme {
  id: string;
  serialNumber: string;
  denomination: number;
  beneficialOwner: string;
  assetBacking?: string;
  notes?: string;
  theme: CertificateTheme;
  createdAt: string;
  updatedAt: string;
  savedToTheme: boolean;
  status?: "active" | "transferred" | "voided";
}

interface CertificatePreviewModalProps {
  certificate: CertificateWithTheme | null;
  isOpen: boolean;
  onClose: () => void;
  onDownload?: (cert: CertificateWithTheme) => void;
  onShare?: (cert: CertificateWithTheme) => void;
}

export function CertificatePreviewModal({
  certificate,
  isOpen,
  onClose,
  onDownload,
  onShare,
}: CertificatePreviewModalProps) {
  const [zoom, setZoom] = useState(100);
  const [copied, setCopied] = useState(false);
  const certificateRef = useRef<HTMLDivElement>(null);

  if (!certificate) return null;

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 10, 200));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 10, 50));
  const handleResetZoom = () => setZoom(100);

  const handleCopySerialNumber = () => {
    navigator.clipboard.writeText(certificate.serialNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadAsImage = async () => {
    try {
      const html2canvas = (await import("html2canvas")).default;
      if (certificateRef.current) {
        const canvas = await html2canvas(certificateRef.current, { backgroundColor: "#ffffff", scale: 2 });
        const link = document.createElement("a");
        link.href = canvas.toDataURL("image/png");
        link.download = `certificate-${certificate.serialNumber}.png`;
        link.click();
      }
    } catch (err) {
      console.error("Failed to download certificate as image:", err);
      alert("Failed to download certificate. Please try again.");
    }
  };

  const handleDownloadAsJSON = () => {
    try {
      const dataStr = JSON.stringify(certificate, null, 2);
      const dataBlob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `certificate-${certificate.serialNumber}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to download certificate as JSON:", err);
      alert("Failed to download certificate.");
    }
  };

  const handleShareCertificate = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: `Certificate ${certificate.serialNumber}`,
          text: `Trust Certificate - ${certificate.beneficialOwner}`,
          url: window.location.href,
        });
      } else {
        alert("Share feature not supported on this device.");
      }
    } catch (err) {
      console.error("Failed to share certificate:", err);
    }
  };

  const handlePrint = () => {
    const printWindow = window.open("", "", "width=800,height=600");
    if (printWindow && certificateRef.current) {
      printWindow.document.write(certificateRef.current.innerHTML);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const statusColors = {
    active: "text-green-400",
    transferred: "text-blue-400",
    voided: "text-red-400",
  };

  const status = certificate.status || "active";
  const statusColor = statusColors[status];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto border-slate-700 bg-slate-900">
        <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-4 border-b border-slate-700">
          <div>
            <DialogTitle className="text-xl">Certificate Preview</DialogTitle>
            <p className="text-sm text-slate-400 mt-1">Serial: {certificate.serialNumber}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </DialogHeader>

        <Tabs defaultValue="preview" className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-slate-800">
            <TabsTrigger value="preview">Preview</TabsTrigger>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="metadata">Metadata</TabsTrigger>
          </TabsList>

          <TabsContent value="preview" className="space-y-4">
            <div className="flex items-center justify-between bg-slate-800 p-3 rounded-lg">
              <div className="flex gap-2">
                <Button onClick={handleZoomOut} variant="outline" size="sm" className="gap-1.5" disabled={zoom <= 50}>
                  <ZoomOut className="h-4 w-4" />
                  Zoom Out
                </Button>
                <div className="flex items-center px-3 py-2 bg-slate-700 rounded text-sm font-mono">{zoom}%</div>
                <Button onClick={handleZoomIn} variant="outline" size="sm" className="gap-1.5" disabled={zoom >= 200}>
                  <ZoomIn className="h-4 w-4" />
                  Zoom In
                </Button>
                <Button onClick={handleResetZoom} variant="outline" size="sm" className="gap-1.5">
                  <RotateCcw className="h-4 w-4" />
                  Reset
                </Button>
              </div>

              <div className="flex gap-2">
                <Button onClick={handlePrint} variant="outline" size="sm" className="gap-1.5">
                  Print
                </Button>
                <Button onClick={handleDownloadAsImage} variant="outline" size="sm" className="gap-1.5">
                  <Download className="h-4 w-4" />
                  Download PNG
                </Button>
              </div>
            </div>

            <div className="flex justify-center bg-slate-800 p-6 rounded-lg overflow-auto max-h-[500px]">
              <div
                ref={certificateRef}
                style={{
                  transform: `scale(${zoom / 100})`,
                  transformOrigin: "top center",
                  transition: "transform 0.2s ease-out",
                }}
              >
                <div className="relative w-96 aspect-[4/5] bg-gradient-to-b from-slate-100 to-slate-50 p-8 rounded-lg shadow-2xl">
                  <div className="flex flex-col items-center justify-center h-full text-center space-y-3">
                    <div className="text-lg font-bold text-slate-900 tracking-wider">TRUST CERTIFICATE</div>
                    <div className="text-xs text-slate-600 font-semibold">{certificate.theme.entityName}</div>
                    <div className="text-4xl font-bold text-cyan-600 font-mono">${certificate.denomination.toLocaleString()}</div>
                    <div className="text-xs text-slate-500 font-mono">Serial: {certificate.serialNumber}</div>
                    <div className="border-t border-slate-300 pt-3 w-full">
                      <div className="text-xs text-slate-700 font-semibold">{certificate.beneficialOwner}</div>
                    </div>
                    {certificate.assetBacking && (
                      <div className="text-xs text-slate-600 italic">Backed by: {certificate.assetBacking}</div>
                    )}
                  </div>

                  {certificate.theme.sealDataUrl && (
                    <div className="absolute bottom-4 left-4 w-16 h-16 rounded-full border-2 border-slate-400 overflow-hidden bg-white shadow-md">
                      <img src={certificate.theme.sealDataUrl} alt="Seal" className="w-full h-full object-cover" />
                    </div>
                  )}

                  {certificate.theme.watermarkDataUrl && (
                    <div
                      className="absolute inset-0 flex items-center justify-center pointer-events-none"
                      style={{
                        opacity: certificate.theme.watermarkOpacity,
                      }}
                    >
                      <img
                        src={certificate.theme.watermarkDataUrl}
                        alt="Watermark"
                        className="object-contain"
                        style={{
                          width: `${certificate.theme.watermarkScale * 100}%`,
                          height: `${certificate.theme.watermarkScale * 100}%`,
                          transform: `rotate(${certificate.theme.watermarkRotateDeg}deg)`,
                        }}
                      />
                    </div>
                  )}

                  <div className="absolute inset-0 border-4 border-slate-300 pointer-events-none rounded-lg" />
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="details" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="border-slate-700 bg-slate-800/50 p-4">
                <h3 className="text-sm font-semibold text-slate-200 mb-3">Certificate Information</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Serial Number</span>
                    <div className="flex items-center gap-2">
                      <span className="text-cyan-400 font-mono">{certificate.serialNumber}</span>
                      <button onClick={handleCopySerialNumber} className="p-1 hover:bg-slate-700 rounded transition-colors" title="Copy serial number">
                        <Copy className="h-3.5 w-3.5 text-slate-400" />
                      </button>
                      {copied && <span className="text-xs text-green-400">Copied!</span>}
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Denomination</span>
                    <span className="text-cyan-400 font-semibold">${certificate.denomination.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Status</span>
                    <span className={`font-semibold ${statusColor}`}>{status.charAt(0).toUpperCase() + status.slice(1)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Beneficial Owner</span>
                    <span className="text-slate-300 text-right max-w-xs">{certificate.beneficialOwner}</span>
                  </div>
                  {certificate.assetBacking && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Asset Backing</span>
                      <span className="text-slate-300 text-right max-w-xs">{certificate.assetBacking}</span>
                    </div>
                  )}
                </div>
              </Card>

              <Card className="border-slate-700 bg-slate-800/50 p-4">
                <h3 className="text-sm font-semibold text-slate-200 mb-3">Theme Information</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Entity Name</span>
                    <span className="text-slate-300">{certificate.theme.entityName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Entity Type</span>
                    <span className="text-slate-300">{certificate.theme.entityType}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Watermark Opacity</span>
                    <span className="text-slate-300">{(certificate.theme.watermarkOpacity * 100).toFixed(0)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Watermark Scale</span>
                    <span className="text-slate-300">{certificate.theme.watermarkScale.toFixed(2)}x</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Watermark Rotation</span>
                    <span className="text-slate-300">{certificate.theme.watermarkRotateDeg}°</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Seal</span>
                    <span className="text-green-400">{certificate.theme.sealDataUrl ? "✓ Uploaded" : "✗ None"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Watermark</span>
                    <span className="text-green-400">{certificate.theme.watermarkDataUrl ? "✓ Uploaded" : "✗ None"}</span>
                  </div>
                </div>
              </Card>

              <Card className="border-slate-700 bg-slate-800/50 p-4">
                <h3 className="text-sm font-semibold text-slate-200 mb-3">Dates</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Created</span>
                    <span className="text-slate-300">{new Date(certificate.createdAt).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Updated</span>
                    <span className="text-slate-300">{new Date(certificate.updatedAt).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Days Old</span>
                    <span className="text-slate-300">
                      {Math.floor((Date.now() - new Date(certificate.createdAt).getTime()) / (1000 * 60 * 60 * 24))} days
                    </span>
                  </div>
                </div>
              </Card>

              <Card className="border-slate-700 bg-slate-800/50 p-4">
                <h3 className="text-sm font-semibold text-slate-200 mb-3">Actions</h3>
                <div className="space-y-2">
                  <Button onClick={handleDownloadAsImage} className="w-full gap-2 text-sm">
                    <Download className="h-4 w-4" />
                    Download as PNG
                  </Button>
                  <Button onClick={handleDownloadAsJSON} variant="outline" className="w-full gap-2 text-sm">
                    <FileJson className="h-4 w-4" />
                    Download as JSON
                  </Button>
                  <Button onClick={handleShareCertificate} variant="outline" className="w-full gap-2 text-sm">
                    <Share2 className="h-4 w-4" />
                    Share Certificate
                  </Button>
                  <Button onClick={handlePrint} variant="outline" className="w-full gap-2 text-sm">
                    Print
                  </Button>
                </div>
              </Card>
            </div>

            {certificate.notes && (
              <Card className="border-slate-700 bg-slate-800/50 p-4">
                <h3 className="text-sm font-semibold text-slate-200 mb-2">Notes</h3>
                <p className="text-sm text-slate-300 whitespace-pre-wrap">{certificate.notes}</p>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="metadata" className="space-y-4">
            <Card className="border-slate-700 bg-slate-800/50 p-4">
              <h3 className="text-sm font-semibold text-slate-200 mb-3">Raw Data (JSON)</h3>
              <pre className="bg-slate-900 p-4 rounded text-xs overflow-auto max-h-96 text-slate-300">
                {JSON.stringify(certificate, null, 2)}
              </pre>
            </Card>

            <div className="flex gap-2">
              <Button
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(certificate, null, 2));
                  alert("JSON copied to clipboard");
                }}
                className="flex-1 gap-2"
              >
                <Copy className="h-4 w-4" />
                Copy JSON
              </Button>
              <Button onClick={handleDownloadAsJSON} variant="outline" className="flex-1 gap-2">
                <Download className="h-4 w-4" />
                Download JSON
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex gap-2 pt-4 border-t border-slate-700">
          <Button onClick={onClose} variant="outline" className="flex-1">
            Close
          </Button>
          {onDownload && (
            <Button onClick={() => onDownload(certificate)} className="flex-1 gap-2">
              <Download className="h-4 w-4" />
              Download
            </Button>
          )}
          {onShare && (
            <Button onClick={() => onShare(certificate)} variant="outline" className="flex-1 gap-2">
              <Share2 className="h-4 w-4" />
              Share
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default CertificatePreviewModal;









