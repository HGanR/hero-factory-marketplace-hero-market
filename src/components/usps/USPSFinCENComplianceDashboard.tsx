// USPS-FinCEN Compliance Dashboard
// Financial Institution Operations & Regulatory Compliance

import React, { useState, useEffect } from 'react';
import { 
  Shield, FileText, DollarSign, Globe, Building, Users, 
  AlertCircle, CheckCircle, Clock, TrendingUp, BarChart3,
  Settings, Download, Eye, Search, Filter, Plus, Edit,
  Gavel, Landmark, CreditCard, Truck, Package, Mail,
  Target, Award, Lock, Unlock, Calendar, Bell
} from 'lucide-react';

// Core Interfaces
interface ComplianceStatus {
  bsaCompliant: boolean;
  amlCompliant: boolean;
  kycCompliant: boolean;
  msbRegistered: boolean;
  stateLicensed: boolean;
  fiduciaryBonded: boolean;
  lastAuditDate: string;
  nextAuditDue: string;
  riskRating: 'low' | 'medium' | 'high';
}

interface USPSAccount {
  epsAccountNumber: string;
  accountType: 'trust' | 'debit' | 'hybrid';
  status: 'active' | 'pending' | 'suspended' | 'closed';
  balance: number;
  monthlyVolume: number;
  lastActivity: string;
  linkedBoxes: number;
  complianceStatus: ComplianceStatus;
}

interface FinCENReport {
  id: string;
  type: 'SAR' | 'CTR' | 'FBAR' | 'Form8300' | 'MSB_Registration';
  status: 'draft' | 'submitted' | 'accepted' | 'rejected';
  dueDate: string;
  submissionDate?: string;
  amount?: number;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

interface TransactionMonitoring {
  id: string;
  date: string;
  type: 'ACH_Credit' | 'Wire_Transfer' | 'International_Wire' | 'Trust_Distribution';
  amount: number;
  fromAccount: string;
  toAccount: string;
  status: 'cleared' | 'pending' | 'flagged' | 'blocked';
  riskScore: number;
  complianceFlags: string[];
  uspsReference: string;
}

interface MSBLicense {
  state: string;
  licenseNumber: string;
  status: 'active' | 'pending' | 'expired' | 'suspended';
  issueDate: string;
  expirationDate: string;
  renewalRequired: boolean;
  fees: number;
}

const USPSFinCENComplianceDashboard: React.FC = () => {
  const [uspsAccounts, setUSPSAccounts] = useState<USPSAccount[]>([]);
  const [finCENReports, setFinCENReports] = useState<FinCENReport[]>([]);
  const [transactions, setTransactions] = useState<TransactionMonitoring[]>([]);
  const [msbLicenses, setMSBLicenses] = useState<MSBLicense[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'accounts' | 'compliance' | 'reporting' | 'monitoring' | 'licenses'>('overview');
  const [selectedAccount, setSelectedAccount] = useState<USPSAccount | null>(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = () => {
    // Mock data for demonstration
    const mockAccounts: USPSAccount[] = [
      {
        epsAccountNumber: 'EPS1000099998',
        accountType: 'trust',
        status: 'active',
        balance: 2500000,
        monthlyVolume: 15000000,
        lastActivity: '2024-11-18',
        linkedBoxes: 12,
        complianceStatus: {
          bsaCompliant: true,
          amlCompliant: true,
          kycCompliant: true,
          msbRegistered: true,
          stateLicensed: true,
          fiduciaryBonded: true,
          lastAuditDate: '2024-10-15',
          nextAuditDue: '2025-01-15',
          riskRating: 'low'
        }
      },
      {
        epsAccountNumber: 'EPS1000099999',
        accountType: 'debit',
        status: 'active',
        balance: 750000,
        monthlyVolume: 5000000,
        lastActivity: '2024-11-18',
        linkedBoxes: 8,
        complianceStatus: {
          bsaCompliant: true,
          amlCompliant: true,
          kycCompliant: true,
          msbRegistered: true,
          stateLicensed: true,
          fiduciaryBonded: true,
          lastAuditDate: '2024-10-15',
          nextAuditDue: '2025-01-15',
          riskRating: 'low'
        }
      }
    ];

    const mockReports: FinCENReport[] = [
      {
        id: 'SAR-2024-001',
        type: 'SAR',
        status: 'submitted',
        dueDate: '2024-11-30',
        submissionDate: '2024-11-15',
        amount: 25000,
        description: 'Suspicious wire transfer pattern detected',
        priority: 'high'
      },
      {
        id: 'CTR-2024-045',
        type: 'CTR',
        status: 'accepted',
        dueDate: '2024-11-20',
        submissionDate: '2024-11-18',
        amount: 12500,
        description: 'Currency transaction over $10,000',
        priority: 'medium'
      },
      {
        id: 'MSB-2025-REG',
        type: 'MSB_Registration',
        status: 'draft',
        dueDate: '2025-01-31',
        description: 'Annual MSB registration renewal',
        priority: 'critical'
      }
    ];

    const mockTransactions: TransactionMonitoring[] = [
      {
        id: 'TXN-001',
        date: '2024-11-18',
        type: 'Wire_Transfer',
        amount: 50000,
        fromAccount: 'Wells Fargo - 7038000EPS1000099998',
        toAccount: 'International Bank - SWIFT123',
        status: 'flagged',
        riskScore: 75,
        complianceFlags: ['High Amount', 'International', 'New Beneficiary'],
        uspsReference: 'USPS-WR-2024-001'
      },
      {
        id: 'TXN-002',
        date: '2024-11-18',
        type: 'ACH_Credit',
        amount: 15000,
        fromAccount: 'Client Bank Account',
        toAccount: 'Wells Fargo - 7038000EPS1000099999',
        status: 'cleared',
        riskScore: 25,
        complianceFlags: [],
        uspsReference: 'USPS-ACH-2024-045'
      }
    ];

    const mockLicenses: MSBLicense[] = [
      {
        state: 'California',
        licenseNumber: 'CA-MSB-2024-001',
        status: 'active',
        issueDate: '2024-01-15',
        expirationDate: '2025-01-15',
        renewalRequired: true,
        fees: 2500
      },
      {
        state: 'New York',
        licenseNumber: 'NY-MSB-2024-002',
        status: 'active',
        issueDate: '2024-02-01',
        expirationDate: '2025-02-01',
        renewalRequired: false,
        fees: 3500
      },
      {
        state: 'Texas',
        licenseNumber: 'TX-MSB-2024-003',
        status: 'pending',
        issueDate: '2024-11-01',
        expirationDate: '2025-11-01',
        renewalRequired: false,
        fees: 1500
      }
    ];

    setUSPSAccounts(mockAccounts);
    setFinCENReports(mockReports);
    setTransactions(mockTransactions);
    setMSBLicenses(mockLicenses);
    setSelectedAccount(mockAccounts[0]);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': case 'accepted': case 'cleared': return 'text-green-600 bg-green-50 border-green-200';
      case 'pending': case 'draft': case 'flagged': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'suspended': case 'rejected': case 'blocked': return 'text-red-600 bg-red-50 border-red-200';
      case 'expired': case 'closed': return 'text-gray-600 bg-gray-50 border-gray-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getRiskColor = (risk: string | number) => {
    if (typeof risk === 'number') {
      if (risk >= 70) return 'text-red-600 bg-red-50 border-red-200';
      if (risk >= 40) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      return 'text-green-600 bg-green-50 border-green-200';
    }
    switch (risk) {
      case 'high': return 'text-red-600 bg-red-50 border-red-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low': return 'text-green-600 bg-green-50 border-green-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const calculateComplianceScore = (status: ComplianceStatus): number => {
    const checks = [
      status.bsaCompliant,
      status.amlCompliant,
      status.kycCompliant,
      status.msbRegistered,
      status.stateLicensed,
      status.fiduciaryBonded
    ];
    return (checks.filter(Boolean).length / checks.length) * 100;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-900 to-green-700 text-white p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">USPS-FinCEN Compliance Dashboard</h1>
              <p className="text-blue-100">Financial Institution Operations & Regulatory Compliance</p>
            </div>
            <div className="flex items-center space-x-6">
              <div className="text-right">
                <div className="text-2xl font-bold">
                  {formatCurrency(uspsAccounts.reduce((sum, account) => sum + account.balance, 0))}
                </div>
                <div className="text-sm text-blue-100">Total USPS Balance</div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold">
                  {formatCurrency(uspsAccounts.reduce((sum, account) => sum + account.monthlyVolume, 0))}
                </div>
                <div className="text-sm text-blue-100">Monthly Volume</div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-green-300">
                  {uspsAccounts.length > 0 ? Math.round(calculateComplianceScore(uspsAccounts[0].complianceStatus)) : 0}%
                </div>
                <div className="text-sm text-blue-100">Compliance Score</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        {/* Navigation Tabs */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6">
              {[
                { id: 'overview', label: 'Overview', icon: BarChart3 },
                { id: 'accounts', label: 'USPS Accounts', icon: Landmark },
                { id: 'compliance', label: 'Compliance', icon: Shield },
                { id: 'reporting', label: 'FinCEN Reports', icon: FileText },
                { id: 'monitoring', label: 'Transaction Monitoring', icon: Target },
                { id: 'licenses', label: 'MSB Licenses', icon: Award }
              ].map((tab) => {
                const IconComponent = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm ${
                      activeTab === tab.id
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <IconComponent className="w-4 h-4" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="p-6">
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Key Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg p-4 text-white">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-2xl font-bold">{uspsAccounts.length}</div>
                        <div className="text-sm text-blue-100">Active USPS Accounts</div>
                      </div>
                      <Landmark className="w-8 h-8 text-blue-200" />
                    </div>
                  </div>
                  
                  <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-lg p-4 text-white">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-2xl font-bold">{finCENReports.filter(r => r.status === 'accepted').length}</div>
                        <div className="text-sm text-green-100">Submitted Reports</div>
                      </div>
                      <FileText className="w-8 h-8 text-green-200" />
                    </div>
                  </div>
                  
                  <div className="bg-gradient-to-r from-yellow-500 to-yellow-600 rounded-lg p-4 text-white">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-2xl font-bold">{transactions.filter(t => t.status === 'flagged').length}</div>
                        <div className="text-sm text-yellow-100">Flagged Transactions</div>
                      </div>
                      <AlertCircle className="w-8 h-8 text-yellow-200" />
                    </div>
                  </div>
                  
                  <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg p-4 text-white">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-2xl font-bold">{msbLicenses.filter(l => l.status === 'active').length}</div>
                        <div className="text-sm text-purple-100">Active Licenses</div>
                      </div>
                      <Award className="w-8 h-8 text-purple-200" />
                    </div>
                  </div>
                </div>

                {/* Compliance Status Overview */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white border rounded-lg p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Compliance Status</h3>
                    {selectedAccount && (
                      <div className="space-y-3">
                        {[
                          { key: 'bsaCompliant', label: 'BSA Compliant', icon: Shield },
                          { key: 'amlCompliant', label: 'AML Compliant', icon: Shield },
                          { key: 'kycCompliant', label: 'KYC Compliant', icon: Users },
                          { key: 'msbRegistered', label: 'MSB Registered', icon: Building },
                          { key: 'stateLicensed', label: 'State Licensed', icon: Gavel },
                          { key: 'fiduciaryBonded', label: 'Fiduciary Bonded', icon: Lock }
                        ].map((item) => {
                          const IconComponent = item.icon;
                          return (
                            <div key={item.key} className="flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                <IconComponent className="w-4 h-4" />
                                <span className="text-sm font-medium text-gray-700">{item.label}</span>
                              </div>
                              {selectedAccount.complianceStatus[item.key as keyof ComplianceStatus] ? (
                                <CheckCircle className="w-5 h-5 text-green-500" />
                              ) : (
                                <AlertCircle className="w-5 h-5 text-red-500" />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="bg-white border rounded-lg p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Activity</h3>
                    <div className="space-y-3">
                      {transactions.slice(0, 5).map((transaction) => (
                        <div key={transaction.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                          <div className="flex items-center space-x-3">
                            <CreditCard className="w-4 h-4 text-gray-500" />
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {transaction.type.replace('_', ' ')}
                              </div>
                              <div className="text-xs text-gray-500">{transaction.date}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-medium text-gray-900">
                              {formatCurrency(transaction.amount)}
                            </div>
                            <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getStatusColor(transaction.status)}`}>
                              {transaction.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* USPS Accounts Tab */}
            {activeTab === 'accounts' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-gray-900">USPS Enterprise Accounts</h3>
                  <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2">
                    <Plus className="w-4 h-4" />
                    <span>Add Account</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {uspsAccounts.map((account) => (
                    <div key={account.epsAccountNumber} className="bg-white border rounded-lg p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h4 className="text-lg font-medium text-gray-900">{account.epsAccountNumber}</h4>
                          <p className="text-sm text-gray-600 capitalize">{account.accountType} Account</p>
                        </div>
                        <span className={`px-3 py-1 text-sm font-medium rounded-full border ${getStatusColor(account.status)}`}>
                          {account.status}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                          <div className="text-2xl font-bold text-gray-900">
                            {formatCurrency(account.balance)}
                          </div>
                          <div className="text-sm text-gray-600">Current Balance</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-blue-600">
                            {formatCurrency(account.monthlyVolume)}
                          </div>
                          <div className="text-sm text-gray-600">Monthly Volume</div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-sm text-gray-600 mb-4">
                        <span>Linked Boxes: {account.linkedBoxes}</span>
                        <span>Last Activity: {new Date(account.lastActivity).toLocaleDateString()}</span>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getRiskColor(account.complianceStatus.riskRating)}`}>
                            {account.complianceStatus.riskRating} risk
                          </span>
                          <span className="text-xs text-gray-500">
                            Compliance: {Math.round(calculateComplianceScore(account.complianceStatus))}%
                          </span>
                        </div>
                        <button
                          onClick={() => setSelectedAccount(account)}
                          className="px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-sm"
                        >
                          View Details
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Compliance Tab */}
            {activeTab === 'compliance' && selectedAccount && (
              <div className="space-y-6">
                <h3 className="text-lg font-medium text-gray-900">Compliance Management</h3>
                
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2 space-y-6">
                    {/* BSA/AML Compliance */}
                    <div className="bg-white border rounded-lg p-6">
                      <h4 className="font-medium text-gray-900 mb-4">BSA/AML Compliance</h4>
                      <div className="space-y-4">
                        {[
                          { 
                            title: 'Customer Identification Program', 
                            status: selectedAccount.complianceStatus.kycCompliant,
                            description: 'KYC requirements and beneficial ownership rules'
                          },
                          { 
                            title: 'Transaction Monitoring', 
                            status: selectedAccount.complianceStatus.amlCompliant,
                            description: 'Automated suspicious activity detection'
                          },
                          { 
                            title: 'Record Keeping', 
                            status: selectedAccount.complianceStatus.bsaCompliant,
                            description: 'Transaction and customer record maintenance'
                          },
                          { 
                            title: 'Reporting Requirements', 
                            status: selectedAccount.complianceStatus.bsaCompliant,
                            description: 'SAR, CTR, and other regulatory reports'
                          }
                        ].map((item, index) => (
                          <div key={index} className="flex items-start space-x-3 p-3 bg-gray-50 rounded">
                            {item.status ? (
                              <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                            ) : (
                              <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
                            )}
                            <div>
                              <div className="font-medium text-gray-900">{item.title}</div>
                              <div className="text-sm text-gray-600">{item.description}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* USPS Integration Compliance */}
                    <div className="bg-white border rounded-lg p-6">
                      <h4 className="font-medium text-gray-900 mb-4">USPS Integration Compliance</h4>
                      <div className="space-y-4">
                        {[
                          { 
                            title: 'EPS Account Monitoring', 
                            status: true,
                            description: 'Real-time transaction tracking and reporting'
                          },
                          { 
                            title: 'Wells Fargo Integration', 
                            status: true,
                            description: 'ACH and wire transfer compliance monitoring'
                          },
                          { 
                            title: 'Third-Party Processing', 
                            status: true,
                            description: 'Compliant third-party mailer and billing services'
                          },
                          { 
                            title: 'International Wires', 
                            status: true,
                            description: 'Cross-border payment compliance and reporting'
                          }
                        ].map((item, index) => (
                          <div key={index} className="flex items-start space-x-3 p-3 bg-gray-50 rounded">
                            {item.status ? (
                              <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                            ) : (
                              <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
                            )}
                            <div>
                              <div className="font-medium text-gray-900">{item.title}</div>
                              <div className="text-sm text-gray-600">{item.description}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    {/* Compliance Score */}
                    <div className="bg-white border rounded-lg p-6">
                      <h4 className="font-medium text-gray-900 mb-4">Overall Compliance Score</h4>
                      <div className="text-center">
                        <div className="text-4xl font-bold text-green-600 mb-2">
                          {Math.round(calculateComplianceScore(selectedAccount.complianceStatus))}%
                        </div>
                        <div className="text-sm text-gray-600 mb-4">Excellent Compliance</div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-green-600 h-2 rounded-full" 
                            style={{ width: `${calculateComplianceScore(selectedAccount.complianceStatus)}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>

                    {/* Audit Information */}
                    <div className="bg-white border rounded-lg p-6">
                      <h4 className="font-medium text-gray-900 mb-4">Audit Information</h4>
                      <div className="space-y-3">
                        <div>
                          <div className="text-sm font-medium text-gray-700">Last Audit</div>
                          <div className="text-sm text-gray-600">
                            {new Date(selectedAccount.complianceStatus.lastAuditDate).toLocaleDateString()}
                          </div>
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-700">Next Audit Due</div>
                          <div className="text-sm text-gray-600">
                            {new Date(selectedAccount.complianceStatus.nextAuditDue).toLocaleDateString()}
                          </div>
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-700">Risk Rating</div>
                          <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getRiskColor(selectedAccount.complianceStatus.riskRating)}`}>
                            {selectedAccount.complianceStatus.riskRating} risk
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* FinCEN Reports Tab */}
            {activeTab === 'reporting' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-gray-900">FinCEN Reports</h3>
                  <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2">
                    <Plus className="w-4 h-4" />
                    <span>Create Report</span>
                  </button>
                </div>

                <div className="space-y-4">
                  {finCENReports.map((report) => (
                    <div key={report.id} className="bg-white border rounded-lg p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <h4 className="font-medium text-gray-900">{report.id}</h4>
                            <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                              {report.type}
                            </span>
                            <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getStatusColor(report.status)}`}>
                              {report.status}
                            </span>
                            <span className={`px-2 py-1 text-xs font-medium rounded-full border ${
                              report.priority === 'critical' ? 'text-red-600 bg-red-50 border-red-200' :
                              report.priority === 'high' ? 'text-orange-600 bg-orange-50 border-orange-200' :
                              report.priority === 'medium' ? 'text-yellow-600 bg-yellow-50 border-yellow-200' :
                              'text-green-600 bg-green-50 border-green-200'
                            }`}>
                              {report.priority}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mb-2">{report.description}</p>
                          <div className="flex items-center space-x-4 text-sm text-gray-500">
                            <span>Due: {new Date(report.dueDate).toLocaleDateString()}</span>
                            {report.submissionDate && (
                              <span>Submitted: {new Date(report.submissionDate).toLocaleDateString()}</span>
                            )}
                            {report.amount && (
                              <span>Amount: {formatCurrency(report.amount)}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2 ml-4">
                          <button className="p-2 text-gray-500 hover:text-gray-700">
                            <Eye className="w-4 h-4" />
                          </button>
                          <button className="p-2 text-gray-500 hover:text-gray-700">
                            <Edit className="w-4 h-4" />
                          </button>
                          <button className="p-2 text-gray-500 hover:text-gray-700">
                            <Download className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Transaction Monitoring Tab */}
            {activeTab === 'monitoring' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-gray-900">Transaction Monitoring</h3>
                  <div className="flex items-center space-x-2">
                    <button className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center space-x-2">
                      <Filter className="w-4 h-4" />
                      <span>Filter</span>
                    </button>
                    <button className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center space-x-2">
                      <Search className="w-4 h-4" />
                      <span>Search</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  {transactions.map((transaction) => (
                    <div key={transaction.id} className="bg-white border rounded-lg p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <h4 className="font-medium text-gray-900">{transaction.id}</h4>
                            <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                              {transaction.type.replace('_', ' ')}
                            </span>
                            <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getStatusColor(transaction.status)}`}>
                              {transaction.status}
                            </span>
                            <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getRiskColor(transaction.riskScore)}`}>
                              Risk: {transaction.riskScore}
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                            <div>
                              <div className="text-sm font-medium text-gray-700">From</div>
                              <div className="text-sm text-gray-600">{transaction.fromAccount}</div>
                            </div>
                            <div>
                              <div className="text-sm font-medium text-gray-700">To</div>
                              <div className="text-sm text-gray-600">{transaction.toAccount}</div>
                            </div>
                          </div>

                          <div className="flex items-center space-x-4 text-sm text-gray-500 mb-2">
                            <span>Date: {transaction.date}</span>
                            <span>Amount: {formatCurrency(transaction.amount)}</span>
                            <span>USPS Ref: {transaction.uspsReference}</span>
                          </div>

                          {transaction.complianceFlags.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {transaction.complianceFlags.map((flag, index) => (
                                <span key={index} className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded">
                                  {flag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        
                        <div className="flex items-center space-x-2 ml-4">
                          <button className="p-2 text-gray-500 hover:text-gray-700">
                            <Eye className="w-4 h-4" />
                          </button>
                          {transaction.status === 'flagged' && (
                            <button className="px-3 py-1 bg-red-100 text-red-700 rounded text-sm hover:bg-red-200">
                              Review
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* MSB Licenses Tab */}
            {activeTab === 'licenses' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-gray-900">MSB Licenses</h3>
                  <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2">
                    <Plus className="w-4 h-4" />
                    <span>Apply for License</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {msbLicenses.map((license) => (
                    <div key={license.licenseNumber} className="bg-white border rounded-lg p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h4 className="font-medium text-gray-900">{license.state}</h4>
                          <p className="text-sm text-gray-600">{license.licenseNumber}</p>
                        </div>
                        <span className={`px-3 py-1 text-sm font-medium rounded-full border ${getStatusColor(license.status)}`}>
                          {license.status}
                        </span>
                      </div>

                      <div className="space-y-2 mb-4">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Issue Date:</span>
                          <span className="text-gray-900">{new Date(license.issueDate).toLocaleDateString()}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Expiration:</span>
                          <span className="text-gray-900">{new Date(license.expirationDate).toLocaleDateString()}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Fees:</span>
                          <span className="text-gray-900">{formatCurrency(license.fees)}</span>
                        </div>
                      </div>

                      {license.renewalRequired && (
                        <div className="flex items-center space-x-2 p-2 bg-yellow-50 border border-yellow-200 rounded mb-4">
                          <Bell className="w-4 h-4 text-yellow-600" />
                          <span className="text-sm text-yellow-800">Renewal Required</span>
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <button className="px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-sm">
                          View Details
                        </button>
                        {license.renewalRequired && (
                          <button className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm">
                            Renew
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default USPSFinCENComplianceDashboard;
