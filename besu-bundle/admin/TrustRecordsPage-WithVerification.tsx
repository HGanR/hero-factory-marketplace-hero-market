/**
 * Trust Records Page with Blockchain Verification
 * 
 * Displays trust records with blockchain verification status and controls.
 * Integrates verification button, status display, and certificate export.
 */

'use client';

import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  Eye,
  Plus,
  Search,
  Trash2,
  Edit,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { TrustVerificationButton } from '@/components/TrustVerificationButton';
import { BlockchainVerification } from '@/types/CertificateTypes';

// ============================================================================
// Types
// ============================================================================

interface TrustRecord {
  id: string;
  name: string;
  amount: string;
  beneficiary: string;
  maturityDate: Date;
  terms: string;
  createdAt: Date;
  blockchainStatus: 'not_recorded' | 'pending' | 'syncing' | 'verified' | 'failed';
  transactionHash: string | null;
  blockNumber: number | null;
  verificationTimestamp: Date | null;
  isVerified: boolean;
}

interface CreateTrustFormData {
  name: string;
  amount: string;
  beneficiary: string;
  maturityDate: string;
  terms: string;
}

// ============================================================================
// Trust Details Dialog
// ============================================================================

interface TrustDetailsDialogProps {
  trust: TrustRecord;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onVerificationComplete?: (verification: BlockchainVerification) => void;
}

const TrustDetailsDialog: React.FC<TrustDetailsDialogProps> = ({
  trust,
  isOpen,
  onOpenChange,
  onVerificationComplete,
}) => {
  const exportCertificateMutation =
    trpc.certificate.exportCertificate.useMutation();
  const [isExporting, setIsExporting] = useState(false);

  const handleExportCertificate = async () => {
    try {
      setIsExporting(true);

      // Check if trust is verified
      if (trust.blockchainStatus !== 'verified') {
        toast.error('Trust must be verified before exporting certificate');
        return;
      }

      // Call export procedure
      const result = await exportCertificateMutation.mutateAsync({
        trustId: trust.id,
        format: 'pdf',
        includeSignature: true,
      });

      if (result.success && result.pdfBase64) {
        // Create blob and download
        const blob = new Blob([Buffer.from(result.pdfBase64, 'base64')], {
          type: 'application/pdf',
        });

        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = result.filename || `${trust.name}_Certificate.pdf`;
        link.click();

        // Cleanup
        window.URL.revokeObjectURL(url);

        toast.success('Certificate exported successfully');
      } else {
        throw new Error(result.error || 'Export failed');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Export failed';
      toast.error('Certificate export failed', { description: message });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{trust.name}</DialogTitle>
          <DialogDescription>Trust record details and blockchain status</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Trust Details */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-semibold text-gray-600">
                Beneficiary
              </Label>
              <p className="text-sm font-medium mt-1">{trust.beneficiary}</p>
            </div>

            <div>
              <Label className="text-xs font-semibold text-gray-600">Amount</Label>
              <p className="text-sm font-medium mt-1">${parseFloat(trust.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
            </div>

            <div>
              <Label className="text-xs font-semibold text-gray-600">
                Maturity Date
              </Label>
              <p className="text-sm font-medium mt-1">
                {new Date(trust.maturityDate).toLocaleDateString()}
              </p>
            </div>

            <div>
              <Label className="text-xs font-semibold text-gray-600">
                Created
              </Label>
              <p className="text-sm font-medium mt-1">
                {new Date(trust.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>

          {/* Terms */}
          <div>
            <Label className="text-xs font-semibold text-gray-600">Terms</Label>
            <p className="text-sm mt-2 p-3 bg-gray-50 rounded border border-gray-200">
              {trust.terms}
            </p>
          </div>

          {/* Blockchain Status */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              {trust.blockchainStatus === 'verified' ? (
                <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <h3 className="font-semibold text-sm">
                  Blockchain Status: {trust.blockchainStatus.toUpperCase()}
                </h3>
                {trust.blockchainStatus === 'verified' && (
                  <>
                    <p className="text-xs text-gray-600 mt-2">
                      <strong>Transaction:</strong>{' '}
                      <code className="bg-white px-2 py-1 rounded text-xs break-all">
                        {trust.transactionHash?.slice(0, 20)}...
                      </code>
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      <strong>Block:</strong> #{trust.blockNumber?.toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      <strong>Verified:</strong>{' '}
                      {trust.verificationTimestamp
                        ? new Date(trust.verificationTimestamp).toLocaleString()
                        : 'N/A'}
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Blockchain Verification */}
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <h3 className="font-semibold text-sm mb-3">Blockchain Verification</h3>
            <TrustVerificationButton
              trustId={trust.id}
              trustName={trust.name}
              blockchainStatus={trust.blockchainStatus}
              transactionHash={trust.transactionHash || undefined}
              blockNumber={trust.blockNumber || undefined}
              verificationTimestamp={
                trust.verificationTimestamp
                  ? new Date(trust.verificationTimestamp)
                  : undefined
              }
              onVerificationComplete={onVerificationComplete}
              showDetails={true}
              size="md"
              variant="secondary"
            />
          </div>

          {/* Export Certificate Button */}
          {trust.blockchainStatus === 'verified' && (
            <Button
              onClick={handleExportCertificate}
              disabled={isExporting}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Exporting Certificate...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Export Blockchain-Verified Certificate
                </>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ============================================================================
// Create Trust Dialog
// ============================================================================

interface CreateTrustDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onTrustCreated?: () => void;
}

const CreateTrustDialog: React.FC<CreateTrustDialogProps> = ({
  isOpen,
  onOpenChange,
  onTrustCreated,
}) => {
  const [formData, setFormData] = useState<CreateTrustFormData>({
    name: '',
    amount: '',
    beneficiary: '',
    maturityDate: '',
    terms: '',
  });

  const createTrustMutation = trpc.trust.createTrust.useMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (!formData.name || !formData.amount || !formData.beneficiary) {
        toast.error('Please fill in all required fields');
        return;
      }

      await createTrustMutation.mutateAsync({
        name: formData.name,
        amount: formData.amount,
        beneficiary: formData.beneficiary,
        maturityDate: new Date(formData.maturityDate),
        terms: formData.terms,
      });

      toast.success('Trust record created successfully');
      setFormData({
        name: '',
        amount: '',
        beneficiary: '',
        maturityDate: '',
        terms: '',
      });
      onOpenChange(false);

      if (onTrustCreated) {
        onTrustCreated();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Creation failed';
      toast.error('Failed to create trust', { description: message });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create Trust Record</DialogTitle>
          <DialogDescription>
            Add a new trust record to the system
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Trust Name *</Label>
            <Input
              id="name"
              placeholder="e.g., Smith Family Trust"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              required
            />
          </div>

          <div>
            <Label htmlFor="amount">Amount *</Label>
            <Input
              id="amount"
              type="number"
              placeholder="50000.00"
              step="0.01"
              value={formData.amount}
              onChange={(e) =>
                setFormData({ ...formData, amount: e.target.value })
              }
              required
            />
          </div>

          <div>
            <Label htmlFor="beneficiary">Beneficiary *</Label>
            <Input
              id="beneficiary"
              placeholder="John Smith"
              value={formData.beneficiary}
              onChange={(e) =>
                setFormData({ ...formData, beneficiary: e.target.value })
              }
              required
            />
          </div>

          <div>
            <Label htmlFor="maturityDate">Maturity Date *</Label>
            <Input
              id="maturityDate"
              type="date"
              value={formData.maturityDate}
              onChange={(e) =>
                setFormData({ ...formData, maturityDate: e.target.value })
              }
              required
            />
          </div>

          <div>
            <Label htmlFor="terms">Terms</Label>
            <Textarea
              id="terms"
              placeholder="Trust terms and conditions..."
              value={formData.terms}
              onChange={(e) =>
                setFormData({ ...formData, terms: e.target.value })
              }
              rows={4}
            />
          </div>

          <Button
            type="submit"
            disabled={createTrustMutation.isPending}
            className="w-full"
          >
            {createTrustMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Trust Record'
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// ============================================================================
// Main Trust Records Page
// ============================================================================

export default function TrustRecordsPage() {
  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedTrust, setSelectedTrust] = useState<TrustRecord | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // tRPC queries
  const { data: trusts = [], isLoading, refetch } = trpc.trust.getAllTrusts.useQuery();

  // Filter trusts
  const filteredTrusts = trusts.filter((trust) => {
    const matchesSearch =
      trust.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      trust.beneficiary.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === 'all' || trust.blockchainStatus === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Handle verification complete
  const handleVerificationComplete = useCallback(() => {
    refetch();
  }, [refetch]);

  // Handle trust details open
  const handleOpenDetails = (trust: TrustRecord) => {
    setSelectedTrust(trust);
    setIsDetailsOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Trust Records</h1>
          <p className="text-gray-600 mt-1">
            Manage and verify trust records on blockchain
          </p>
        </div>

        <Button onClick={() => setIsCreateOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          Create Trust Record
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search by name or beneficiary..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="verified">Verified</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="syncing">Syncing</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="not_recorded">Not Recorded</SelectItem>
          </SelectContent>
        </Select>

        <Button
          onClick={() => refetch()}
          variant="outline"
          size="icon"
          disabled={isLoading}
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Trust Records Table */}
      <Card>
        <CardHeader>
          <CardTitle>Trust Records</CardTitle>
          <CardDescription>
            {filteredTrusts.length} record{filteredTrusts.length !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
              <span className="ml-2">Loading trust records...</span>
            </div>
          ) : filteredTrusts.length === 0 ? (
            <div className="text-center py-8">
              <AlertCircle className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-600">No trust records found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Beneficiary</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Maturity Date</TableHead>
                    <TableHead>Blockchain Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTrusts.map((trust) => (
                    <TableRow key={trust.id}>
                      <TableCell className="font-medium">{trust.name}</TableCell>
                      <TableCell>{trust.beneficiary}</TableCell>
                      <TableCell>
                        ${parseFloat(trust.amount).toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                        })}
                      </TableCell>
                      <TableCell>
                        {new Date(trust.maturityDate).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {trust.blockchainStatus === 'verified' ? (
                            <>
                              <CheckCircle2 className="w-4 h-4 text-green-600" />
                              <span className="text-xs font-semibold text-green-600">
                                Verified
                              </span>
                            </>
                          ) : trust.blockchainStatus === 'failed' ? (
                            <>
                              <AlertCircle className="w-4 h-4 text-red-600" />
                              <span className="text-xs font-semibold text-red-600">
                                Failed
                              </span>
                            </>
                          ) : (
                            <>
                              <Loader2 className="w-4 h-4 text-yellow-600 animate-spin" />
                              <span className="text-xs font-semibold text-yellow-600">
                                {trust.blockchainStatus}
                              </span>
                            </>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            onClick={() => handleOpenDetails(trust)}
                            variant="ghost"
                            size="sm"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" disabled>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" disabled>
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      {selectedTrust && (
        <TrustDetailsDialog
          trust={selectedTrust}
          isOpen={isDetailsOpen}
          onOpenChange={setIsDetailsOpen}
          onVerificationComplete={handleVerificationComplete}
        />
      )}

      <CreateTrustDialog
        isOpen={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onTrustCreated={() => refetch()}
      />
    </div>
  );
}
