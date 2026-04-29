/**
 * Dashboard Blockchain Section
 * 
 * Displays blockchain status, metrics, and recent activities
 * on the main dashboard.
 */

'use client';

import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  CheckCircle2,
  Clock,
  AlertCircle,
  Zap,
  Activity,
  RefreshCw,
  ArrowRight,
  ExternalLink,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import useBlockchainTrust from '@/hooks/useBlockchainTrust';

// ============================================================================
// Types
// ============================================================================

interface BlockchainMetric {
  timestamp: Date;
  transactionsPerSecond: number;
  gasPrice: number;
  blockTime: number;
}

interface RecentActivity {
  id: string;
  type: 'created' | 'verified' | 'failed' | 'exported';
  trustName: string;
  timestamp: Date;
  status: 'success' | 'pending' | 'failed';
  transactionHash?: string;
}

// ============================================================================
// Blockchain Status Card
// ============================================================================

const BlockchainStatusCard: React.FC = () => {
  const { networkStatus, checkNetworkStatus } = useBlockchainTrust();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await checkNetworkStatus();
    } finally {
      setIsRefreshing(false);
    }
  };

  if (!networkStatus) {
    return null;
  }

  return (
    <Card className="p-6 bg-gradient-to-br from-slate-50 to-slate-100 border-slate-200">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Blockchain Network</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <div className="space-y-4">
        {/* Connection Status */}
        <div className="flex items-center justify-between p-4 bg-white rounded-lg border border-slate-200">
          <div className="flex items-center gap-3">
            {networkStatus.connected ? (
              <>
                <Wifi className="w-5 h-5 text-green-600" />
                <div>
                  <p className="font-semibold text-gray-900">Connected</p>
                  <p className="text-sm text-gray-600">Hyperledger Besu</p>
                </div>
              </>
            ) : (
              <>
                <WifiOff className="w-5 h-5 text-red-600" />
                <div>
                  <p className="font-semibold text-gray-900">Disconnected</p>
                  <p className="text-sm text-gray-600">Unable to reach node</p>
                </div>
              </>
            )}
          </div>
          <Badge variant={networkStatus.connected ? 'default' : 'destructive'}>
            {networkStatus.connected ? 'Live' : 'Offline'}
          </Badge>
        </div>

        {/* Network Details */}
        {networkStatus.connected && (
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 bg-white rounded-lg border border-slate-200">
              <p className="text-xs text-gray-600 mb-1">Chain ID</p>
              <p className="text-lg font-semibold text-gray-900">{networkStatus.chainId}</p>
            </div>
            <div className="p-3 bg-white rounded-lg border border-slate-200">
              <p className="text-xs text-gray-600 mb-1">Block #</p>
              <p className="text-lg font-semibold text-gray-900">{networkStatus.blockNumber}</p>
            </div>
            <div className="p-3 bg-white rounded-lg border border-slate-200">
              <p className="text-xs text-gray-600 mb-1">Gas Price</p>
              <p className="text-lg font-semibold text-gray-900">{networkStatus.gasPrice} Gwei</p>
            </div>
          </div>
        )}

        {!networkStatus.connected && networkStatus.error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-900">{networkStatus.error}</p>
          </div>
        )}
      </div>
    </Card>
  );
};

// ============================================================================
// Trust Metrics Card
// ============================================================================

const TrustMetricsCard: React.FC<{
  totalTrusts: number;
  verifiedTrusts: number;
  pendingTrusts: number;
  failedTrusts: number;
}> = ({ totalTrusts, verifiedTrusts, pendingTrusts, failedTrusts }) => {
  const verificationRate = totalTrusts > 0 ? Math.round((verifiedTrusts / totalTrusts) * 100) : 0;

  return (
    <Card className="p-6 bg-gradient-to-br from-blue-50 to-cyan-50 border-cyan-200">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">Trust Records Status</h3>

      <div className="space-y-4">
        {/* Verification Rate */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-700">Verification Rate</p>
            <p className="text-2xl font-bold text-cyan-600">{verificationRate}%</p>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-gradient-to-r from-cyan-500 to-blue-500 h-2 rounded-full transition-all"
              style={{ width: `${verificationRate}%` }}
            />
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-3 pt-4 border-t border-cyan-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <TrendingUp className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-600">Total</p>
              <p className="text-lg font-bold text-gray-900">{totalTrusts}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-gray-600">Verified</p>
              <p className="text-lg font-bold text-green-900">{verifiedTrusts}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-xs text-gray-600">Pending</p>
              <p className="text-lg font-bold text-yellow-900">{pendingTrusts}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-xs text-gray-600">Failed</p>
              <p className="text-lg font-bold text-red-900">{failedTrusts}</p>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};

// ============================================================================
// Transaction Activity Chart
// ============================================================================

const TransactionActivityChart: React.FC<{
  data: BlockchainMetric[];
}> = ({ data }) => {
  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">Transaction Activity</h3>

      {data.length > 0 ? (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="timestamp"
              tickFormatter={(date) => new Date(date).toLocaleTimeString()}
              stroke="#6b7280"
            />
            <YAxis stroke="#6b7280" />
            <Tooltip
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: '0.5rem',
              }}
              formatter={(value) => [value, 'Tx/sec']}
            />
            <Line
              type="monotone"
              dataKey="transactionsPerSecond"
              stroke="#06b6d4"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
          <p className="text-gray-600">No activity data available</p>
        </div>
      )}
    </Card>
  );
};

// ============================================================================
// Recent Activities
// ============================================================================

const RecentActivitiesCard: React.FC<{
  activities: RecentActivity[];
}> = ({ activities }) => {
  const getActivityIcon = (type: RecentActivity['type']) => {
    switch (type) {
      case 'created':
        return <CheckCircle2 className="w-5 h-5 text-blue-600" />;
      case 'verified':
        return <CheckCircle2 className="w-5 h-5 text-green-600" />;
      case 'failed':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      case 'exported':
        return <Activity className="w-5 h-5 text-purple-600" />;
    }
  };

  const getActivityLabel = (type: RecentActivity['type']) => {
    switch (type) {
      case 'created':
        return 'Created';
      case 'verified':
        return 'Verified';
      case 'failed':
        return 'Failed';
      case 'exported':
        return 'Exported';
    }
  };

  const getStatusColor = (status: RecentActivity['status']) => {
    switch (status) {
      case 'success':
        return 'bg-green-50 border-green-200';
      case 'pending':
        return 'bg-yellow-50 border-yellow-200';
      case 'failed':
        return 'bg-red-50 border-red-200';
    }
  };

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">Recent Activities</h3>

      {activities.length > 0 ? (
        <div className="space-y-3">
          {activities.map((activity) => (
            <div
              key={activity.id}
              className={`p-4 rounded-lg border ${getStatusColor(activity.status)}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  {getActivityIcon(activity.type)}
                  <div>
                    <p className="font-medium text-gray-900">{activity.trustName}</p>
                    <p className="text-sm text-gray-600">
                      {getActivityLabel(activity.type)} • {new Date(activity.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>

                {activity.transactionHash && (
                  <a
                    href={`https://besu-explorer.example.com/tx/${activity.transactionHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 hover:bg-white/50 rounded transition"
                  >
                    <ExternalLink className="w-4 h-4 text-gray-600" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-8 text-center bg-gray-50 rounded-lg">
          <Activity className="w-8 h-8 text-gray-400 mx-auto mb-2" />
          <p className="text-gray-600">No recent activities</p>
        </div>
      )}
    </Card>
  );
};

// ============================================================================
// Gas Price Indicator
// ============================================================================

const GasPriceIndicator: React.FC<{
  gasPrice: string;
  trend: 'up' | 'down' | 'stable';
}> = ({ gasPrice, trend }) => {
  const getTrendColor = () => {
    switch (trend) {
      case 'up':
        return 'text-red-600';
      case 'down':
        return 'text-green-600';
      case 'stable':
        return 'text-gray-600';
    }
  };

  const getTrendIcon = () => {
    switch (trend) {
      case 'up':
        return '↑';
      case 'down':
        return '↓';
      case 'stable':
        return '→';
    }
  };

  return (
    <Card className="p-6 bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600 mb-2">Gas Price</p>
          <p className="text-3xl font-bold text-gray-900">{gasPrice} Gwei</p>
        </div>
        <div className="text-right">
          <Zap className="w-8 h-8 text-amber-600 mb-2" />
          <p className={`text-2xl font-bold ${getTrendColor()}`}>
            {getTrendIcon()}
          </p>
        </div>
      </div>
    </Card>
  );
};

// ============================================================================
// Main Dashboard Blockchain Section
// ============================================================================

export const DashboardBlockchainSection: React.FC<{
  totalTrusts: number;
  verifiedTrusts: number;
  pendingTrusts: number;
  failedTrusts: number;
  recentActivities?: RecentActivity[];
  metrics?: BlockchainMetric[];
}> = ({
  totalTrusts,
  verifiedTrusts,
  pendingTrusts,
  failedTrusts,
  recentActivities = [],
  metrics = [],
}) => {
  const { networkStatus } = useBlockchainTrust();

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Blockchain Status</h2>
        <p className="text-gray-600 mt-1">
          Real-time monitoring of trust records on Hyperledger Besu
        </p>
      </div>

      {/* Network Status and Gas Price */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <BlockchainStatusCard />
        </div>
        <GasPriceIndicator
          gasPrice={networkStatus?.gasPrice || '0'}
          trend="stable"
        />
      </div>

      {/* Trust Metrics */}
      <TrustMetricsCard
        totalTrusts={totalTrusts}
        verifiedTrusts={verifiedTrusts}
        pendingTrusts={pendingTrusts}
        failedTrusts={failedTrusts}
      />

      {/* Charts and Activities */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TransactionActivityChart data={metrics} />
        <RecentActivitiesCard activities={recentActivities} />
      </div>

      {/* Quick Actions */}
      <Card className="p-6 bg-gradient-to-r from-blue-50 to-cyan-50 border-cyan-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Manage Trust Records
            </h3>
            <p className="text-gray-600">
              View, verify, and export blockchain-verified trust records
            </p>
          </div>
          <Button className="gap-2">
            Go to Trust Records
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default DashboardBlockchainSection;
