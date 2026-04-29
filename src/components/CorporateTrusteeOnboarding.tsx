import React, { useState, useCallback, useEffect } from 'react';
import { Building2, Shield, FileText, DollarSign, CheckCircle, AlertCircle, Clock, Users, Briefcase, Globe, Mail, Phone, MapPin, Upload, Download, Eye, Settings } from 'lucide-react';

// Corporate Trustee Onboarding and Account Management System
// Enables other Corporate Trustees to onboard and manage their trust services

interface CorporateTrustee {
  id: string;
  companyName: string;
  entityType: 'LLC' | 'Corporation' | 'Statutory Trust' | 'Partnership' | 'Other';
  jurisdiction: string;
  taxId: string;
  registrationNumber: string;
  contactInfo: {
    primaryContact: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  serviceTier: 'basic' | 'premium' | 'institutional';
  onboardingStatus: 'application' | 'documentation' | 'verification' | 'approved' | 'active' | 'suspended';
  trustAccounts: TrustAccount[];
  monthlyFee: number;
  setupFee: number;
  documentsUploaded: Document[];
  complianceScore: number;
  lastActivity: string;
  totalAssetsUnderManagement: number;
}

interface TrustAccount {
  id: string;
  trustName: string;
  trustType: 'Revocable' | 'Irrevocable' | 'Charitable' | 'Special Needs' | 'Asset Protection' | 'Other';
  establishedDate: string;
  totalAssets: number;
  beneficiaryCount: number;
  uspsAccountNumber?: string;
  xrplWalletAddress?: string;
  complianceStatus: 'compliant' | 'review_required' | 'non_compliant';
  lastAuditDate: string;
}

interface Document {
  id: string;
  name: string;
  type: 'Articles of Incorporation' | 'Operating Agreement' | 'Trust Agreement' | 'Tax ID Letter' | 'Certificate of Good Standing' | 'Other';
  uploadDate: string;
  status: 'pending' | 'approved' | 'rejected';
  size: number;
}

const CorporateTrusteeOnboarding: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [trustees, setTrustees] = useState<CorporateTrustee[]>([]);
  const [selectedTrustee, setSelectedTrustee] = useState<CorporateTrustee | null>(null);
  const [formData, setFormData] = useState<Partial<CorporateTrustee>>({
    entityType: 'LLC',
    jurisdiction: 'Delaware',
    serviceTier: 'basic',
    contactInfo: {
      primaryContact: '',
      email: '',
      phone: '',
      address: '',
      city: '',
      state: '',
      zipCode: '',
      country: 'United States'
    }
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);

  // Mock data for existing trustees
  useEffect(() => {
    const mockTrustees: CorporateTrustee[] = [
      {
        id: 'trustee-001',
        companyName: 'Apex Trust Solutions LLC',
        entityType: 'LLC',
        jurisdiction: 'Delaware',
        taxId: '12-3456789',
        registrationNumber: 'DE-LLC-2024-001',
        contactInfo: {
          primaryContact: 'Sarah Johnson',
          email: 'sarah@apextrust.com',
          phone: '(555) 123-4567',
          address: '123 Corporate Blvd',
          city: 'Wilmington',
          state: 'DE',
          zipCode: '19801',
          country: 'United States'
        },
        serviceTier: 'premium',
        onboardingStatus: 'active',
        trustAccounts: [
          {
            id: 'trust-001',
            trustName: 'Johnson Family Trust',
            trustType: 'Revocable',
            establishedDate: '2024-01-15',
            totalAssets: 2500000,
            beneficiaryCount: 4,
            uspsAccountNumber: '12345678',
            xrplWalletAddress: 'rApexTrustSolutions123456789',
            complianceStatus: 'compliant',
            lastAuditDate: '2024-10-01'
          }
        ],
        monthlyFee: 8500,
        setupFee: 15000,
        documentsUploaded: [
          { id: 'doc-001', name: 'Operating Agreement.pdf', type: 'Operating Agreement', uploadDate: '2024-01-10', status: 'approved', size: 245760 },
          { id: 'doc-002', name: 'Certificate of Good Standing.pdf', type: 'Certificate of Good Standing', uploadDate: '2024-01-10', status: 'approved', size: 156432 }
        ],
        complianceScore: 98,
        lastActivity: '2024-11-18',
        totalAssetsUnderManagement: 2500000
      },
      {
        id: 'trustee-002',
        companyName: 'Heritage Fiduciary Corporation',
        entityType: 'Corporation',
        jurisdiction: 'Nevada',
        taxId: '98-7654321',
        registrationNumber: 'NV-CORP-2024-002',
        contactInfo: {
          primaryContact: 'Michael Chen',
          email: 'mchen@heritagefiduciary.com',
          phone: '(555) 987-6543',
          address: '456 Trust Avenue',
          city: 'Las Vegas',
          state: 'NV',
          zipCode: '89101',
          country: 'United States'
        },
        serviceTier: 'institutional',
        onboardingStatus: 'active',
        trustAccounts: [
          {
            id: 'trust-002',
            trustName: 'Chen Dynasty Trust',
            trustType: 'Asset Protection',
            establishedDate: '2024-02-20',
            totalAssets: 8750000,
            beneficiaryCount: 8,
            uspsAccountNumber: '87654321',
            xrplWalletAddress: 'rHeritageFiduciary987654321',
            complianceStatus: 'compliant',
            lastAuditDate: '2024-09-15'
          }
        ],
        monthlyFee: 35000,
        setupFee: 75000,
        documentsUploaded: [
          { id: 'doc-003', name: 'Articles of Incorporation.pdf', type: 'Articles of Incorporation', uploadDate: '2024-02-15', status: 'approved', size: 198432 },
          { id: 'doc-004', name: 'Trust Agreement.pdf', type: 'Trust Agreement', uploadDate: '2024-02-15', status: 'approved', size: 567890 }
        ],
        complianceScore: 95,
        lastActivity: '2024-11-17',
        totalAssetsUnderManagement: 8750000
      }
    ];
    setTrustees(mockTrustees);
  }, []);

  // Handle form input changes
  const handleInputChange = useCallback((field: string, value: any) => {
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      const parentKey = parent as keyof CorporateTrustee;
      setFormData((prev) => {
        const parentValue = prev[parentKey];
        const parentObj =
          parentValue && typeof parentValue === "object" && !Array.isArray(parentValue)
            ? (parentValue as Record<string, unknown>)
            : {};

        return {
          ...prev,
          [parentKey]: {
            ...parentObj,
            [child]: value,
          },
        } as Partial<CorporateTrustee>;
      });
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
  }, []);

  // Submit onboarding application
  const submitApplication = useCallback(async () => {
    setIsSubmitting(true);
    
    // Simulate API submission
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const newTrustee: CorporateTrustee = {
      id: `trustee-${Date.now()}`,
      companyName: formData.companyName || '',
      entityType: formData.entityType || 'LLC',
      jurisdiction: formData.jurisdiction || 'Delaware',
      taxId: formData.taxId || '',
      registrationNumber: `${formData.jurisdiction?.toUpperCase()}-${formData.entityType}-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
      contactInfo: formData.contactInfo || {
        primaryContact: '',
        email: '',
        phone: '',
        address: '',
        city: '',
        state: '',
        zipCode: '',
        country: 'United States'
      },
      serviceTier: formData.serviceTier || 'basic',
      onboardingStatus: 'documentation',
      trustAccounts: [],
      monthlyFee: getMonthlyFee(formData.serviceTier || 'basic'),
      setupFee: getSetupFee(formData.serviceTier || 'basic'),
      documentsUploaded: [],
      complianceScore: 0,
      lastActivity: new Date().toISOString().split('T')[0],
      totalAssetsUnderManagement: 0
    };

    setTrustees(prev => [...prev, newTrustee]);
    setSelectedTrustee(newTrustee);
    setIsSubmitting(false);
    setCurrentStep(4);
  }, [formData]);

  // Helper functions
  const getMonthlyFee = (tier: string): number => {
    const fees = { basic: 3500, premium: 8500, institutional: 35000 };
    return fees[tier as keyof typeof fees] || 3500;
  };

  const getSetupFee = (tier: string): number => {
    const fees = { basic: 7500, premium: 15000, institutional: 75000 };
    return fees[tier as keyof typeof fees] || 7500;
  };

  const getStatusColor = (status: string): string => {
    const colors = {
      application: 'text-blue-400',
      documentation: 'text-yellow-400',
      verification: 'text-orange-400',
      approved: 'text-green-400',
      active: 'text-green-500',
      suspended: 'text-red-400'
    };
    return colors[status as keyof typeof colors] || 'text-gray-400';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'application': return <FileText className="w-4 h-4" />;
      case 'documentation': return <Upload className="w-4 h-4" />;
      case 'verification': return <Eye className="w-4 h-4" />;
      case 'approved': return <CheckCircle className="w-4 h-4" />;
      case 'active': return <CheckCircle className="w-4 h-4" />;
      case 'suspended': return <AlertCircle className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  // Render onboarding steps
  const renderOnboardingStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-white mb-2">Corporate Trustee Application</h2>
              <p className="text-gray-300">Join the TroothHurtz Corporate Trustee Network</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">Company Name *</label>
                <input
                  type="text"
                  value={formData.companyName || ''}
                  onChange={(e) => handleInputChange('companyName', e.target.value)}
                  className="w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-400"
                  placeholder="Enter company name"
                />
              </div>

              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">Entity Type *</label>
                <select
                  value={formData.entityType}
                  onChange={(e) => handleInputChange('entityType', e.target.value)}
                  className="w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-400"
                >
                  <option value="LLC">Limited Liability Company</option>
                  <option value="Corporation">Corporation</option>
                  <option value="Statutory Trust">Statutory Trust</option>
                  <option value="Partnership">Partnership</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">Jurisdiction *</label>
                <select
                  value={formData.jurisdiction}
                  onChange={(e) => handleInputChange('jurisdiction', e.target.value)}
                  className="w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-400"
                >
                  <option value="Delaware">Delaware</option>
                  <option value="Nevada">Nevada</option>
                  <option value="Wyoming">Wyoming</option>
                  <option value="Washington DC">Washington DC</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">Tax ID (EIN/SSN) *</label>
                <input
                  type="text"
                  value={formData.taxId || ''}
                  onChange={(e) => handleInputChange('taxId', e.target.value)}
                  className="w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-400"
                  placeholder="XX-XXXXXXX"
                />
              </div>
            </div>

            <button
              onClick={() => setCurrentStep(2)}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 px-4 rounded-lg font-medium hover:from-blue-700 hover:to-purple-700 transition-all duration-200"
            >
              Continue to Contact Information
            </button>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-white mb-2">Contact Information</h2>
              <p className="text-gray-300">Provide your primary contact details</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">Primary Contact *</label>
                <input
                  type="text"
                  value={formData.contactInfo?.primaryContact || ''}
                  onChange={(e) => handleInputChange('contactInfo.primaryContact', e.target.value)}
                  className="w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-400"
                  placeholder="Full name"
                />
              </div>

              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">Email Address *</label>
                <input
                  type="email"
                  value={formData.contactInfo?.email || ''}
                  onChange={(e) => handleInputChange('contactInfo.email', e.target.value)}
                  className="w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-400"
                  placeholder="email@company.com"
                />
              </div>

              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">Phone Number *</label>
                <input
                  type="tel"
                  value={formData.contactInfo?.phone || ''}
                  onChange={(e) => handleInputChange('contactInfo.phone', e.target.value)}
                  className="w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-400"
                  placeholder="(555) 123-4567"
                />
              </div>

              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">Address *</label>
                <input
                  type="text"
                  value={formData.contactInfo?.address || ''}
                  onChange={(e) => handleInputChange('contactInfo.address', e.target.value)}
                  className="w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-400"
                  placeholder="Street address"
                />
              </div>

              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">City *</label>
                <input
                  type="text"
                  value={formData.contactInfo?.city || ''}
                  onChange={(e) => handleInputChange('contactInfo.city', e.target.value)}
                  className="w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-400"
                  placeholder="City"
                />
              </div>

              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">State/Province *</label>
                <input
                  type="text"
                  value={formData.contactInfo?.state || ''}
                  onChange={(e) => handleInputChange('contactInfo.state', e.target.value)}
                  className="w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-400"
                  placeholder="State"
                />
              </div>

              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">ZIP/Postal Code *</label>
                <input
                  type="text"
                  value={formData.contactInfo?.zipCode || ''}
                  onChange={(e) => handleInputChange('contactInfo.zipCode', e.target.value)}
                  className="w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-400"
                  placeholder="ZIP Code"
                />
              </div>

              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">Country *</label>
                <select
                  value={formData.contactInfo?.country || 'United States'}
                  onChange={(e) => handleInputChange('contactInfo.country', e.target.value)}
                  className="w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-400"
                >
                  <option value="United States">United States</option>
                  <option value="Canada">Canada</option>
                  <option value="United Kingdom">United Kingdom</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <div className="flex space-x-4">
              <button
                onClick={() => setCurrentStep(1)}
                className="flex-1 bg-gray-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-gray-700 transition-all duration-200"
              >
                Back
              </button>
              <button
                onClick={() => setCurrentStep(3)}
                className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 px-4 rounded-lg font-medium hover:from-blue-700 hover:to-purple-700 transition-all duration-200"
              >
                Continue to Service Selection
              </button>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-white mb-2">Service Tier Selection</h2>
              <p className="text-gray-300">Choose the service level that best fits your needs</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Basic Tier */}
              <div className={`bg-white/10 backdrop-blur-md rounded-xl p-6 border-2 cursor-pointer transition-all duration-200 ${
                formData.serviceTier === 'basic' ? 'border-blue-500 bg-blue-500/20' : 'border-white/20 hover:border-white/40'
              }`} onClick={() => handleInputChange('serviceTier', 'basic')}>
                <div className="text-center mb-4">
                  <Briefcase className="w-12 h-12 text-blue-400 mx-auto mb-2" />
                  <h3 className="text-xl font-bold text-white">Basic</h3>
                  <p className="text-gray-300 text-sm">Essential trustee services</p>
                </div>
                <div className="text-center mb-4">
                  <p className="text-3xl font-bold text-white">$3,500</p>
                  <p className="text-gray-400 text-sm">per month</p>
                  <p className="text-gray-400 text-xs">$7,500 setup fee</p>
                </div>
                <ul className="space-y-2 text-sm text-gray-300">
                  <li>✓ USPS Trust Account setup</li>
                  <li>✓ Basic compliance monitoring</li>
                  <li>✓ Quarterly reporting</li>
                  <li>✓ Standard document custody</li>
                </ul>
              </div>

              {/* Premium Tier */}
              <div className={`bg-white/10 backdrop-blur-md rounded-xl p-6 border-2 cursor-pointer transition-all duration-200 ${
                formData.serviceTier === 'premium' ? 'border-purple-500 bg-purple-500/20' : 'border-white/20 hover:border-white/40'
              }`} onClick={() => handleInputChange('serviceTier', 'premium')}>
                <div className="text-center mb-4">
                  <Shield className="w-12 h-12 text-purple-400 mx-auto mb-2" />
                  <h3 className="text-xl font-bold text-white">Premium</h3>
                  <p className="text-gray-300 text-sm">Advanced trust administration</p>
                </div>
                <div className="text-center mb-4">
                  <p className="text-3xl font-bold text-white">$8,500</p>
                  <p className="text-gray-400 text-sm">per month</p>
                  <p className="text-gray-400 text-xs">$15,000 setup fee</p>
                </div>
                <ul className="space-y-2 text-sm text-gray-300">
                  <li>✓ Full USPS Enterprise integration</li>
                  <li>✓ Advanced tax compliance</li>
                  <li>✓ XRPL IOU processing</li>
                  <li>✓ Monthly beneficiary communications</li>
                  <li>✓ Investment oversight</li>
                </ul>
              </div>

              {/* Institutional Tier */}
              <div className={`bg-white/10 backdrop-blur-md rounded-xl p-6 border-2 cursor-pointer transition-all duration-200 ${
                formData.serviceTier === 'institutional' ? 'border-gold-500 bg-gold-500/20' : 'border-white/20 hover:border-white/40'
              }`} onClick={() => handleInputChange('serviceTier', 'institutional')}>
                <div className="text-center mb-4">
                  <Building2 className="w-12 h-12 text-yellow-400 mx-auto mb-2" />
                  <h3 className="text-xl font-bold text-white">Institutional</h3>
                  <p className="text-gray-300 text-sm">Enterprise-grade services</p>
                </div>
                <div className="text-center mb-4">
                  <p className="text-3xl font-bold text-white">$35,000</p>
                  <p className="text-gray-400 text-sm">per month</p>
                  <p className="text-gray-400 text-xs">$75,000 setup fee</p>
                </div>
                <ul className="space-y-2 text-sm text-gray-300">
                  <li>✓ Complete white-label operations</li>
                  <li>✓ Custom XRPL integration</li>
                  <li>✓ IRS audit defense</li>
                  <li>✓ International compliance</li>
                  <li>✓ 24/7 beneficiary support</li>
                </ul>
              </div>
            </div>

            <div className="flex space-x-4">
              <button
                onClick={() => setCurrentStep(2)}
                className="flex-1 bg-gray-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-gray-700 transition-all duration-200"
              >
                Back
              </button>
              <button
                onClick={submitApplication}
                disabled={isSubmitting}
                className="flex-1 bg-gradient-to-r from-green-600 to-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:from-green-700 hover:to-blue-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {isSubmitting ? (
                  <>
                    <Clock className="w-4 h-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  'Submit Application'
                )}
              </button>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="text-center space-y-6">
            <CheckCircle className="w-24 h-24 text-green-400 mx-auto" />
            <h2 className="text-3xl font-bold text-white">Application Submitted!</h2>
            <p className="text-gray-300 max-w-2xl mx-auto">
              Your Corporate Trustee application has been successfully submitted. You will receive an email with next steps 
              for document upload and verification within 24 hours.
            </p>
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20 max-w-md mx-auto">
              <h3 className="text-lg font-semibold text-white mb-4">Application Summary</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Company:</span>
                  <span className="text-white">{formData.companyName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Service Tier:</span>
                  <span className="text-white capitalize">{formData.serviceTier}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Monthly Fee:</span>
                  <span className="text-white">${getMonthlyFee(formData.serviceTier || 'basic').toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Setup Fee:</span>
                  <span className="text-white">${getSetupFee(formData.serviceTier || 'basic').toLocaleString()}</span>
                </div>
              </div>
            </div>
            <button
              onClick={() => setShowDashboard(true)}
              className="bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 px-6 rounded-lg font-medium hover:from-blue-700 hover:to-purple-700 transition-all duration-200"
            >
              View Dashboard
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  // Render trustee dashboard
  const renderTrusteeDashboard = () => (
    <div className="space-y-8">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-white mb-4">Corporate Trustee Dashboard</h1>
        <p className="text-xl text-gray-300">Manage your trust services and client accounts</p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-300 text-sm">Active Trustees</p>
              <p className="text-2xl font-bold text-white">{trustees.filter(t => t.onboardingStatus === 'active').length}</p>
            </div>
            <Building2 className="w-8 h-8 text-blue-400" />
          </div>
        </div>

        <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-300 text-sm">Total Trust Accounts</p>
              <p className="text-2xl font-bold text-white">{trustees.reduce((sum, t) => sum + t.trustAccounts.length, 0)}</p>
            </div>
            <Shield className="w-8 h-8 text-green-400" />
          </div>
        </div>

        <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-300 text-sm">Assets Under Management</p>
              <p className="text-2xl font-bold text-white">${(trustees.reduce((sum, t) => sum + t.totalAssetsUnderManagement, 0) / 1000000).toFixed(1)}M</p>
            </div>
            <DollarSign className="w-8 h-8 text-yellow-400" />
          </div>
        </div>

        <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-300 text-sm">Monthly Revenue</p>
              <p className="text-2xl font-bold text-white">${(trustees.reduce((sum, t) => sum + t.monthlyFee, 0) / 1000).toFixed(0)}K</p>
            </div>
            <Globe className="w-8 h-8 text-purple-400" />
          </div>
        </div>
      </div>

      {/* Trustees List */}
      <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
        <h2 className="text-xl font-semibold text-white mb-6 flex items-center">
          <Users className="w-5 h-5 mr-2" />
          Corporate Trustees
        </h2>

        <div className="space-y-4">
          {trustees.map((trustee) => (
            <div key={trustee.id} className="bg-white/5 rounded-lg p-4 border border-white/10">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center mb-2">
                    <h3 className="text-white font-medium text-lg">{trustee.companyName}</h3>
                    <span className={`ml-3 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(trustee.onboardingStatus)} bg-white/10`}>
                      {trustee.onboardingStatus.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-gray-400">Entity Type</p>
                      <p className="text-white">{trustee.entityType}</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Jurisdiction</p>
                      <p className="text-white">{trustee.jurisdiction}</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Service Tier</p>
                      <p className="text-white capitalize">{trustee.serviceTier}</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Trust Accounts</p>
                      <p className="text-white">{trustee.trustAccounts.length}</p>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-white font-medium">${trustee.monthlyFee.toLocaleString()}/mo</p>
                  <p className="text-gray-400 text-sm">AUM: ${(trustee.totalAssetsUnderManagement / 1000000).toFixed(1)}M</p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-white/10">
                <div className="flex items-center space-x-4 text-sm text-gray-400">
                  <span className="flex items-center">
                    <Mail className="w-4 h-4 mr-1" />
                    {trustee.contactInfo.email}
                  </span>
                  <span className="flex items-center">
                    <Phone className="w-4 h-4 mr-1" />
                    {trustee.contactInfo.phone}
                  </span>
                  <span className="flex items-center">
                    <MapPin className="w-4 h-4 mr-1" />
                    {trustee.contactInfo.city}, {trustee.contactInfo.state}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-400">Compliance: {trustee.complianceScore}%</span>
                  <button className="text-blue-400 hover:text-blue-300 text-sm">
                    View Details
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6">
      <div className="max-w-6xl mx-auto">
        {showDashboard ? renderTrusteeDashboard() : (
          <div className="max-w-4xl mx-auto">
            {/* Progress Steps */}
            {currentStep <= 3 && (
              <div className="flex items-center justify-center mb-8">
                {[1, 2, 3].map((step) => (
                  <div key={step} className="flex items-center">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-medium ${
                      step <= currentStep ? 'bg-blue-600 text-white' : 'bg-white/10 text-gray-400'
                    }`}>
                      {step}
                    </div>
                    {step < 3 && (
                      <div className={`w-16 h-1 mx-2 ${
                        step < currentStep ? 'bg-blue-600' : 'bg-white/10'
                      }`} />
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Onboarding Form */}
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-8 border border-white/20">
              {renderOnboardingStep()}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-gray-400 text-sm">
            Corporate Trustee Services Platform | Powered by CHARLES ANTHONY DOMINICK LLC & TROOTHHURTZ STATUTORY TRUST
          </p>
        </div>
      </div>
    </div>
  );
};

export default CorporateTrusteeOnboarding;
