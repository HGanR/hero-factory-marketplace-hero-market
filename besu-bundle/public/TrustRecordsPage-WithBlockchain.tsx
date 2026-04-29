/**
 * Trust Records Page - With Blockchain Integration
 * 
 * Complete Trust Records page that integrates Hyperledger Besu blockchain
 * for immutable record verification, compliance tracking, and document authenticity.
 */

'use client';

import React, { useState, useEffect } from 'react';
import {
  Plus,
  Search,
  Filter,
  Download,
  Eye,
  MoreVertical,
  AlertCircle,
  CheckCircle2,
  Clock,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  BlockchainStatusBadge,
  BlockchainDetailsCard,
  NetworkStatusIndicator,
  VerificationCertificate,
  BlockchainStatusTimeline,
} from '@/components/blockchain/BlockchainStatusComponents';
import useBlockchainTrust from '@/hooks/useBlockchainTrust';
import { useToast } from '@/hooks/useToast';

// ============================================================================
// Types
// ============================================================================

interface CreateTrustFormData {
  name: string;
  amount: string;
  beneficiary: string;
  maturityDate: Date;
  terms: string;
  privateKey?: string;
}

// ============================================================================
// Create Trust Dialog
// ============================================================================

const CreateTrustDialog: React.FC<{
  onSuccess?: () => void;
}> = ({ onSuccess }) => {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState<CreateTrustFormData>({
    name: '',
    amount: '',
    beneficiary: '',
    maturityDate: new Date(),
    terms: '',
  });

  const { createTrust, isCreating } = useBlockchainTrust();
  const toast = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await createTrust(formData);
      setOpen(false);
      setFormData({
        name: '',
        amount: '',
        beneficiary: '',
        maturityDate: new Date(),
        terms: '',
      });
      onSuccess?.();
    } catch (error) {
      // Error already handled by hook
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="w-4 h-4" />
          Create Trust
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create New Trust Record</DialogTitle>
          <DialogDescription>
            Create a new trust record. It will be automatically recorded on the blockchain.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Trust Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Trust Name
            </label>
            <Input
              type="text"
              placeholder="e.g., Family Trust 2024"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Amount (USD)
            </label>
            <Input
              type="number"
              placeholder="e.g., 50000"
              step="0.01"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              required
            />
          </div>

          {/* Beneficiary Address */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Beneficiary Ethereum Address
            </label>
            <Input
              type="text"
              placeholder="0x..."
              value={formData.beneficiary}
              onChange={(e) => setFormData({ ...formData, beneficiary: e.target.value })}
              required
              pattern="^0x[a-fA-F0-9]{40}$"
            />
            <p className="text-xs text-gray-500 mt-1">
              Must be a valid Ethereum address (0x...)
            </p>
          </div>

          {/* Maturity Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Maturity Date
            </label>
            <Input
              type="date"
              value={formData.maturityDate.toISOString().split('T')[0]}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  maturityDate: new Date(e.target.value),
                })
              }
              required
            />
          </div>

          {/* Terms */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Trust Terms
            </label>
            <textarea
              placeholder="Enter trust terms and conditions..."
              value={formData.terms}
              onChange={(e) => setFormData({ ...formData, terms: e.target.value })}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={4}
            />
          </div>

          {/* Private Key (Optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Private Key (Optional)
            </label>
            <Input
              type="password"
              placeholder="Leave empty to use default wallet"
              value={formData.privateKey || ''}
              onChange={(e) => setFormData({ ...formData, privateKey: e.target.value })}
            />
            <p className="text-xs text-gray-500 mt-1">
              Only provide if you want to sign with a specific account
            </p>
          </div>

          {/* Blockchain Info */}
          <Card className="p-4 bg-blue-50 border-blue-200">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-900">
                <p className="font-semibold mb-1">Blockchain Recording</p>
                <p>
                  This trust will be automatically recorded on the Hyperledger Besu blockchain
                  for immutable verification and compliance tracking.
                </p>
              </div>
            </div>
          </Card>

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isCreating} className="gap-2">
              {isCreating && <RefreshCw className="w-4 h-4 animate-spin" />}
              Create Trust
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// ============================================================================
// Trust Details Dialog
// ============================================================================

const TrustDetailsDialog: React.FC<{
  trustId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}> = ({ trustId, open, onOpenChange }) => {
  const {
    selectedTrust,
    blockchainDetails,
    getTrust,
    getBlockchainDetailsForTrust,
    verifyTrust,
    exportCertificate,
    isVerifying,
  } = useBlockchainTrust();

  const toast = useToast();
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (open) {
      getTrust(trustId);
      getBlockchainDetailsForTrust(trustId);
    }
  }, [open, trustId, getTrust, getBlockchainDetailsForTrust]);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const certificate = await exportCertificate(trustId);
      // In a real app, this would download as PDF or JSON
      console.log('Certificate:', certificate);
    } finally {
      setIsExporting(false);
    }
  };

  if (!selectedTrust) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{selectedTrust.name}</DialogTitle>
          <DialogDescription>
            Trust ID: {selectedTrust.id}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Network Status */}
          <NetworkStatusIndicator
            connected={true}
            blockNumber={blockchainDetails?.blockNumber}
            gasPrice={blockchainDetails?.gasPrice}
          />

          {/* Trust Details */}
          <Card className="p-6">
            <h3 className="font-semibold text-lg mb-4">Trust Details</h3>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-gray-600 mb-1">Amount</p>
                <p className="text-2xl font-bold text-gray-900">
                  ${selectedTrust.amount}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Beneficiary</p>
                <p className="text-sm font-mono text-gray-900 break-all">
                  {selectedTrust.beneficiary}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Maturity Date</p>
                <p className="text-lg font-semibold text-gray-900">
                  {new Date(selectedTrust.maturityDate).toLocaleDateString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Created</p>
                <p className="text-lg font-semibold text-gray-900">
                  {new Date(selectedTrust.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="col-span-2">
                <p className="text-sm text-gray-600 mb-1">Terms</p>
                <p className="text-gray-900">{selectedTrust.terms}</p>
              </div>
            </div>
          </Card>

          {/* Blockchain Details */}
          <BlockchainDetailsCard
            transactionHash={selectedTrust.transactionHash}
            blockNumber={selectedTrust.blockNumber}
            status={selectedTrust.blockchainStatus}
            verificationTimestamp={selectedTrust.verificationTimestamp}
            explorerUrl={`https://besu-explorer.example.com/tx/${selectedTrust.transactionHash}`}
            onVerify={() => verifyTrust(trustId)}
            isVerifying={isVerifying}
          />

          {/* Status Timeline */}
          <Card className="p-6">
            <h3 className="font-semibold text-lg mb-4">Verification Timeline</h3>
            <BlockchainStatusTimeline
              status={selectedTrust.blockchainStatus}
              createdAt={selectedTrust.createdAt}
              verificationTimestamp={selectedTrust.verificationTimestamp}
            />
          </Card>

          {/* Verification Certificate */}
          {selectedTrust.isVerified && (
            <VerificationCertificate
              trustId={selectedTrust.id}
              trustName={selectedTrust.name}
              amount={selectedTrust.amount}
              beneficiary={selectedTrust.beneficiary}
              maturityDate={selectedTrust.maturityDate}
              blockchainVerification={{
                transactionHash: selectedTrust.transactionHash!,
                blockNumber: selectedTrust.blockNumber!,
                verificationTimestamp: selectedTrust.verificationTimestamp!,
                explorerUrl: `https://besu-explorer.example.com/tx/${selectedTrust.transactionHash}`,
              }}
              onDownload={handleExport}
              isDownloading={isExporting}
            />
          )}

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            {selectedTrust.isVerified && (
              <Button onClick={handleExport} disabled={isExporting} className="gap-2">
                <Download className="w-4 h-4" />
                Download Certificate
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ============================================================================
// Trust Records Table Row
// ============================================================================

const TrustRecordRow: React.FC<{
  trust: any;
  onViewDetails: (trustId: string) => void;
}> = ({ trust, onViewDetails }) => {
  return (
    <tr className="border-b border-gray-200 hover:bg-gray-50 transition">
      <td className="px-6 py-4">
        <div>
          <p className="font-semibold text-gray-900">{trust.name}</p>
          <p className="text-sm text-gray-500">{trust.id}</p>
        </div>
      </td>
      <td className="px-6 py-4">
        <p className="font-semibold text-gray-900">${trust.amount}</p>
      </td>
      <td className="px-6 py-4">
        <p className="text-sm text-gray-600">
          {new Date(trust.maturityDate).toLocaleDateString()}
        </p>
      </td>
      <td className="px-6 py-4">
        <BlockchainStatusBadge status={trust.blockchainStatus} size="sm" />
      </td>
      <td className="px-6 py-4">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onViewDetails(trust.id)}
            className="gap-2"
          >
            <Eye className="w-4 h-4" />
            View
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onViewDetails(trust.id)}>
                View Details
              </DropdownMenuItem>
              {trust.transactionHash && (
                <DropdownMenuItem
                  asChild
                >
                  <a
                    href={`https://besu-explorer.example.com/tx/${trust.transactionHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View on Explorer
                  </a>
                </DropdownMenuItem>
              )}
              {trust.isVerified && (
                <DropdownMenuItem>Download Certificate</DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </td>
    </tr>
  );
};

// ============================================================================
// Trust Records Page
// ============================================================================

export default function TrustRecordsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTrustId, setSelectedTrustId] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const { getAllTrusts, networkStatus, isFetching } = useBlockchainTrust();
  const [trusts, setTrusts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load trusts on mount
  useEffect(() => {
    const loadTrusts = async () => {
      setIsLoading(true);
      try {
        const data = await getAllTrusts();
        setTrusts(data || []);
      } finally {
        setIsLoading(false);
      }
    };

    loadTrusts();
  }, [getAllTrusts]);

  // Filter trusts
  const filteredTrusts = trusts.filter((trust) => {
    const matchesSearch =
      trust.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      trust.id.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = !statusFilter || trust.blockchainStatus === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Statistics
  const stats = {
    total: trusts.length,
    verified: trusts.filter((t) => t.blockchainStatus === 'verified').length,
    pending: trusts.filter((t) => t.blockchainStatus === 'pending').length,
    failed: trusts.filter((t) => t.blockchainStatus === 'failed').length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Trust Records</h1>
          <p className="text-gray-600 mt-1">
            Manage and verify trust records on the blockchain
          </p>
        </div>
        <CreateTrustDialog onSuccess={() => getAllTrusts()} />
      </div>

      {/* Network Status */}
      {networkStatus && (
        <NetworkStatusIndicator
          connected={networkStatus.connected}
          blockNumber={networkStatus.blockNumber}
          gasPrice={networkStatus.gasPrice}
          chainId={networkStatus.chainId}
        />
      )}

      {/* Statistics */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="p-6">
          <p className="text-sm text-gray-600 mb-2">Total Trusts</p>
          <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
        </Card>
        <Card className="p-6 border-green-200 bg-green-50">
          <p className="text-sm text-green-700 mb-2">Verified</p>
          <p className="text-3xl font-bold text-green-900">{stats.verified}</p>
        </Card>
        <Card className="p-6 border-yellow-200 bg-yellow-50">
          <p className="text-sm text-yellow-700 mb-2">Pending</p>
          <p className="text-3xl font-bold text-yellow-900">{stats.pending}</p>
        </Card>
        <Card className="p-6 border-red-200 bg-red-50">
          <p className="text-sm text-red-700 mb-2">Failed</p>
          <p className="text-3xl font-bold text-red-900">{stats.failed}</p>
        </Card>
      </div>

      {/* Search and Filter */}
      <Card className="p-4">
        <div className="flex gap-4 items-center">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
            <Input
              placeholder="Search by name or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            {['verified', 'pending', 'failed'].map((status) => (
              <Button
                key={status}
                variant={statusFilter === status ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter(statusFilter === status ? null : status)}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </Button>
            ))}
          </div>
        </div>
      </Card>

      {/* Trusts Table */}
      <Card>
        {isLoading ? (
          <div className="p-12 text-center">
            <RefreshCw className="w-8 h-8 text-gray-400 animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Loading trust records...</p>
          </div>
        ) : filteredTrusts.length === 0 ? (
          <div className="p-12 text-center">
            <AlertCircle className="w-8 h-8 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No trust records found</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  Trust Name
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  Maturity Date
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredTrusts.map((trust) => (
                <TrustRecordRow
                  key={trust.id}
                  trust={trust}
                  onViewDetails={(trustId) => {
                    setSelectedTrustId(trustId);
                    setDetailsOpen(true);
                  }}
                />
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* Trust Details Dialog */}
      {selectedTrustId && (
        <TrustDetailsDialog
          trustId={selectedTrustId}
          open={detailsOpen}
          onOpenChange={setDetailsOpen}
        />
      )}
    </div>
  );
}
