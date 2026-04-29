/**
 * Blockchain Status Components
 * 
 * Reusable components for displaying blockchain verification status,
 * transaction details, and blockchain network health.
 */

'use client';

import React from 'react';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  ExternalLink,
  Copy,
  Download,
  RefreshCw,
  Wifi,
  WifiOff,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/useToast';

// ============================================================================
// Types
// ============================================================================

export type BlockchainStatus = 'pending' | 'syncing' | 'verified' | 'failed' | 'not_recorded';

interface BlockchainStatusBadgeProps {
  status: BlockchainStatus;
  size?: 'sm' | 'md' | 'lg';
}

interface BlockchainDetailsCardProps {
  transactionHash: string | null;
  blockNumber: number | null;
  status: BlockchainStatus;
  verificationTimestamp: Date | null;
  explorerUrl?: string;
  onVerify?: () => void;
  isVerifying?: boolean;
  onRetry?: () => void;
  isRetrying?: boolean;
}

interface NetworkStatusIndicatorProps {
  connected: boolean;
  blockNumber?: number;
  gasPrice?: string;
  chainId?: number;
}

interface VerificationCertificateProps {
  trustId: string;
  trustName: string;
  amount: string;
  beneficiary: string;
  maturityDate: Date;
  blockchainVerification: {
    transactionHash: string;
    blockNumber: number;
    verificationTimestamp: Date;
    explorerUrl: string;
  };
  onDownload?: () => void;
  isDownloading?: boolean;
}

// ============================================================================
// Blockchain Status Badge
// ============================================================================

export const BlockchainStatusBadge: React.FC<BlockchainStatusBadgeProps> = ({
  status,
  size = 'md',
}) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'verified':
        return {
          icon: <CheckCircle2 className="w-4 h-4" />,
          label: 'Verified',
          variant: 'success' as const,
          color: 'bg-green-500/10 text-green-700 border-green-200',
        };
      case 'pending':
        return {
          icon: <Clock className="w-4 h-4" />,
          label: 'Pending',
          variant: 'warning' as const,
          color: 'bg-yellow-500/10 text-yellow-700 border-yellow-200',
        };
      case 'syncing':
        return {
          icon: <RefreshCw className="w-4 h-4 animate-spin" />,
          label: 'Syncing',
          variant: 'info' as const,
          color: 'bg-blue-500/10 text-blue-700 border-blue-200',
        };
      case 'failed':
        return {
          icon: <AlertCircle className="w-4 h-4" />,
          label: 'Failed',
          variant: 'destructive' as const,
          color: 'bg-red-500/10 text-red-700 border-red-200',
        };
      case 'not_recorded':
        return {
          icon: <AlertCircle className="w-4 h-4" />,
          label: 'Not Recorded',
          variant: 'secondary' as const,
          color: 'bg-gray-500/10 text-gray-700 border-gray-200',
        };
      default:
        return {
          icon: null,
          label: 'Unknown',
          variant: 'secondary' as const,
          color: 'bg-gray-500/10 text-gray-700 border-gray-200',
        };
    }
  };

  const config = getStatusConfig();

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base',
  };

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border ${config.color} ${sizeClasses[size]} font-medium`}
    >
      {config.icon}
      {config.label}
    </div>
  );
};

// ============================================================================
// Blockchain Details Card
// ============================================================================

export const BlockchainDetailsCard: React.FC<BlockchainDetailsCardProps> = ({
  transactionHash,
  blockNumber,
  status,
  verificationTimestamp,
  explorerUrl,
  onVerify,
  isVerifying = false,
  onRetry,
  isRetrying = false,
}) => {
  const toast = useToast();

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  return (
    <Card className="p-6 bg-gradient-to-br from-blue-50 to-cyan-50 border-cyan-200">
      <div className="space-y-4">
        {/* Status */}
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Blockchain Verification</h3>
          <BlockchainStatusBadge status={status} size="md" />
        </div>

        {/* Transaction Hash */}
        {transactionHash && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Transaction Hash</label>
            <div className="flex items-center gap-2 p-3 bg-white rounded-lg border border-gray-200">
              <code className="flex-1 text-xs font-mono text-gray-600 break-all">
                {transactionHash}
              </code>
              <button
                onClick={() => copyToClipboard(transactionHash)}
                className="p-2 hover:bg-gray-100 rounded transition"
                title="Copy transaction hash"
              >
                <Copy className="w-4 h-4 text-gray-600" />
              </button>
              {explorerUrl && (
                <a
                  href={explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 hover:bg-gray-100 rounded transition"
                  title="View on blockchain explorer"
                >
                  <ExternalLink className="w-4 h-4 text-blue-600" />
                </a>
              )}
            </div>
          </div>
        )}

        {/* Block Number */}
        {blockNumber && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Block Number</label>
              <p className="text-lg font-semibold text-gray-900">#{blockNumber}</p>
            </div>

            {/* Verification Timestamp */}
            {verificationTimestamp && (
              <div>
                <label className="text-sm font-medium text-gray-700">Verified At</label>
                <p className="text-lg font-semibold text-gray-900">
                  {new Date(verificationTimestamp).toLocaleDateString()}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-4 border-t border-cyan-200">
          {status === 'pending' && onVerify && (
            <Button
              onClick={onVerify}
              disabled={isVerifying}
              variant="default"
              size="sm"
              className="gap-2"
            >
              {isVerifying && <RefreshCw className="w-4 h-4 animate-spin" />}
              Verify Now
            </Button>
          )}

          {status === 'failed' && onRetry && (
            <Button
              onClick={onRetry}
              disabled={isRetrying}
              variant="destructive"
              size="sm"
              className="gap-2"
            >
              {isRetrying && <RefreshCw className="w-4 h-4 animate-spin" />}
              Retry Recording
            </Button>
          )}

          {explorerUrl && (
            <Button
              asChild
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <a href={explorerUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4" />
                View on Explorer
              </a>
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
};

// ============================================================================
// Network Status Indicator
// ============================================================================

export const NetworkStatusIndicator: React.FC<NetworkStatusIndicatorProps> = ({
  connected,
  blockNumber,
  gasPrice,
  chainId,
}) => {
  return (
    <Card className="p-4 bg-gradient-to-r from-slate-50 to-slate-100 border-slate-200">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {connected ? (
            <>
              <div className="flex items-center gap-2">
                <Wifi className="w-5 h-5 text-green-600" />
                <span className="font-medium text-green-700">Connected</span>
              </div>
              <span className="text-sm text-gray-600">
                Chain: {chainId || 'Unknown'}
              </span>
            </>
          ) : (
            <>
              <WifiOff className="w-5 h-5 text-red-600" />
              <span className="font-medium text-red-700">Disconnected</span>
            </>
          )}
        </div>

        {connected && (
          <div className="flex items-center gap-4 text-sm">
            {blockNumber && (
              <div className="text-gray-600">
                Block: <span className="font-semibold">{blockNumber}</span>
              </div>
            )}
            {gasPrice && (
              <div className="flex items-center gap-1 text-gray-600">
                <Zap className="w-4 h-4" />
                <span>{gasPrice} Gwei</span>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
};

// ============================================================================
// Verification Certificate
// ============================================================================

export const VerificationCertificate: React.FC<VerificationCertificateProps> = ({
  trustId,
  trustName,
  amount,
  beneficiary,
  maturityDate,
  blockchainVerification,
  onDownload,
  isDownloading = false,
}) => {
  return (
    <Card className="p-8 bg-gradient-to-br from-amber-50 via-white to-amber-50 border-2 border-amber-200">
      {/* Header */}
      <div className="text-center mb-8 pb-8 border-b-2 border-amber-200">
        <h2 className="text-3xl font-bold text-amber-900 mb-2">
          Trust Verification Certificate
        </h2>
        <p className="text-amber-700">Blockchain-Verified Legal Document</p>
      </div>

      {/* Content */}
      <div className="space-y-6">
        {/* Trust Details */}
        <div className="grid grid-cols-2 gap-8">
          <div>
            <p className="text-sm font-medium text-gray-600 mb-1">Trust Name</p>
            <p className="text-lg font-semibold text-gray-900">{trustName}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600 mb-1">Amount</p>
            <p className="text-lg font-semibold text-gray-900">${amount}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600 mb-1">Beneficiary</p>
            <p className="text-sm font-mono text-gray-900 break-all">{beneficiary}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600 mb-1">Maturity Date</p>
            <p className="text-lg font-semibold text-gray-900">
              {new Date(maturityDate).toLocaleDateString()}
            </p>
          </div>
        </div>

        {/* Blockchain Verification */}
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            <h3 className="font-semibold text-green-900">Blockchain Verified</h3>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-700">Transaction Hash:</span>
              <code className="font-mono text-gray-900">
                {blockchainVerification.transactionHash.slice(0, 16)}...
              </code>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-700">Block Number:</span>
              <span className="font-semibold">#{blockchainVerification.blockNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-700">Verified At:</span>
              <span className="font-semibold">
                {new Date(blockchainVerification.verificationTimestamp).toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-6 border-t-2 border-amber-200 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Certificate ID: <span className="font-mono font-semibold">{trustId}</span>
          </div>
          {onDownload && (
            <Button
              onClick={onDownload}
              disabled={isDownloading}
              variant="default"
              className="gap-2"
            >
              {isDownloading && <RefreshCw className="w-4 h-4 animate-spin" />}
              <Download className="w-4 h-4" />
              Download Certificate
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
};

// ============================================================================
// Blockchain Status Timeline
// ============================================================================

export const BlockchainStatusTimeline: React.FC<{
  status: BlockchainStatus;
  createdAt: Date;
  verificationTimestamp?: Date | null;
}> = ({ status, createdAt, verificationTimestamp }) => {
  const steps = [
    { label: 'Created', date: createdAt, completed: true },
    {
      label: 'Pending',
      date: null,
      completed: status !== 'not_recorded',
    },
    {
      label: 'Verified',
      date: verificationTimestamp,
      completed: status === 'verified',
    },
  ];

  return (
    <div className="space-y-4">
      {steps.map((step, index) => (
        <div key={index} className="flex gap-4">
          {/* Timeline dot */}
          <div className="flex flex-col items-center">
            <div
              className={`w-4 h-4 rounded-full border-2 ${
                step.completed
                  ? 'bg-green-500 border-green-500'
                  : 'bg-white border-gray-300'
              }`}
            />
            {index < steps.length - 1 && (
              <div
                className={`w-0.5 h-12 ${
                  step.completed ? 'bg-green-500' : 'bg-gray-300'
                }`}
              />
            )}
          </div>

          {/* Timeline content */}
          <div className="pb-4">
            <p className="font-semibold text-gray-900">{step.label}</p>
            {step.date && (
              <p className="text-sm text-gray-600">
                {new Date(step.date).toLocaleString()}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default {
  BlockchainStatusBadge,
  BlockchainDetailsCard,
  NetworkStatusIndicator,
  VerificationCertificate,
  BlockchainStatusTimeline,
};
