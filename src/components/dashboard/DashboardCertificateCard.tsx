"use client";

import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, Download, Zap } from "lucide-react";

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

interface DashboardCertificateCardProps {
  certificate: CertificateWithTheme;
  onPreview?: (cert: CertificateWithTheme) => void;
  onDeploy?: (cert: CertificateWithTheme) => void;
  onExport?: (cert: CertificateWithTheme) => void;
}

export function DashboardCertificateCard({
  certificate,
  onPreview,
  onDeploy,
  onExport,
}: DashboardCertificateCardProps) {
  const statusColors = {
    active: "bg-green-950/50 text-green-400 border-green-900/50",
    transferred: "bg-blue-950/50 text-blue-400 border-blue-900/50",
    voided: "bg-red-950/50 text-red-400 border-red-900/50",
  };

  const status = certificate.status || "active";
  const statusColor = statusColors[status];

  return (
    <Card className="relative overflow-hidden border-slate-700 bg-gradient-to-br from-slate-900 to-slate-950 hover:border-cyan-600/50 transition-all hover:shadow-lg hover:shadow-cyan-600/10">
      {/* Certificate Preview Container */}
      <div className="relative aspect-[4/5] bg-gradient-to-b from-slate-100 to-slate-50 p-8 overflow-hidden">
        {/* Certificate Content */}
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

        {/* Seal - Bottom Left */}
        {certificate.theme.sealDataUrl && (
          <div className="absolute bottom-4 left-4 w-16 h-16 rounded-full border-2 border-slate-400 overflow-hidden bg-white shadow-md">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={certificate.theme.sealDataUrl} alt="Seal" className="w-full h-full object-cover" />
          </div>
        )}

        {/* Watermark - Center (with opacity and rotation) */}
        {certificate.theme.watermarkDataUrl && (
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            style={{
              opacity: certificate.theme.watermarkOpacity,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
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

        {/* Decorative Border */}
        <div className="absolute inset-0 border-4 border-slate-300 pointer-events-none" />
      </div>

      {/* Card Footer */}
      <div className="p-4 space-y-3 border-t border-slate-700">
        {/* Header Row */}
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="text-xs text-slate-500 uppercase tracking-wider">Serial Number</div>
            <div className="text-sm font-mono text-cyan-400 font-semibold">{certificate.serialNumber}</div>
          </div>
          <Badge variant="outline" className={`${statusColor} border`}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </Badge>
        </div>

        {/* Amount Row */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400">Denomination</span>
          <span className="text-cyan-400 font-semibold">${certificate.denomination.toLocaleString()}</span>
        </div>

        {/* Date Row */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400">Created</span>
          <span className="text-slate-400">{new Date(certificate.createdAt).toLocaleDateString()}</span>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          {onPreview && (
            <Button
              onClick={() => onPreview(certificate)}
              variant="outline"
              size="sm"
              className="flex-1 gap-1.5 text-xs h-8 border-slate-600 hover:border-slate-500 hover:bg-slate-800"
            >
              <Eye className="h-3.5 w-3.5" />
              Preview
            </Button>
          )}
          {onExport && (
            <Button
              onClick={() => onExport(certificate)}
              variant="outline"
              size="sm"
              className="flex-1 gap-1.5 text-xs h-8 border-slate-600 hover:border-slate-500 hover:bg-slate-800"
            >
              <Download className="h-3.5 w-3.5" />
              Export
            </Button>
          )}
          {onDeploy && (
            <Button
              onClick={() => onDeploy(certificate)}
              size="sm"
              className="flex-1 gap-1.5 text-xs h-8 bg-cyan-600 hover:bg-cyan-700 text-white"
            >
              <Zap className="h-3.5 w-3.5" />
              Deploy NFT
            </Button>
          )}
        </div>

        {/* Status Info */}
        {certificate.savedToTheme && (
          <div className="text-xs text-slate-500 text-center pt-1 border-t border-slate-700">✓ Theme applied and saved</div>
        )}
      </div>
    </Card>
  );
}

export default DashboardCertificateCard;









