/**
 * useBlockchainTrust Hook
 * 
 * React hook for managing blockchain-enabled trust operations.
 * Handles creating, verifying, and managing trust records with blockchain integration.
 */

import { useState, useCallback, useEffect } from 'react';
import { trpc } from '@/utils/trpc';
import { useToast } from '@/hooks/useToast';

// ============================================================================
// Types
// ============================================================================

export type BlockchainStatus = 'pending' | 'syncing' | 'verified' | 'failed' | 'not_recorded';

export interface TrustRecord {
  id: string;
  userId: string;
  name: string;
  amount: string;
  beneficiary: string;
  createdAt: Date;
  maturityDate: Date;
  terms: string;
  blockchainStatus: BlockchainStatus;
  transactionHash: string | null;
  blockNumber: number | null;
  contractAddress: string | null;
  verificationTimestamp: Date | null;
  isVerified: boolean;
}

export interface BlockchainDetails {
  status: BlockchainStatus;
  transactionHash?: string;
  blockNumber?: number;
  gasUsed?: string;
  timestamp?: Date;
  explorerUrl?: string;
  message?: string;
}

export interface VerificationCertificate {
  trustId: string;
  trustName: string;
  amount: string;
  beneficiary: string;
  maturityDate: Date;
  terms: string;
  blockchainVerification: {
    transactionHash: string;
    blockNumber: number;
    verificationTimestamp: Date;
    explorerUrl: string;
  };
  certificateGeneratedAt: Date;
  certificateId: string;
}

export interface BlockchainNetworkStatus {
  connected: boolean;
  chainId?: number;
  blockNumber?: number;
  gasPrice?: string;
  rpcUrl?: string;
  error?: string;
}

// ============================================================================
// useBlockchainTrust Hook
// ============================================================================

export function useBlockchainTrust() {
  const toast = useToast();

  // ========================================================================
  // State
  // ========================================================================

  const [isCreating, setIsCreating] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [selectedTrust, setSelectedTrust] = useState<TrustRecord | null>(null);
  const [blockchainDetails, setBlockchainDetails] = useState<BlockchainDetails | null>(null);
  const [networkStatus, setNetworkStatus] = useState<BlockchainNetworkStatus | null>(null);

  // ========================================================================
  // tRPC Queries & Mutations
  // ========================================================================

  const createTrustMutation = trpc.trustBlockchain.createTrustWithBlockchain.useMutation();
  const getTrustQuery = trpc.trustBlockchain.getTrustWithBlockchain.useQuery;
  const getAllTrustsQuery = trpc.trustBlockchain.getAllTrustsWithBlockchain.useQuery;
  const verifyTrustMutation = trpc.trustBlockchain.verifyTrustBlockchain.useMutation();
  const getBlockchainDetailsMutation = trpc.trustBlockchain.getBlockchainDetails.useMutation();
  const exportCertificateMutation = trpc.trustBlockchain.exportVerificationCertificate.useMutation();
  const getNetworkStatusMutation = trpc.trustBlockchain.getBlockchainStatus.useMutation();
  const retryRecordingMutation = trpc.trustBlockchain.retryBlockchainRecording.useMutation();

  // ========================================================================
  // Create Trust
  // ========================================================================

  const createTrust = useCallback(
    async (data: {
      name: string;
      amount: string;
      beneficiary: string;
      maturityDate: Date;
      terms: string;
      privateKey?: string;
    }) => {
      setIsCreating(true);
      try {
        const result = await createTrustMutation.mutateAsync(data);

        toast.success('Trust created successfully!');
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to create trust';
        toast.error(message);
        throw error;
      } finally {
        setIsCreating(false);
      }
    },
    [createTrustMutation, toast]
  );

  // ========================================================================
  // Get Trust
  // ========================================================================

  const getTrust = useCallback(
    async (trustId: string) => {
      setIsFetching(true);
      try {
        const result = await getTrustQuery({ trustId }).promise;
        setSelectedTrust(result);
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to fetch trust';
        toast.error(message);
        throw error;
      } finally {
        setIsFetching(false);
      }
    },
    [getTrustQuery, toast]
  );

  // ========================================================================
  // Get All Trusts
  // ========================================================================

  const getAllTrusts = useCallback(async () => {
    setIsFetching(true);
    try {
      const result = await getAllTrustsQuery().promise;
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch trusts';
      toast.error(message);
      throw error;
    } finally {
      setIsFetching(false);
    }
  }, [getAllTrustsQuery, toast]);

  // ========================================================================
  // Verify Trust
  // ========================================================================

  const verifyTrust = useCallback(
    async (trustId: string) => {
      setIsVerifying(true);
      try {
        const result = await verifyTrustMutation.mutateAsync({ trustId });

        if (result.isVerified) {
          toast.success('Trust verified on blockchain!');
        } else {
          toast.error('Trust verification failed');
        }

        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to verify trust';
        toast.error(message);
        throw error;
      } finally {
        setIsVerifying(false);
      }
    },
    [verifyTrustMutation, toast]
  );

  // ========================================================================
  // Get Blockchain Details
  // ========================================================================

  const getBlockchainDetailsForTrust = useCallback(
    async (trustId: string) => {
      try {
        const result = await getBlockchainDetailsMutation.mutateAsync({ trustId });
        setBlockchainDetails(result);
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to fetch blockchain details';
        toast.error(message);
        throw error;
      }
    },
    [getBlockchainDetailsMutation, toast]
  );

  // ========================================================================
  // Export Certificate
  // ========================================================================

  const exportCertificate = useCallback(
    async (trustId: string) => {
      try {
        const result = await exportCertificateMutation.mutateAsync({ trustId });

        if (result.success) {
          toast.success('Certificate exported successfully!');
          return result.certificate;
        } else {
          throw new Error('Failed to export certificate');
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to export certificate';
        toast.error(message);
        throw error;
      }
    },
    [exportCertificateMutation, toast]
  );

  // ========================================================================
  // Get Network Status
  // ========================================================================

  const checkNetworkStatus = useCallback(async () => {
    try {
      const result = await getNetworkStatusMutation.mutateAsync();
      setNetworkStatus(result);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to check network status';
      console.error(message);
      setNetworkStatus({
        connected: false,
        error: message,
      });
      return null;
    }
  }, [getNetworkStatusMutation]);

  // ========================================================================
  // Retry Recording
  // ========================================================================

  const retryBlockchainRecording = useCallback(
    async (trustId: string, privateKey?: string) => {
      try {
        const result = await retryRecordingMutation.mutateAsync({
          trustId,
          privateKey,
        });

        toast.success('Retrying blockchain recording...');
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to retry recording';
        toast.error(message);
        throw error;
      }
    },
    [retryRecordingMutation, toast]
  );

  // ========================================================================
  // Auto-check Network Status
  // ========================================================================

  useEffect(() => {
    checkNetworkStatus();
    const interval = setInterval(checkNetworkStatus, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, [checkNetworkStatus]);

  // ========================================================================
  // Return Hook API
  // ========================================================================

  return {
    // State
    isCreating,
    isVerifying,
    isFetching,
    selectedTrust,
    blockchainDetails,
    networkStatus,

    // Methods
    createTrust,
    getTrust,
    getAllTrusts,
    verifyTrust,
    getBlockchainDetailsForTrust,
    exportCertificate,
    checkNetworkStatus,
    retryBlockchainRecording,

    // Setters
    setSelectedTrust,
    setBlockchainDetails,
  };
}

export default useBlockchainTrust;
