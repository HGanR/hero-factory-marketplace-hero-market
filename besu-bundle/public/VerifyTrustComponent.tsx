import React, { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, CheckCircle, XCircle, AlertCircle, Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";

/**
 * Props for VerifyTrustComponent
 */
interface VerifyTrustComponentProps {
  trustId: string;
  trustName: string;
  currentBlockchainStatus?: string;
  onVerificationComplete?: (result: any) => void;
}

/**
 * Status badge component
 */
interface VerificationStatusBadgeProps {
  status: "verified" | "pending" | "failed" | "not_recorded" | "partial";
  isLoading?: boolean;
}

const VerificationStatusBadge: React.FC<VerificationStatusBadgeProps> = ({
  status,
  isLoading,
}) => {
  const statusConfig = {
    verified: {
      icon: CheckCircle,
      label: "Verified",
      className: "bg-green-100 text-green-800",
    },
    pending: {
      icon: Loader2,
      label: "Verifying",
      className: "bg-blue-100 text-blue-800",
    },
    failed: {
      icon: XCircle,
      label: "Failed",
      className: "bg-red-100 text-red-800",
    },
    not_recorded: {
      icon: AlertCircle,
      label: "Not Recorded",
      className: "bg-yellow-100 text-yellow-800",
    },
    partial: {
      icon: AlertCircle,
      label: "Partial",
      className: "bg-orange-100 text-orange-800",
    },
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <Badge className={`${config.className} flex items-center gap-2`}>
      <Icon className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
      {config.label}
    </Badge>
  );
};

/**
 * Verification details modal component
 */
interface VerificationDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  verificationDetails: any;
  transactionHash?: string;
  blockNumber?: number;
  contractAddress?: string;
  verifiedAt?: string;
}

const VerificationDetailsModal: React.FC<VerificationDetailsModalProps> = ({
  isOpen,
  onClose,
  verificationDetails,
  transactionHash,
  blockNumber,
  contractAddress,
  verifiedAt,
}) => {
  const handleCopyHash = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const besuExplorerUrl = process.env.REACT_APP_BESU_EXPLORER_URL || "http://localhost:4000";

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Blockchain Verification Details</DialogTitle>
          <DialogDescription>
            Complete verification information from Hyperledger Besu
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Verification Checks */}
          <div className="space-y-2">
            <h3 className="font-semibold">Verification Checks</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <span>Instrument Exists</span>
                {verificationDetails?.instrumentExists ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600" />
                )}
              </div>
              <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <span>Issuer Authorized</span>
                {verificationDetails?.issuerAuthorized ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600" />
                )}
              </div>
              <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <span>Document Hash Matches</span>
                {verificationDetails?.documentHashMatches ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600" />
                )}
              </div>
            </div>
          </div>

          {/* Blockchain Details */}
          <div className="space-y-2">
            <h3 className="font-semibold">Blockchain Details</h3>
            <div className="space-y-2 text-sm">
              {transactionHash && (
                <div className="p-2 bg-gray-50 rounded">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Transaction Hash</span>
                    <button
                      onClick={() => handleCopyHash(transactionHash)}
                      className="flex items-center gap-1 text-blue-600 hover:text-blue-800"
                    >
                      <span className="font-mono text-xs">
                        {transactionHash.slice(0, 10)}...{transactionHash.slice(-8)}
                      </span>
                      <Copy className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              )}

              {blockNumber && (
                <div className="p-2 bg-gray-50 rounded">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Block Number</span>
                    <span className="font-mono">{blockNumber}</span>
                  </div>
                </div>
              )}

              {contractAddress && (
                <div className="p-2 bg-gray-50 rounded">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Contract Address</span>
                    <button
                      onClick={() => handleCopyHash(contractAddress)}
                      className="flex items-center gap-1 text-blue-600 hover:text-blue-800"
                    >
                      <span className="font-mono text-xs">
                        {contractAddress.slice(0, 10)}...{contractAddress.slice(-8)}
                      </span>
                      <Copy className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              )}

              {verifiedAt && (
                <div className="p-2 bg-gray-50 rounded">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Verified At</span>
                    <span className="text-xs">
                      {new Date(verifiedAt).toLocaleString()}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Explorer Link */}
          {transactionHash && (
            <div>
              <a
                href={`${besuExplorerUrl}/tx/${transactionHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm"
              >
                View on Block Explorer
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

/**
 * Main VerifyTrustComponent
 */
export const VerifyTrustComponent: React.FC<VerifyTrustComponentProps> = ({
  trustId,
  trustName,
  currentBlockchainStatus = "not_recorded",
  onVerificationComplete,
}) => {
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [verificationResult, setVerificationResult] = useState<any>(null);

  // tRPC mutation hook
  const { mutate: verifyTrust, isPending: isVerifying } =
    trpc.blockchain.verifyTrust.useMutation({
      onSuccess: (data) => {
        console.log("Verification successful:", data);
        setVerificationResult(data);

        if (data.success) {
          toast.success(data.message);
        } else {
          toast.warning(data.message);
        }

        if (onVerificationComplete) {
          onVerificationComplete(data);
        }
      },
      onError: (error) => {
        console.error("Verification failed:", error);
        toast.error(error.message || "Verification failed");
      },
    });

  // Determine current status
  const getDisplayStatus = () => {
    if (isVerifying) return "pending";
    if (verificationResult?.isVerified) return "verified";
    if (verificationResult?.blockchainStatus === "failed") return "failed";
    if (verificationResult?.blockchainStatus === "partial") return "partial";
    return currentBlockchainStatus as any;
  };

  const displayStatus = getDisplayStatus();
  const isVerified = displayStatus === "verified";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Blockchain Verification</CardTitle>
            <CardDescription>{trustName}</CardDescription>
          </div>
          <VerificationStatusBadge status={displayStatus} isLoading={isVerifying} />
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Status Message */}
        {verificationResult && (
          <div
            className={`p-3 rounded-lg text-sm ${
              verificationResult.success
                ? "bg-green-50 text-green-800"
                : "bg-red-50 text-red-800"
            }`}
          >
            {verificationResult.message}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          {!isVerified ? (
            <Button
              onClick={() => verifyTrust({ trustId })}
              disabled={isVerifying || currentBlockchainStatus === "not_recorded"}
              className="flex-1"
            >
              {isVerifying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isVerifying ? "Verifying..." : "Verify on Blockchain"}
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => setIsDetailsOpen(true)}
                className="flex-1"
              >
                View Details
              </Button>
              <Button
                variant="outline"
                onClick={() => verifyTrust({ trustId })}
                disabled={isVerifying}
              >
                {isVerifying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Refresh
              </Button>
            </>
          )}
        </div>

        {/* Verification Details */}
        {verificationResult?.verificationDetails && (
          <div className="space-y-2 text-sm">
            <h4 className="font-semibold">Verification Results</h4>
            <div className="space-y-1 text-gray-600">
              <div className="flex items-center justify-between">
                <span>Instrument Exists</span>
                {verificationResult.verificationDetails.instrumentExists ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600" />
                )}
              </div>
              <div className="flex items-center justify-between">
                <span>Issuer Authorized</span>
                {verificationResult.verificationDetails.issuerAuthorized ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600" />
                )}
              </div>
              <div className="flex items-center justify-between">
                <span>Document Hash Matches</span>
                {verificationResult.verificationDetails.documentHashMatches ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600" />
                )}
              </div>
            </div>
          </div>
        )}

        {/* Help Text */}
        {currentBlockchainStatus === "not_recorded" && (
          <div className="p-3 bg-yellow-50 text-yellow-800 text-sm rounded-lg">
            This trust has not been recorded on the blockchain yet. Record it first before
            verification.
          </div>
        )}
      </CardContent>

      {/* Details Modal */}
      <VerificationDetailsModal
        isOpen={isDetailsOpen}
        onClose={() => setIsDetailsOpen(false)}
        verificationDetails={verificationResult?.verificationDetails}
        transactionHash={verificationResult?.transactionHash}
        blockNumber={verificationResult?.blockNumber}
        contractAddress={verificationResult?.contractAddress}
        verifiedAt={verificationResult?.verifiedAt}
      />
    </Card>
  );
};

/**
 * Usage Example in Trust Records Page:
 * 
 * import { VerifyTrustComponent } from "@/components/blockchain/VerifyTrustComponent";
 * 
 * export default function TrustRecordsPage() {
 *   const trust = {
 *     id: "trust-123",
 *     trustName: "Smith Family Trust",
 *     blockchainStatus: "not_recorded",
 *   };
 * 
 *   return (
 *     <div className="space-y-4">
 *       <VerifyTrustComponent
 *         trustId={trust.id}
 *         trustName={trust.trustName}
 *         currentBlockchainStatus={trust.blockchainStatus}
 *         onVerificationComplete={(result) => {
 *           console.log("Verification completed:", result);
 *           // Refresh trust data or update UI
 *         }}
 *       />
 *     </div>
 *   );
 * }
 */

export default VerifyTrustComponent;
