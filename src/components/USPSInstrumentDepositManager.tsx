import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  FileText, 
  CreditCard, 
  Landmark, 
  Package, 
  Ship, 
  TrendingUp, 
  Shield, 
  Clock, 
  MapPin, 
  CheckCircle, 
  AlertTriangle, 
  Info,
  Upload,
  Download,
  Eye,
  Edit3,
  Trash2,
  Plus
} from 'lucide-react';

interface InstrumentDeposit {
  id: string;
  type: 'pmo' | 'check' | 'draft' | 'note' | 'cd' | 'warehouse_receipt' | 'bill_of_lading' | 'chattel' | 'stock' | 'bond';
  description: string;
  amount: number;
  issuer: string;
  dateIssued: string;
  maturityDate?: string;
  endorsement: string;
  processingCenter: 'philadelphia' | 'carol_stream' | 'los_angeles' | 'newark';
  status: 'pending' | 'processing' | 'cleared' | 'rejected';
  estimatedClearingDays: number;
  specialHandling: boolean;
  documents: string[];
  created: string;
  updated: string;
}

interface ProcessingCenter {
  id: string;
  name: string;
  address: string;
  processingTime: string;
  specialties: string[];
  phone?: string;
}

const USPSInstrumentDepositManager: React.FC = () => {
  const [deposits, setDeposits] = useState<InstrumentDeposit[]>([]);
  const [selectedDeposit, setSelectedDeposit] = useState<InstrumentDeposit | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'deposits' | 'processing' | 'compliance'>('overview');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');

  const processingCenters: ProcessingCenter[] = [
    {
      id: 'philadelphia',
      name: 'CMRS-PB Philadelphia',
      address: 'PO Box 7247-0166, Philadelphia, PA 19170-0166',
      processingTime: '10 business days',
      specialties: ['Standard Processing', 'Checks', 'Money Orders', 'Certificates']
    },
    {
      id: 'carol_stream',
      name: 'CMRS-PB Carol Stream',
      address: 'PO Box 0566, Carol Stream, IL 60132-0566',
      processingTime: '10 business days',
      specialties: ['All Negotiable Instruments', 'Central Processing']
    },
    {
      id: 'los_angeles',
      name: 'CMRS-PB Los Angeles',
      address: 'PO Box 894766, Los Angeles, CA 90189-4766',
      processingTime: '10 business days',
      specialties: ['International Instruments', 'Foreign Drafts', 'Pacific Rim']
    },
    {
      id: 'newark',
      name: 'Deluxe Newark (Overnight)',
      address: '400 White Clay Center Drive, Newark, DE 19711',
      processingTime: '3 business days',
      specialties: ['High-Value Instruments', 'Time-Sensitive', 'Special Handling'],
      phone: '(302) 781-1700'
    }
  ];

  const instrumentTypes = [
    { id: 'pmo', name: 'Postal Money Order', icon: <Building2 className="w-4 h-4" />, maxAmount: 1000, clearing: '1 day' },
    { id: 'check', name: 'Personal/Business Check', icon: <FileText className="w-4 h-4" />, maxAmount: null, clearing: '3-5 days' },
    { id: 'draft', name: 'Bank Draft/Cashier\'s Check', icon: <CreditCard className="w-4 h-4" />, maxAmount: null, clearing: '1 day' },
    { id: 'note', name: 'Promissory Note', icon: <Landmark className="w-4 h-4" />, maxAmount: null, clearing: '5-7 days' },
    { id: 'cd', name: 'Certificate of Deposit', icon: <Shield className="w-4 h-4" />, maxAmount: null, clearing: '3-7 days' },
    { id: 'warehouse_receipt', name: 'Warehouse Receipt', icon: <Package className="w-4 h-4" />, maxAmount: null, clearing: '5-10 days' },
    { id: 'bill_of_lading', name: 'Bill of Lading', icon: <Ship className="w-4 h-4" />, maxAmount: null, clearing: '7-10 days' },
    { id: 'chattel', name: 'Chattel Paper', icon: <FileText className="w-4 h-4" />, maxAmount: null, clearing: '7-14 days' },
    { id: 'stock', name: 'Stock Certificate', icon: <TrendingUp className="w-4 h-4" />, maxAmount: null, clearing: '3-7 days' },
    { id: 'bond', name: 'Bond Certificate', icon: <Shield className="w-4 h-4" />, maxAmount: null, clearing: '3-7 days' }
  ];

  // Sample data
  useEffect(() => {
    const sampleDeposits: InstrumentDeposit[] = [
      {
        id: '1',
        type: 'pmo',
        description: 'Postal Money Order - Trust Funding',
        amount: 1000,
        issuer: 'USPS Philadelphia',
        dateIssued: '2024-11-15',
        endorsement: 'Pay to the order of USPS Trust Account',
        processingCenter: 'philadelphia',
        status: 'cleared',
        estimatedClearingDays: 1,
        specialHandling: false,
        documents: ['pmo_001.pdf'],
        created: '2024-11-15T10:00:00Z',
        updated: '2024-11-16T09:00:00Z'
      },
      {
        id: '2',
        type: 'draft',
        description: 'Bank Draft - Corporate Trust Deposit',
        amount: 50000,
        issuer: 'Wells Fargo Bank',
        dateIssued: '2024-11-14',
        endorsement: 'Pay to CHARLES ANTHONY DOMINICK, LLC Trust',
        processingCenter: 'newark',
        status: 'processing',
        estimatedClearingDays: 3,
        specialHandling: true,
        documents: ['draft_002.pdf', 'authorization_002.pdf'],
        created: '2024-11-14T14:30:00Z',
        updated: '2024-11-15T11:00:00Z'
      },
      {
        id: '3',
        type: 'warehouse_receipt',
        description: 'Warehouse Receipt - Gold Bullion Storage',
        amount: 125000,
        issuer: 'Delaware Depository Service Company',
        dateIssued: '2024-11-10',
        endorsement: 'Negotiable - Deliver to Bearer',
        processingCenter: 'newark',
        status: 'pending',
        estimatedClearingDays: 10,
        specialHandling: true,
        documents: ['warehouse_003.pdf', 'appraisal_003.pdf', 'insurance_003.pdf'],
        created: '2024-11-10T16:00:00Z',
        updated: '2024-11-10T16:00:00Z'
      }
    ];
    setDeposits(sampleDeposits);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'cleared': return 'text-green-600 bg-green-50';
      case 'processing': return 'text-blue-600 bg-blue-50';
      case 'pending': return 'text-yellow-600 bg-yellow-50';
      case 'rejected': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getInstrumentIcon = (type: string) => {
    const instrument = instrumentTypes.find(i => i.id === type);
    return instrument?.icon || <FileText className="w-4 h-4" />;
  };

  const getInstrumentName = (type: string) => {
    const instrument = instrumentTypes.find(i => i.id === type);
    return instrument?.name || 'Unknown Instrument';
  };

  const filteredDeposits = deposits.filter(deposit => {
    const statusMatch = filterStatus === 'all' || deposit.status === filterStatus;
    const typeMatch = filterType === 'all' || deposit.type === filterType;
    return statusMatch && typeMatch;
  });

  const totalValue = deposits.reduce((sum, deposit) => sum + deposit.amount, 0);
  const clearedValue = deposits.filter(d => d.status === 'cleared').reduce((sum, deposit) => sum + deposit.amount, 0);
  const pendingValue = deposits.filter(d => d.status === 'pending' || d.status === 'processing').reduce((sum, deposit) => sum + deposit.amount, 0);

  const OverviewTab = () => (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Deposits</p>
              <p className="text-2xl font-bold text-gray-900">{deposits.length}</p>
            </div>
            <FileText className="w-8 h-8 text-blue-600" />
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Value</p>
              <p className="text-2xl font-bold text-gray-900">${totalValue.toLocaleString()}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-green-600" />
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Cleared Value</p>
              <p className="text-2xl font-bold text-green-600">${clearedValue.toLocaleString()}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Pending Value</p>
              <p className="text-2xl font-bold text-yellow-600">${pendingValue.toLocaleString()}</p>
            </div>
            <Clock className="w-8 h-8 text-yellow-600" />
          </div>
        </div>
      </div>

      {/* Instrument Types */}
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Accepted Instrument Types</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {instrumentTypes.map(instrument => (
            <div key={instrument.id} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
              {instrument.icon}
              <div>
                <p className="font-medium text-gray-900">{instrument.name}</p>
                <p className="text-sm text-gray-600">Clearing: {instrument.clearing}</p>
                {instrument.maxAmount && (
                  <p className="text-xs text-gray-500">Max: ${instrument.maxAmount.toLocaleString()}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Processing Centers */}
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Processing Centers</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {processingCenters.map(center => (
            <div key={center.id} className="p-4 border border-gray-200 rounded-lg">
              <div className="flex items-start space-x-3">
                <MapPin className="w-5 h-5 text-blue-600 mt-1" />
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900">{center.name}</h4>
                  <p className="text-sm text-gray-600 mt-1">{center.address}</p>
                  <p className="text-sm text-blue-600 mt-1">Processing: {center.processingTime}</p>
                  {center.phone && (
                    <p className="text-sm text-gray-600 mt-1">Phone: {center.phone}</p>
                  )}
                  <div className="mt-2">
                    <p className="text-xs text-gray-500 mb-1">Specialties:</p>
                    <div className="flex flex-wrap gap-1">
                      {center.specialties.map((specialty, idx) => (
                        <span key={idx} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                          {specialty}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const DepositsTab = () => (
    <div className="space-y-6">
      {/* Filters and Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
        <div className="flex space-x-4">
          <select 
            value={filterStatus} 
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="cleared">Cleared</option>
            <option value="rejected">Rejected</option>
          </select>
          
          <select 
            value={filterType} 
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Types</option>
            {instrumentTypes.map(type => (
              <option key={type.id} value={type.id}>{type.name}</option>
            ))}
          </select>
        </div>
        
        <button
          onClick={() => setShowAddForm(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
        >
          <Plus className="w-4 h-4" />
          <span>Add Deposit</span>
        </button>
      </div>

      {/* Deposits List */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Instrument
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Issuer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Processing Center
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredDeposits.map((deposit) => (
                <tr key={deposit.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-3">
                      {getInstrumentIcon(deposit.type)}
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {getInstrumentName(deposit.type)}
                        </p>
                        <p className="text-sm text-gray-500">{deposit.description}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <p className="text-sm font-medium text-gray-900">
                      ${deposit.amount.toLocaleString()}
                    </p>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <p className="text-sm text-gray-900">{deposit.issuer}</p>
                    <p className="text-sm text-gray-500">{deposit.dateIssued}</p>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(deposit.status)}`}>
                      {deposit.status.charAt(0).toUpperCase() + deposit.status.slice(1)}
                    </span>
                    {deposit.specialHandling && (
                      <div className="mt-1">
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">
                          Special Handling
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <p className="text-sm text-gray-900">
                      {processingCenters.find(c => c.id === deposit.processingCenter)?.name}
                    </p>
                    <p className="text-sm text-gray-500">
                      Est. {deposit.estimatedClearingDays} days
                    </p>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => setSelectedDeposit(deposit)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button className="text-gray-600 hover:text-gray-900">
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button className="text-red-600 hover:text-red-900">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const ProcessingTab = () => (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Processing Guidelines</h3>
        
        <div className="space-y-4">
          <div className="p-4 bg-blue-50 rounded-lg">
            <div className="flex items-start space-x-3">
              <Info className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-blue-900">1872 Post Office Department Authority</h4>
                <p className="text-sm text-blue-800 mt-1">
                  Under 17 Stat. 335, Section 13, the USPS has broad authority to accept "all bonds taken and contracts entered into" 
                  with the United States of America, providing legal foundation for comprehensive instrument acceptance.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 border border-gray-200 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2">Required Documentation</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Proper endorsement to USPS Trust Account</li>
                <li>• Date verification (within 180 days)</li>
                <li>• Authorized signatory confirmation</li>
                <li>• Amount verification (written/numerical match)</li>
                <li>• Supporting documentation as required</li>
              </ul>
            </div>

            <div className="p-4 border border-gray-200 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2">Special Handling Criteria</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Instruments over $50,000</li>
                <li>• Documents of title requiring appraisal</li>
                <li>• International instruments</li>
                <li>• Time-sensitive deposits</li>
                <li>• Securities requiring transfer verification</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Wire Transfer Information</h3>
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-gray-700">Bank Name:</p>
              <p className="text-sm text-gray-900">Citibank</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">Account Name:</p>
              <p className="text-sm text-gray-900">CMRS/Pitney Bowes Postage by Phone Bank</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">Account Number:</p>
              <p className="text-sm text-gray-900">4067-8633</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">Routing Number:</p>
              <p className="text-sm text-gray-900">021000089</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">Company ID:</p>
              <p className="text-sm text-gray-900">9601631001</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">Processing:</p>
              <p className="text-sm text-gray-900">Same day if received before 3:00 PM ET</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const ComplianceTab = () => (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Regulatory Compliance Framework</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium text-gray-900 mb-3">UCC Compliance</h4>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span className="text-sm text-gray-700">Article 3: Negotiable Instruments</span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span className="text-sm text-gray-700">Article 4: Bank Deposits and Collections</span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span className="text-sm text-gray-700">Article 7: Documents of Title</span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span className="text-sm text-gray-700">Article 8: Investment Securities</span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span className="text-sm text-gray-700">Article 9: Secured Transactions</span>
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-medium text-gray-900 mb-3">Federal Regulations</h4>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span className="text-sm text-gray-700">31 CFR 1010: FinCEN BSA/AML</span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span className="text-sm text-gray-700">12 CFR 229: Expedited Funds Availability</span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span className="text-sm text-gray-700">15 USC 78: Securities Exchange Act</span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span className="text-sm text-gray-700">39 USC 101: Postal Service Authority</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">International Standards</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-3 bg-blue-50 rounded-lg text-center">
            <Shield className="w-6 h-6 text-blue-600 mx-auto mb-2" />
            <p className="text-sm font-medium text-blue-900">ISO 20022</p>
            <p className="text-xs text-blue-700">Payment Messaging</p>
          </div>
          <div className="p-3 bg-green-50 rounded-lg text-center">
            <Landmark className="w-6 h-6 text-green-600 mx-auto mb-2" />
            <p className="text-sm font-medium text-green-900">SWIFT</p>
            <p className="text-xs text-green-700">Wire Transfers</p>
          </div>
          <div className="p-3 bg-purple-50 rounded-lg text-center">
            <FileText className="w-6 h-6 text-purple-600 mx-auto mb-2" />
            <p className="text-sm font-medium text-purple-900">UCP 600</p>
            <p className="text-xs text-purple-700">Documentary Credits</p>
          </div>
          <div className="p-3 bg-orange-50 rounded-lg text-center">
            <Ship className="w-6 h-6 text-orange-600 mx-auto mb-2" />
            <p className="text-sm font-medium text-orange-900">INCOTERMS</p>
            <p className="text-xs text-orange-700">Commercial Terms</p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">USPS Trust Account - Instrument Deposit Manager</h1>
          <p className="text-gray-600 mt-2">
            Comprehensive management of negotiable instruments, documents of title, and securities deposits
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="mb-6">
          <nav className="flex space-x-8">
            {[
              { id: 'overview', name: 'Overview', icon: <Building2 className="w-4 h-4" /> },
              { id: 'deposits', name: 'Deposits', icon: <FileText className="w-4 h-4" /> },
              { id: 'processing', name: 'Processing', icon: <Clock className="w-4 h-4" /> },
              { id: 'compliance', name: 'Compliance', icon: <Shield className="w-4 h-4" /> }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-2 px-3 py-2 font-medium text-sm rounded-md transition-colors ${
                  activeTab === tab.id
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.icon}
                <span>{tab.name}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && <OverviewTab />}
        {activeTab === 'deposits' && <DepositsTab />}
        {activeTab === 'processing' && <ProcessingTab />}
        {activeTab === 'compliance' && <ComplianceTab />}

        {/* Deposit Detail Modal */}
        {selectedDeposit && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Deposit Details</h3>
                  <button
                    onClick={() => setSelectedDeposit(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    ×
                  </button>
                </div>
                
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-gray-700">Instrument Type</p>
                      <p className="text-sm text-gray-900">{getInstrumentName(selectedDeposit.type)}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-700">Amount</p>
                      <p className="text-sm text-gray-900">${selectedDeposit.amount.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-700">Issuer</p>
                      <p className="text-sm text-gray-900">{selectedDeposit.issuer}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-700">Date Issued</p>
                      <p className="text-sm text-gray-900">{selectedDeposit.dateIssued}</p>
                    </div>
                  </div>
                  
                  <div>
                    <p className="text-sm font-medium text-gray-700">Endorsement</p>
                    <p className="text-sm text-gray-900">{selectedDeposit.endorsement}</p>
                  </div>
                  
                  <div>
                    <p className="text-sm font-medium text-gray-700">Processing Center</p>
                    <p className="text-sm text-gray-900">
                      {processingCenters.find(c => c.id === selectedDeposit.processingCenter)?.name}
                    </p>
                  </div>
                  
                  <div>
                    <p className="text-sm font-medium text-gray-700">Documents</p>
                    <div className="mt-1 space-y-1">
                      {selectedDeposit.documents.map((doc, idx) => (
                        <div key={idx} className="flex items-center space-x-2">
                          <FileText className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-900">{doc}</span>
                          <button className="text-blue-600 hover:text-blue-800">
                            <Download className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default USPSInstrumentDepositManager;
