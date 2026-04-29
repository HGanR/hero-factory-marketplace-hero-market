import React, { useState, useEffect } from 'react';

import { 

  Building2, 

  Shield, 

  TrendingUp, 

  DollarSign, 

  FileText, 

  Send,

  Download,

  AlertCircle,

  CheckCircle,

  Banknote,

  Landmark,

  ArrowUpRight,

  ArrowDownRight,

  Calendar,

  Users,

  Globe,

  Database,

  Network,

  Lock,

  Eye,

  Settings,

  BarChart,

  PieChart,

  Activity,

  CreditCard,

  Zap,

  Server

} from 'lucide-react';

// Type definitions for PostalOne! Business Master Trust Account

interface BusinessMasterTrustAccount {

  accountId: string;

  accountName: string;

  accountType: 'Advance Deposit Trust';

  currentBalance: number;

  availableBalance: number;

  pendingTransactions: number;

  lastUpdated: string;

  status: 'active' | 'pending' | 'suspended';

  inspectorGeneralStatus: 'compliant' | 'under_review' | 'approved';

}

interface PostalOneTransaction {

  id: string;

  type: 'Deposit' | 'Transfer' | 'Withdrawal' | 'Business Mail Payment';

  amount: number;

  date: string;

  status: 'completed' | 'pending' | 'processing';

  reference: string;

  processingCenter: string;

  formNumber?: string;

}

interface InspectorGeneralReport {

  reportNumber: string;

  reportDate: string;

  accountsReviewed: number;

  totalValue: number;

  complianceStatus: 'satisfactory' | 'needs_improvement' | 'excellent';

  recommendations: string[];

  nextReview: string;

}

interface POSIntegration {

  systemStatus: 'online' | 'offline' | 'maintenance';

  lastSync: string;

  transactionsProcessed: number;

  integrationVersion: string;

  trainingCompleted: boolean;

}

const PostalOneTrustAccountDashboard: React.FC = () => {

  // State management

  const [trustAccount, setTrustAccount] = useState<BusinessMasterTrustAccount>({

    accountId: 'BMTA-12345678',

    accountName: 'CHARLES ANTHONY DOMINICK, LLC - Business Master Trust',

    accountType: 'Advance Deposit Trust',

    currentBalance: 485750.00,

    availableBalance: 465250.00,

    pendingTransactions: 20500.00,

    lastUpdated: new Date().toISOString(),

    status: 'active',

    inspectorGeneralStatus: 'compliant'

  });

  const [recentTransactions, setRecentTransactions] = useState<PostalOneTransaction[]>([

    {

      id: 'PO001',

      type: 'Deposit',

      amount: 75000.00,

      date: '2025-11-18',

      status: 'completed',

      reference: 'Trust Account Funding - Corporate Operations',

      processingCenter: 'PostalOne! System',

      formNumber: 'PS-3533'

    },

    {

      id: 'PO002',

      type: 'Transfer',

      amount: 15000.00,

      date: '2025-11-17',

      status: 'processing',

      reference: 'Inter-Account Transfer - San Mateo ASC',

      processingCenter: 'San Mateo Accounting Service Center',

      formNumber: 'PS-25'

    },

    {

      id: 'PO003',

      type: 'Business Mail Payment',

      amount: 8500.00,

      date: '2025-11-16',

      status: 'completed',

      reference: 'Business Mail Revenue - Trust Communications',

      processingCenter: 'POS Interface System'

    },

    {

      id: 'PO004',

      type: 'Withdrawal',

      amount: 5000.00,

      date: '2025-11-15',

      status: 'pending',

      reference: 'Trust Distribution - Beneficiary Payment',

      processingCenter: 'San Mateo ASC',

      formNumber: 'PS-3533'

    }

  ]);

  const [inspectorGeneralReport, setInspectorGeneralReport] = useState<InspectorGeneralReport>({

    reportNumber: 'FF-MA-12-010',

    reportDate: '2012-09-05',

    accountsReviewed: 389142,

    totalValue: 496000000,

    complianceStatus: 'excellent',

    recommendations: [

      'Continue effective management of advance deposit trust accounts',

      'Maintain customer account reconciliation procedures',

      'Monitor high-value account balances for compliance'

    ],

    nextReview: '2025-12-15'

  });

  const [posIntegration, setPosIntegration] = useState<POSIntegration>({

    systemStatus: 'online',

    lastSync: new Date().toISOString(),

    transactionsProcessed: 1247,

    integrationVersion: 'POS-PostalOne! v3.2',

    trainingCompleted: true

  });

  const [selectedTab, setSelectedTab] = useState<'overview' | 'transactions' | 'compliance' | 'integration'>('overview');

  // Utility functions

  const formatCurrency = (amount: number): string => {

    return new Intl.NumberFormat('en-US', {

      style: 'currency',

      currency: 'USD',

      minimumFractionDigits: 2

    }).format(amount);

  };

  const formatDate = (dateString: string): string => {

    return new Date(dateString).toLocaleDateString('en-US', {

      year: 'numeric',

      month: 'short',

      day: 'numeric'

    });

  };

  const formatLargeNumber = (num: number): string => {

    if (num >= 1000000) {

      return (num / 1000000).toFixed(1) + 'M';

    } else if (num >= 1000) {

      return (num / 1000).toFixed(1) + 'K';

    }

    return num.toString();

  };

  const getStatusColor = (status: string): string => {

    switch (status) {

      case 'completed':

      case 'active':

      case 'compliant':

      case 'online':

      case 'excellent':

        return 'text-green-600 bg-green-100';

      case 'pending':

      case 'processing':

      case 'under_review':

      case 'maintenance':

        return 'text-yellow-600 bg-yellow-100';

      case 'suspended':

      case 'offline':

      case 'needs_improvement':

        return 'text-red-600 bg-red-100';

      default:

        return 'text-gray-600 bg-gray-100';

    }

  };

  // Component render

  return (

    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-6">

      <div className="max-w-7xl mx-auto space-y-6">

        

        {/* Header Section */}

        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">

          <div className="flex items-center justify-between">

            <div className="flex items-center space-x-4">

              <div className="p-3 bg-blue-600 rounded-lg">

                <Database className="w-8 h-8 text-white" />

              </div>

              <div>

                <h1 className="text-2xl font-bold text-gray-900">PostalOne! Business Master Trust Account</h1>

                <p className="text-gray-600">Advanced Deposit Trust Account Management System</p>

              </div>

            </div>

            <div className="flex items-center space-x-4">

              <div className="text-right">

                <p className="text-sm text-gray-600">Account ID: {trustAccount.accountId}</p>

                <p className="text-xs text-gray-500">Inspector General Validated</p>

              </div>

              <div className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(trustAccount.inspectorGeneralStatus)}`}>

                {trustAccount.inspectorGeneralStatus.replace('_', ' ').toUpperCase()}

              </div>

            </div>

          </div>

        </div>

        {/* Key Metrics Cards */}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">

          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">

            <div className="flex items-center justify-between">

              <div>

                <p className="text-sm font-medium text-gray-600">Account Balance</p>

                <p className="text-2xl font-bold text-gray-900">{formatCurrency(trustAccount.currentBalance)}</p>

              </div>

              <div className="p-3 bg-green-100 rounded-lg">

                <DollarSign className="w-6 h-6 text-green-600" />

              </div>

            </div>

            <div className="mt-4 flex items-center text-sm">

              <ArrowUpRight className="w-4 h-4 text-green-500 mr-1" />

              <span className="text-green-600">High-value account status</span>

            </div>

          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">

            <div className="flex items-center justify-between">

              <div>

                <p className="text-sm font-medium text-gray-600">System Network</p>

                <p className="text-2xl font-bold text-gray-900">{formatLargeNumber(inspectorGeneralReport.accountsReviewed)}</p>

              </div>

              <div className="p-3 bg-blue-100 rounded-lg">

                <Network className="w-6 h-6 text-blue-600" />

              </div>

            </div>

            <div className="mt-4 flex items-center text-sm">

              <Database className="w-4 h-4 text-blue-500 mr-1" />

              <span className="text-blue-600">Total accounts in network</span>

            </div>

          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">

            <div className="flex items-center justify-between">

              <div>

                <p className="text-sm font-medium text-gray-600">System Value</p>

                <p className="text-2xl font-bold text-gray-900">{formatCurrency(inspectorGeneralReport.totalValue)}</p>

              </div>

              <div className="p-3 bg-purple-100 rounded-lg">

                <TrendingUp className="w-6 h-6 text-purple-600" />

              </div>

            </div>

            <div className="mt-4 flex items-center text-sm">

              <Shield className="w-4 h-4 text-purple-500 mr-1" />

              <span className="text-purple-600">Inspector General validated</span>

            </div>

          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">

            <div className="flex items-center justify-between">

              <div>

                <p className="text-sm font-medium text-gray-600">POS Integration</p>

                <p className="text-2xl font-bold text-gray-900">{posIntegration.transactionsProcessed}</p>

              </div>

              <div className="p-3 bg-orange-100 rounded-lg">

                <Zap className="w-6 h-6 text-orange-600" />

              </div>

            </div>

            <div className="mt-4 flex items-center text-sm">

              <CheckCircle className="w-4 h-4 text-orange-500 mr-1" />

              <span className="text-orange-600">Transactions processed</span>

            </div>

          </div>

        </div>

        {/* Navigation Tabs */}

        <div className="bg-white rounded-xl shadow-lg border border-gray-200">

          <div className="border-b border-gray-200">

            <nav className="flex space-x-8 px-6">

              {[

                { key: 'overview', label: 'System Overview', icon: Building2 },

                { key: 'transactions', label: 'Transactions', icon: Activity },

                { key: 'compliance', label: 'Inspector General', icon: Shield },

                { key: 'integration', label: 'POS Integration', icon: Server }

              ].map(tab => (

                <button

                  key={tab.key}

                  onClick={() => setSelectedTab(tab.key as any)}

                  className={`flex items-center space-x-2 py-4 px-2 border-b-2 font-medium text-sm ${

                    selectedTab === tab.key

                      ? 'border-blue-500 text-blue-600'

                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'

                  }`}

                >

                  <tab.icon className="w-4 h-4" />

                  <span>{tab.label}</span>

                </button>

              ))}

            </nav>

          </div>

          <div className="p-6">

            {/* Overview Tab */}

            {selectedTab === 'overview' && (

              <div className="space-y-6">

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                  {/* PostalOne! System Information */}

                  <div className="bg-blue-50 rounded-lg p-6 border border-blue-200">

                    <h3 className="text-lg font-semibold text-blue-900 mb-4 flex items-center">

                      <Database className="w-5 h-5 mr-2" />

                      PostalOne! System Details

                    </h3>

                    <div className="space-y-3 text-sm">

                      <div className="flex justify-between">

                        <span className="text-blue-700">Account Type:</span>

                        <span className="font-medium text-blue-900">{trustAccount.accountType}</span>

                      </div>

                      <div className="flex justify-between">

                        <span className="text-blue-700">System Integration:</span>

                        <span className="font-medium text-blue-900">POS-PostalOne! Interface</span>

                      </div>

                      <div className="flex justify-between">

                        <span className="text-blue-700">Processing Centers:</span>

                        <span className="font-medium text-blue-900">San Mateo ASC</span>

                      </div>

                      <div className="flex justify-between">

                        <span className="text-blue-700">Account Network:</span>

                        <span className="font-medium text-blue-900">{formatLargeNumber(inspectorGeneralReport.accountsReviewed)} accounts</span>

                      </div>

                      <div className="flex justify-between">

                        <span className="text-blue-700">System Capacity:</span>

                        <span className="font-medium text-blue-900">{formatCurrency(inspectorGeneralReport.totalValue)}</span>

                      </div>

                    </div>

                  </div>

                  {/* Account Management Features */}

                  <div className="bg-green-50 rounded-lg p-6 border border-green-200">

                    <h3 className="text-lg font-semibold text-green-900 mb-4 flex items-center">

                      <Settings className="w-5 h-5 mr-2" />

                      Account Management Features

                    </h3>

                    <div className="space-y-3">

                      <div className="flex items-center space-x-3">

                        <CheckCircle className="w-5 h-5 text-green-600" />

                        <span className="text-green-800">Real-time POS integration</span>

                      </div>

                      <div className="flex items-center space-x-3">

                        <CheckCircle className="w-5 h-5 text-green-600" />

                        <span className="text-green-800">Centralized transfer processing</span>

                      </div>

                      <div className="flex items-center space-x-3">

                        <CheckCircle className="w-5 h-5 text-green-600" />

                        <span className="text-green-800">San Mateo ASC withdrawal management</span>

                      </div>

                      <div className="flex items-center space-x-3">

                        <CheckCircle className="w-5 h-5 text-green-600" />

                        <span className="text-green-800">Inspector General oversight</span>

                      </div>

                      <div className="flex items-center space-x-3">

                        <CheckCircle className="w-5 h-5 text-green-600" />

                        <span className="text-green-800">Professional audit trail</span>

                      </div>

                      <div className="flex items-center space-x-3">

                        <CheckCircle className="w-5 h-5 text-green-600" />

                        <span className="text-green-800">High-value account support</span>

                      </div>

                    </div>

                  </div>

                </div>

                {/* System Statistics */}

                <div className="bg-gray-50 rounded-lg p-6">

                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">

                    <BarChart className="w-5 h-5 mr-2 text-indigo-600" />

                    System Performance Metrics

                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">

                    <div className="bg-white p-4 rounded-lg border border-gray-200">

                      <div className="text-center">

                        <p className="text-2xl font-bold text-indigo-600">{formatLargeNumber(inspectorGeneralReport.accountsReviewed)}</p>

                        <p className="text-sm text-gray-600">Total Accounts</p>

                      </div>

                    </div>

                    <div className="bg-white p-4 rounded-lg border border-gray-200">

                      <div className="text-center">

                        <p className="text-2xl font-bold text-green-600">{formatCurrency(inspectorGeneralReport.totalValue)}</p>

                        <p className="text-sm text-gray-600">System Value</p>

                      </div>

                    </div>

                    <div className="bg-white p-4 rounded-lg border border-gray-200">

                      <div className="text-center">

                        <p className="text-2xl font-bold text-blue-600">87%</p>

                        <p className="text-sm text-gray-600">Customer Satisfaction</p>

                      </div>

                    </div>

                    <div className="bg-white p-4 rounded-lg border border-gray-200">

                      <div className="text-center">

                        <p className="text-2xl font-bold text-purple-600">538</p>

                        <p className="text-sm text-gray-600">High-Value Accounts</p>

                      </div>

                    </div>

                  </div>

                </div>

              </div>

            )}

            {/* Transactions Tab */}

            {selectedTab === 'transactions' && (

              <div className="space-y-6">

                <div className="flex justify-between items-center">

                  <h3 className="text-lg font-semibold text-gray-900">PostalOne! Transaction Management</h3>

                  <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2">

                    <Send className="w-4 h-4" />

                    <span>New Transaction</span>

                  </button>

                </div>

                {/* Transaction Types */}

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">

                  <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">

                    <div className="flex items-center space-x-3 mb-2">

                      <ArrowUpRight className="w-5 h-5 text-blue-600" />

                      <h4 className="font-semibold text-blue-900">Deposits</h4>

                    </div>

                    <p className="text-sm text-blue-700">Direct PostalOne! system deposits</p>

                  </div>

                  <div className="bg-green-50 rounded-lg p-4 border border-green-200">

                    <div className="flex items-center space-x-3 mb-2">

                      <ArrowDownRight className="w-5 h-5 text-green-600" />

                      <h4 className="font-semibold text-green-900">Transfers</h4>

                    </div>

                    <p className="text-sm text-green-700">San Mateo ASC processing</p>

                  </div>

                  <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">

                    <div className="flex items-center space-x-3 mb-2">

                      <Banknote className="w-5 h-5 text-yellow-600" />

                      <h4 className="font-semibold text-yellow-900">Withdrawals</h4>

                    </div>

                    <p className="text-sm text-yellow-700">Centralized withdrawal processing</p>

                  </div>

                  <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">

                    <div className="flex items-center space-x-3 mb-2">

                      <Send className="w-5 h-5 text-purple-600" />

                      <h4 className="font-semibold text-purple-900">Business Mail</h4>

                    </div>

                    <p className="text-sm text-purple-700">Mail revenue processing</p>

                  </div>

                </div>

                {/* Transaction History */}

                <div className="bg-white rounded-lg border border-gray-200">

                  <div className="px-6 py-4 border-b border-gray-200">

                    <h4 className="font-semibold text-gray-900">Recent Transactions</h4>

                  </div>

                  <div className="overflow-x-auto">

                    <table className="w-full">

                      <thead className="bg-gray-50">

                        <tr>

                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>

                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>

                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reference</th>

                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Processing Center</th>

                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>

                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>

                        </tr>

                      </thead>

                      <tbody className="bg-white divide-y divide-gray-200">

                        {recentTransactions.map(transaction => (

                          <tr key={transaction.id} className="hover:bg-gray-50">

                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">

                              {formatDate(transaction.date)}

                            </td>

                            <td className="px-6 py-4 whitespace-nowrap">

                              <div className="flex items-center space-x-2">

                                {transaction.type === 'Deposit' ? <ArrowUpRight className="w-4 h-4 text-blue-600" /> :

                                 transaction.type === 'Transfer' ? <ArrowDownRight className="w-4 h-4 text-green-600" /> :

                                 transaction.type === 'Withdrawal' ? <Banknote className="w-4 h-4 text-yellow-600" /> :

                                 <Send className="w-4 h-4 text-purple-600" />}

                                <span className="text-sm font-medium text-gray-900">{transaction.type}</span>

                              </div>

                            </td>

                            <td className="px-6 py-4 text-sm text-gray-900">

                              <div>

                                <p>{transaction.reference}</p>

                                {transaction.formNumber && (

                                  <p className="text-xs text-gray-500">Form: {transaction.formNumber}</p>

                                )}

                              </div>

                            </td>

                            <td className="px-6 py-4 text-sm text-gray-600">{transaction.processingCenter}</td>

                            <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">

                              {formatCurrency(transaction.amount)}

                            </td>

                            <td className="px-6 py-4 whitespace-nowrap">

                              <div className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(transaction.status)}`}>

                                {transaction.status}

                              </div>

                            </td>

                          </tr>

                        ))}

                      </tbody>

                    </table>

                  </div>

                </div>

              </div>

            )}

            {/* Inspector General Compliance Tab */}

            {selectedTab === 'compliance' && (

              <div className="space-y-6">

                <div className="flex justify-between items-center">

                  <h3 className="text-lg font-semibold text-gray-900">Inspector General Oversight</h3>

                  <button className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors flex items-center space-x-2">

                    <FileText className="w-4 h-4" />

                    <span>View Full Report</span>

                  </button>

                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                  {/* Inspector General Report Summary */}

                  <div className="bg-white rounded-lg border border-gray-200 p-6">

                    <h4 className="font-semibold text-gray-900 mb-4 flex items-center">

                      <Shield className="w-5 h-5 mr-2 text-red-600" />

                      Official Report Summary

                    </h4>

                    <div className="space-y-3 text-sm">

                      <div className="flex justify-between">

                        <span className="text-gray-600">Report Number:</span>

                        <span className="font-medium text-gray-900">{inspectorGeneralReport.reportNumber}</span>

                      </div>

                      <div className="flex justify-between">

                        <span className="text-gray-600">Report Date:</span>

                        <span className="font-medium text-gray-900">{formatDate(inspectorGeneralReport.reportDate)}</span>

                      </div>

                      <div className="flex justify-between">

                        <span className="text-gray-600">Accounts Reviewed:</span>

                        <span className="font-medium text-gray-900">{formatLargeNumber(inspectorGeneralReport.accountsReviewed)}</span>

                      </div>

                      <div className="flex justify-between">

                        <span className="text-gray-600">Total System Value:</span>

                        <span className="font-medium text-gray-900">{formatCurrency(inspectorGeneralReport.totalValue)}</span>

                      </div>

                      <div className="flex justify-between">

                        <span className="text-gray-600">Compliance Status:</span>

                        <div className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(inspectorGeneralReport.complianceStatus)}`}>

                          {inspectorGeneralReport.complianceStatus.toUpperCase()}

                        </div>

                      </div>

                      <div className="flex justify-between">

                        <span className="text-gray-600">Next Review:</span>

                        <span className="font-medium text-gray-900">{formatDate(inspectorGeneralReport.nextReview)}</span>

                      </div>

                    </div>

                  </div>

                  {/* Compliance Status */}

                  <div className="bg-green-50 rounded-lg border border-green-200 p-6">

                    <h4 className="font-semibold text-green-900 mb-4 flex items-center">

                      <CheckCircle className="w-5 h-5 mr-2" />

                      Compliance Status

                    </h4>

                    <div className="space-y-3">

                      <div className="flex items-center space-x-3">

                        <CheckCircle className="w-5 h-5 text-green-600" />

                        <span className="text-green-800">Account management effective</span>

                      </div>

                      <div className="flex items-center space-x-3">

                        <CheckCircle className="w-5 h-5 text-green-600" />

                        <span className="text-green-800">Revenue collection compliant</span>

                      </div>

                      <div className="flex items-center space-x-3">

                        <CheckCircle className="w-5 h-5 text-green-600" />

                        <span className="text-green-800">Customer records reconciled</span>

                      </div>

                      <div className="flex items-center space-x-3">

                        <CheckCircle className="w-5 h-5 text-green-600" />

                        <span className="text-green-800">High-value accounts monitored</span>

                      </div>

                      <div className="flex items-center space-x-3">

                        <CheckCircle className="w-5 h-5 text-green-600" />

                        <span className="text-green-800">Audit trail maintained</span>

                      </div>

                    </div>

                  </div>

                </div>

                {/* Inspector General Recommendations */}

                <div className="bg-blue-50 rounded-lg border border-blue-200 p-6">

                  <h4 className="font-semibold text-blue-900 mb-4 flex items-center">

                    <FileText className="w-5 h-5 mr-2" />

                    Official Recommendations

                  </h4>

                  <div className="space-y-3">

                    {inspectorGeneralReport.recommendations.map((recommendation, index) => (

                      <div key={index} className="flex items-start space-x-3">

                        <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold mt-0.5">

                          {index + 1}

                        </div>

                        <p className="text-blue-800">{recommendation}</p>

                      </div>

                    ))}

                  </div>

                </div>

              </div>

            )}

            {/* POS Integration Tab */}

            {selectedTab === 'integration' && (

              <div className="space-y-6">

                <div className="flex justify-between items-center">

                  <h3 className="text-lg font-semibold text-gray-900">POS-PostalOne! System Integration</h3>

                  <div className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(posIntegration.systemStatus)}`}>

                    System {posIntegration.systemStatus.toUpperCase()}

                  </div>

                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                  {/* Integration Status */}

                  <div className="bg-white rounded-lg border border-gray-200 p-6">

                    <h4 className="font-semibold text-gray-900 mb-4 flex items-center">

                      <Server className="w-5 h-5 mr-2 text-blue-600" />

                      Integration Status

                    </h4>

                    <div className="space-y-3 text-sm">

                      <div className="flex justify-between">

                        <span className="text-gray-600">System Status:</span>

                        <div className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(posIntegration.systemStatus)}`}>

                          {posIntegration.systemStatus.toUpperCase()}

                        </div>

                      </div>

                      <div className="flex justify-between">

                        <span className="text-gray-600">Last Sync:</span>

                        <span className="font-medium text-gray-900">{formatDate(posIntegration.lastSync)}</span>

                      </div>

                      <div className="flex justify-between">

                        <span className="text-gray-600">Transactions Processed:</span>

                        <span className="font-medium text-gray-900">{posIntegration.transactionsProcessed.toLocaleString()}</span>

                      </div>

                      <div className="flex justify-between">

                        <span className="text-gray-600">Integration Version:</span>

                        <span className="font-medium text-gray-900">{posIntegration.integrationVersion}</span>

                      </div>

                      <div className="flex justify-between">

                        <span className="text-gray-600">Training Status:</span>

                        <div className={`px-2 py-1 rounded-full text-xs font-medium ${posIntegration.trainingCompleted ? 'text-green-600 bg-green-100' : 'text-red-600 bg-red-100'}`}>

                          {posIntegration.trainingCompleted ? 'COMPLETED' : 'REQUIRED'}

                        </div>

                      </div>

                    </div>

                  </div>

                  {/* Integration Features */}

                  <div className="bg-gray-50 rounded-lg p-6">

                    <h4 className="font-semibold text-gray-900 mb-4 flex items-center">

                      <Zap className="w-5 h-5 mr-2 text-orange-600" />

                      Integration Features

                    </h4>

                    <div className="space-y-3">

                      <div className="flex items-center space-x-3">

                        <CheckCircle className="w-5 h-5 text-green-600" />

                        <span className="text-gray-800">Real-time transaction posting</span>

                      </div>

                      <div className="flex items-center space-x-3">

                        <CheckCircle className="w-5 h-5 text-green-600" />

                        <span className="text-gray-800">Unified deposit management</span>

                      </div>

                      <div className="flex items-center space-x-3">

                        <CheckCircle className="w-5 h-5 text-green-600" />

                        <span className="text-gray-800">Multi-location support</span>

                      </div>

                      <div className="flex items-center space-x-3">

                        <CheckCircle className="w-5 h-5 text-green-600" />

                        <span className="text-gray-800">Professional training completed</span>

                      </div>

                      <div className="flex items-center space-x-3">

                        <CheckCircle className="w-5 h-5 text-green-600" />

                        <span className="text-gray-800">San Mateo ASC processing</span>

                      </div>

                      <div className="flex items-center space-x-3">

                        <CheckCircle className="w-5 h-5 text-green-600" />

                        <span className="text-gray-800">Form PS-3533 integration</span>

                      </div>

                    </div>

                  </div>

                </div>

                {/* System Architecture */}

                <div className="bg-indigo-50 rounded-lg border border-indigo-200 p-6">

                  <h4 className="font-semibold text-indigo-900 mb-4 flex items-center">

                    <Network className="w-5 h-5 mr-2" />

                    System Architecture

                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">

                    <div className="bg-white p-4 rounded-lg border border-indigo-200">

                      <h5 className="font-medium text-indigo-900 mb-2">PostalOne! System</h5>

                      <ul className="space-y-1 text-indigo-700">

                        <li>• Web-based platform</li>

                        <li>• Business mail management</li>

                        <li>• Account balance tracking</li>

                        <li>• Revenue collection</li>

                      </ul>

                    </div>

                    <div className="bg-white p-4 rounded-lg border border-indigo-200">

                      <h5 className="font-medium text-indigo-900 mb-2">POS Interface</h5>

                      <ul className="space-y-1 text-indigo-700">

                        <li>• Point-of-service integration</li>

                        <li>• Real-time transaction posting</li>

                        <li>• Multi-location support</li>

                        <li>• Professional training</li>

                      </ul>

                    </div>

                    <div className="bg-white p-4 rounded-lg border border-indigo-200">

                      <h5 className="font-medium text-indigo-900 mb-2">San Mateo ASC</h5>

                      <ul className="space-y-1 text-indigo-700">

                        <li>• Centralized processing</li>

                        <li>• Transfer management</li>

                        <li>• Withdrawal processing</li>

                        <li>• Form PS-3533 handling</li>

                      </ul>

                    </div>

                  </div>

                </div>

              </div>

            )}

          </div>

        </div>

      </div>

    </div>

  );

};

export default PostalOneTrustAccountDashboard;