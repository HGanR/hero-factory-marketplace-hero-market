/**
 * Trust Verification Button Component
 * 
 * Handles verification of trust records on Hyperledger Besu blockchain.
 * Provides UI feedback, loading states, and error handling.
 */

'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  ExternalLink,
  RefreshCw,
  Copy,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { BlockchainVerification } from '@/types/CertificateTypes';

// ============================================================================
// Types
// ============================================================================

interface TrustVerificationButtonProps {
  trustId: string;
  trustName: string;
  blockchainStatus: 'not_recorded' | 'pending' | 'syncing' | 'verified' | 'failed';
  transactionHash?: string;
  blockNumber?: number;
  verificationTimestamp?: Date;
  onVerificationComplete?: (verification: BlockchainVerification) => void;
  onError?: (error: Error) => void;
  forceRefresh?: boolean;
  showDetails?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'secondary' | 'outline' | 'ghost';
}

// ============================================================================
// Verification Status Badge
// ============================================================================

interface VerificationStatusBadgeProps {
  status: string;
  isVerified: boolean;
}

const VerificationStatusBadge: React.FC<VerificationStatusBadgeProps> = ({
  status,
  isVerified,
}) => {
  const statusConfig = {
    verified: {
      color: 'bg-green-100 text-green-800',
      icon: CheckCircle2,
      label: 'Verified',
    },
    pending: {
      color: 'bg-yellow-100 text-yellow-800',
      icon: Loader2,
      label: 'Pending',
    },
    syncing: {
      color: 'bg-blue-100 text-blue-800',
      icon: RefreshCw,
      label: 'Syncing',
    },
    failed: {
      color: 'bg-red-100 text-red-800',
      icon: AlertCircle,
      label: 'Failed',
    },
    not_recorded: {
      color: 'bg-gray-100 text-gray-800',
      icon: AlertCircle,
      label: 'Not Recorded',
    },
  };

  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.not_recorded;
  const Icon = config.icon;

  return (
    <Badge className={`${config.color} flex items-center gap-1`}>
      <Icon className="w-3 h-3" />
      {config.label}
    </Badge>
  );
};

// ============================================================================
// Verification Details Modal
// ============================================================================

interface VerificationDetailsModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  verification: BlockchainVerification | null;
  isLoading: boolean;
  error: string | null;
}

const VerificationDetailsModal: React.FC<VerificationDetailsModalProps> = ({
  isOpen,
  onOpenChange,
  verification,
  isLoading,
  error,
}) => {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
    toast.success('Copied to clipboard');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Blockchain Verification Details</DialogTitle>
          <DialogDescription>
            Complete verification information from Hyperledger Besu
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            <span className="ml-2">Verifying...</span>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-red-900">Verification Failed</h3>
                <p className="text-red-700 text-sm mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {verification && !isLoading && !error && (
          <div className="space-y-4">
            {/* Transaction Hash */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold text-gray-700">
                  Transaction Hash
                </label>
                <button
                  onClick={() =>
                    copyToClipboard(verification.transactionHash, 'txHash')
                  }
                  className="p-1 hover:bg-gray-200 rounded"
                >
                  {copiedField === 'txHash' ? (
                    <Check className="w-4 h-4 text-green-600" />
                  ) : (
                    <Copy className="w-4 h-4 text-gray-600" />
                  )}
                </button>
              </div>
              <p className="font-mono text-sm text-gray-900 break-all">
                {verification.transactionHash}
              </p>
            </div>

            <Separator />

            {/* Block Number */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-semibold text-gray-700">
                  Block Number
                </label>
                <p className="font-mono text-lg text-gray-900 mt-1">
                  {verification.blockNumber.toLocaleString()}
                </p>
              </div>

              {/* Chain ID */}
              <div>
                <label className="text-sm font-semibold text-gray-700">
                  Chain ID
                </label>
                <p className="font-mono text-lg text-gray-900 mt-1">
                  {verification.chainId || 'N/A'}
                </p>
              </div>
            </div>

            <Separator />

            {/* Verification Timestamp */}
            <div>
              <label className="text-sm font-semibold text-gray-700">
                Verification Timestamp
              </label>
              <p className="text-gray-900 mt-1">
                {verification.verificationTimestamp.toLocaleString()}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {verification.verificationTimestamp.toISOString()}
              </p>
            </div>

            <Separator />

            {/* Gas Used */}
            {verification.gasUsed && (
              <div>
                <label className="text-sm font-semibold text-gray-700">
                  Gas Used
                </label>
                <p className="font-mono text-gray-900 mt-1">
                  {parseInt(verification.gasUsed).toLocaleString()} wei
                </p>
              </div>
            )}

            {/* Contract Address */}
            {verification.contractAddress && (
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-semibold text-gray-700">
                    Contract Address
                  </label>
                  <button
                    onClick={() =>
                      copyToClipboard(verification.contractAddress!, 'contract')
                    }
                    className="p-1 hover:bg-gray-200 rounded"
                  >
                    {copiedField === 'contract' ? (
                      <Check className="w-4 h-4 text-green-600" />
                    ) : (
                      <Copy className="w-4 h-4 text-gray-600" />
                    )}
                  </button>
                </div>
                <p className="font-mono text-sm text-gray-900 break-all">
                  {verification.contractAddress}
                </p>
              </div>
            )}

            <Separator />

            {/* Explorer Link */}
            <div>
              <a
                href={verification.explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                View on Blockchain Explorer
              </a>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

// ============================================================================
// Main Verification Button Component
// ============================================================================

export const TrustVerificationButton: React.FC<TrustVerificationButtonProps> = ({
  trustId,
  trustName,
  blockchainStatus,
  transactionHash,
  blockNumber,
  verificationTimestamp,
  onVerificationComplete,
  onError,
  forceRefresh = false,
  showDetails = true,
  size = 'md',
  variant = 'secondary',
}) => {
  // State
  const [isVerifying, setIsVerifying] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [verification, setVerification] = useState<BlockchainVerification | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [verificationDetails, setVerificationDetails] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  // tRPC mutations
  const verifyTrustMutation = trpc.verification.verifyTrust.useMutation();
  const checkStatusQuery = trpc.verification.checkVerificationStatus.useQuery(
    { trustId },
    { enabled: blockchainStatus !== 'verified' }
  );

  // Handle verification
  const handleVerify = async () => {
    try {
      setIsVerifying(true);
      setError(null);

      console.log(`Starting verification for trust: ${trustName} (${trustId})`);

      // Call tRPC procedure
      const result = await verifyTrustMutation.mutateAsync({
        trustId,
        forceRefresh,
      });

      console.log('Verification result:', result);

      if (!result.success) {
        throw new Error(result.message || 'Verification failed');
      }

      // Set verification data
      setVerification(result.blockchainVerification);
      setVerificationDetails(result.verificationDetails);

      // Show success message
      toast.success('Trust verified on blockchain! ✓', {
        description: `Transaction: ${result.blockchainVerification.transactionHash.slice(0, 10)}...`,
      });

      // Call callback
      if (onVerificationComplete) {
        onVerificationComplete(result.blockchainVerification);
      }

      // Open details modal
      if (showDetails) {
        setIsDetailsOpen(true);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      console.error('Verification error:', err);

      setError(errorMessage);
      toast.error('Verification failed', {
        description: errorMessage,
      });

      if (onError) {
        onError(err instanceof Error ? err : new Error(errorMessage));
      }
    } finally {
      setIsVerifying(false);
    }
  };

  // Handle refresh
  const handleRefresh = async () => {
    try {
      setIsVerifying(true);
      setError(null);

      console.log(`Refreshing verification for trust: ${trustName}`);

      const result = await verifyTrustMutation.mutateAsync({
        trustId,
        forceRefresh: true,
      });

      if (result.success) {
        setVerification(result.blockchainVerification);
        setVerificationDetails(result.verificationDetails);
        toast.success('Verification refreshed');
        if (onVerificationComplete) {
          onVerificationComplete(result.blockchainVerification);
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      toast.error('Refresh failed', { description: errorMessage });
    } finally {
      setIsVerifying(false);
    }
  };

  // Handle copy transaction hash
  const handleCopyTxHash = () => {
    if (transactionHash) {
      navigator.clipboard.writeText(transactionHash);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('Transaction hash copied');
    }
  };

  // Determine button state
  const isVerified = blockchainStatus === 'verified';
  const isPending = blockchainStatus === 'pending' || blockchainStatus === 'syncing';
  const isFailed = blockchainStatus === 'failed';

  // Size classes
  const sizeClasses = {
    sm: 'h-8 px-2 text-xs',
    md: 'h-9 px-3 text-sm',
    lg: 'h-10 px-4 text-base',
  };

  return (
    <>
      <div className="flex items-center gap-2">
        {/* Status Badge */}
        <VerificationStatusBadge status={blockchainStatus} isVerified={isVerified} />

        {/* Verification Button */}
        {!isVerified ? (
          <Button
            onClick={handleVerify}
            disabled={isVerifying || isPending}
            variant={variant}
            size="sm"
            className={sizeClasses[size]}
          >
            {isVerifying || isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Verifying...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Verify
              </>
            )}
          </Button>
        ) : (
          <>
            {/* Verified - Show details button */}
            <Button
              onClick={() => setIsDetailsOpen(true)}
              variant="outline"
              size="sm"
              className={sizeClasses[size]}
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              View Details
            </Button>

            {/* Refresh button */}
            <Button
              onClick={handleRefresh}
              disabled={isVerifying}
              variant="ghost"
              size="sm"
              className={sizeClasses[size]}
            >
              <RefreshCw className={`w-4 h-4 ${isVerifying ? 'animate-spin' : ''}`} />
            </Button>

            {/* Copy transaction hash button */}
            {transactionHash && (
              <Button
                onClick={handleCopyTxHash}
                variant="ghost"
                size="sm"
                className={sizeClasses[size]}
                title="Copy transaction hash"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-green-600" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            )}
          </>
        )}

        {/* Error indicator */}
        {isFailed && (
          <div className="text-red-600 text-xs font-semibold">Error</div>
        )}
      </div>

      {/* Verification Details Modal */}
      <VerificationDetailsModal
        isOpen={isDetailsOpen}
        onOpenChange={setIsDetailsOpen}
        verification={verification}
        isLoading={isVerifying}
        error={error}
      />
    </>
  );
};

export default TrustVerificationButton;
