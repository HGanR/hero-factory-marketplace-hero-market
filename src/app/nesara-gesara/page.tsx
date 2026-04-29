// pages/nesara-gesara.tsx
"use client";

import { useState } from "react";
import Head from "next/head";
import Link from "next/link";

interface DebtEntry {
  type: string;
  amount: number;
  creditor: string;
}

interface TDAAccount {
  accountNumber: string;
  cusipNumber: string;
  bondValue: number;
  availableBalance: number;
}

export default function NesaraGesara() {
  const [activeTab, setActiveTab] = useState<'debt' | 'currency' | 'tda' | 'qfs' | 'bond'>('debt');
  
  // Debt Forgiveness Calculator
  const [debts, setDebts] = useState<DebtEntry[]>([]);
  const [debtType, setDebtType] = useState('');
  const [debtAmount, setDebtAmount] = useState('');
  const [creditor, setCreditor] = useState('');
  
  // Currency Converter
  const [fiatAmount, setFiatAmount] = useState('');
  const [selectedMetal, setSelectedMetal] = useState('gold');
  
  // TDA Interface
  const [tdaAccount, setTdaAccount] = useState<TDAAccount | null>(null);
  const [birthCertNumber, setBirthCertNumber] = useState('');
  const [ssn, setSsn] = useState('');
  
  // QFS Account
  const [qfsBalance, setQfsBalance] = useState(0);
  const [qfsTransferAmount, setQfsTransferAmount] = useState('');
  
  // Bond Calculator
  const [birthYear, setBirthYear] = useState('');
  const [bondEstimate, setBondEstimate] = useState(0);

  const addDebt = () => {
    if (debtType && debtAmount && creditor) {
      setDebts([...debts, {
        type: debtType,
        amount: parseFloat(debtAmount),
        creditor
      }]);
      setDebtType('');
      setDebtAmount('');
      setCreditor('');
    }
  };

  const totalDebt = debts.reduce((sum, debt) => sum + debt.amount, 0);

  const convertToAssetBacked = () => {
    const amount = parseFloat(fiatAmount);
    if (isNaN(amount)) return 0;
    
    const rates = {
      gold: 2000, // $2000/oz
      silver: 25, // $25/oz
      platinum: 1000 // $1000/oz
    };
    
    return (amount / rates[selectedMetal as keyof typeof rates]).toFixed(4);
  };

  const generateTDA = () => {
    if (birthCertNumber && ssn) {
      // Simulated TDA generation
      const accountNum = `TDA-${birthCertNumber.slice(0, 4)}-${ssn.slice(-4)}`;
      const cusip = `${birthCertNumber}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      const bondVal = Math.floor(Math.random() * 10000000) + 1000000;
      
      setTdaAccount({
        accountNumber: accountNum,
        cusipNumber: cusip,
        bondValue: bondVal,
        availableBalance: bondVal * 0.7 // 70% available
      });
    }
  };

  const calculateBondValue = () => {
    const year = parseInt(birthYear);
    if (isNaN(year) || year < 1900 || year > 2024) return;
    
    const age = 2024 - year;
    const baseValue = 1000000;
    const yearlyAccrual = 50000;
    
    const estimated = baseValue + (age * yearlyAccrual);
    setBondEstimate(estimated);
  };

  const transferToQFS = () => {
    const amount = parseFloat(qfsTransferAmount);
    if (!isNaN(amount) && amount > 0) {
      setQfsBalance(qfsBalance + amount);
      setQfsTransferAmount('');
    }
  };

  return (
    <>
      <Head>
        <title>NESARA/GESARA Financial System | TroothHurtz</title>
        <meta name="description" content="Access NESARA/GESARA financial tools including debt forgiveness, asset-backed currency, TDA accounts, and QFS integration" />
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white">
        {/* Header */}
        <header className="border-b border-purple-500/30 bg-slate-900/50 backdrop-blur-sm">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                  NESARA/GESARA Financial System
                </h1>
                <p className="text-sm text-purple-300 mt-1">National Economic Security and Reformation Act</p>
              </div>
              <Link 
                href="/accounting"
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
              >
                ← Back to Accounting
              </Link>
            </div>
          </div>
        </header>

        {/* Tab Navigation */}
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-wrap gap-2 mb-6">
            {[
              { id: 'debt', label: 'Debt Forgiveness', icon: '💸' },
              { id: 'currency', label: 'Asset-Backed Currency', icon: '🪙' },
              { id: 'tda', label: 'Treasury Direct Account', icon: '🏦' },
              { id: 'qfs', label: 'Quantum Financial System', icon: '⚛️' },
              { id: 'bond', label: 'Birth Certificate Bond', icon: '📜' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                  activeTab === tab.id
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/50'
                    : 'bg-slate-800 text-purple-300 hover:bg-slate-700'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-8 border border-purple-500/30">
            
            {/* Debt Forgiveness Tab */}
            {activeTab === 'debt' && (
              <div>
                <h2 className="text-2xl font-bold mb-6 text-purple-300">Debt Forgiveness Calculator</h2>
                <p className="text-gray-300 mb-6">
                  Under NESARA/GESARA, all illegal debt (credit cards, mortgages, student loans) will be forgiven.
                  Calculate your total debt relief below.
                </p>

                <div className="grid md:grid-cols-3 gap-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium mb-2">Debt Type</label>
                    <select
                      value={debtType}
                      onChange={(e) => setDebtType(e.target.value)}
                      className="w-full px-4 py-2 bg-slate-700 border border-purple-500/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="">Select Type</option>
                      <option value="Credit Card">Credit Card</option>
                      <option value="Mortgage">Mortgage</option>
                      <option value="Student Loan">Student Loan</option>
                      <option value="Auto Loan">Auto Loan</option>
                      <option value="Personal Loan">Personal Loan</option>
                      <option value="Medical Debt">Medical Debt</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Amount ($)</label>
                    <input
                      type="number"
                      value={debtAmount}
                      onChange={(e) => setDebtAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full px-4 py-2 bg-slate-700 border border-purple-500/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Creditor</label>
                    <input
                      type="text"
                      value={creditor}
                      onChange={(e) => setCreditor(e.target.value)}
                      placeholder="Bank/Lender Name"
                      className="w-full px-4 py-2 bg-slate-700 border border-purple-500/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>

                <button
                  onClick={addDebt}
                  className="w-full md:w-auto px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-lg font-semibold transition-all shadow-lg shadow-purple-500/50"
                >
                  Add Debt
                </button>

                {debts.length > 0 && (
                  <div className="mt-8">
                    <h3 className="text-xl font-bold mb-4">Your Debts to be Forgiven:</h3>
                    <div className="space-y-3">
                      {debts.map((debt, index) => (
                        <div key={index} className="flex justify-between items-center bg-slate-700/50 p-4 rounded-lg">
                          <div>
                            <span className="font-semibold text-purple-300">{debt.type}</span>
                            <span className="text-gray-400 ml-2">- {debt.creditor}</span>
                          </div>
                          <span className="text-xl font-bold text-green-400">
                            ${debt.amount.toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="mt-6 p-6 bg-gradient-to-r from-green-600/20 to-emerald-600/20 border border-green-500/30 rounded-lg">
                      <div className="text-center">
                        <p className="text-lg text-gray-300 mb-2">Total Debt Forgiveness</p>
                        <p className="text-5xl font-bold text-green-400">
                          ${totalDebt.toLocaleString()}
                        </p>
                        <p className="text-sm text-gray-400 mt-2">
                          This debt will be eliminated under NESARA/GESARA
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Asset-Backed Currency Tab */}
            {activeTab === 'currency' && (
              <div>
                <h2 className="text-2xl font-bold mb-6 text-purple-300">Asset-Backed Currency Converter</h2>
                <p className="text-gray-300 mb-6">
                  Convert fiat currency to asset-backed precious metals under the new financial system.
                </p>

                <div className="max-w-2xl mx-auto">
                  <div className="grid md:grid-cols-2 gap-6 mb-6">
                    <div>
                      <label className="block text-sm font-medium mb-2">Fiat Amount (USD)</label>
                      <input
                        type="number"
                        value={fiatAmount}
                        onChange={(e) => setFiatAmount(e.target.value)}
                        placeholder="0.00"
                        className="w-full px-4 py-3 bg-slate-700 border border-purple-500/30 rounded-lg text-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Convert To</label>
                      <select
                        value={selectedMetal}
                        onChange={(e) => setSelectedMetal(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-700 border border-purple-500/30 rounded-lg text-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                      >
                        <option value="gold">Gold (oz)</option>
                        <option value="silver">Silver (oz)</option>
                        <option value="platinum">Platinum (oz)</option>
                      </select>
                    </div>
                  </div>

                  <div className="p-8 bg-gradient-to-r from-yellow-600/20 to-amber-600/20 border border-yellow-500/30 rounded-lg text-center">
                    <p className="text-lg text-gray-300 mb-2">Asset-Backed Value</p>
                    <p className="text-5xl font-bold text-yellow-400">
                      {convertToAssetBacked()} oz
                    </p>
                    <p className="text-sm text-gray-400 mt-2 capitalize">
                      of {selectedMetal}
                    </p>
                  </div>

                  <div className="mt-6 grid grid-cols-3 gap-4 text-center">
                    <div className="p-4 bg-slate-700/50 rounded-lg">
                      <p className="text-sm text-gray-400">Gold</p>
                      <p className="text-xl font-bold text-yellow-400">$2,000/oz</p>
                    </div>
                    <div className="p-4 bg-slate-700/50 rounded-lg">
                      <p className="text-sm text-gray-400">Silver</p>
                      <p className="text-xl font-bold text-gray-300">$25/oz</p>
                    </div>
                    <div className="p-4 bg-slate-700/50 rounded-lg">
                      <p className="text-sm text-gray-400">Platinum</p>
                      <p className="text-xl font-bold text-blue-400">$1,000/oz</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Treasury Direct Account Tab */}
            {activeTab === 'tda' && (
              <div>
                <h2 className="text-2xl font-bold mb-6 text-purple-300">Treasury Direct Account (TDA)</h2>
                <p className="text-gray-300 mb-6">
                  Access your Treasury Direct Account using your birth certificate number and SSN.
                  Every citizen has a secret trust account created at birth.
                </p>

                {!tdaAccount ? (
                  <div className="max-w-2xl mx-auto">
                    <div className="space-y-4 mb-6">
                      <div>
                        <label className="block text-sm font-medium mb-2">Birth Certificate Number</label>
                        <input
                          type="text"
                          value={birthCertNumber}
                          onChange={(e) => setBirthCertNumber(e.target.value)}
                          placeholder="Enter your birth certificate number"
                          className="w-full px-4 py-3 bg-slate-700 border border-purple-500/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2">Social Security Number</label>
                        <input
                          type="text"
                          value={ssn}
                          onChange={(e) => setSsn(e.target.value)}
                          placeholder="XXX-XX-XXXX"
                          maxLength={11}
                          className="w-full px-4 py-3 bg-slate-700 border border-purple-500/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                      </div>
                    </div>

                    <button
                      onClick={generateTDA}
                      className="w-full px-8 py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 rounded-lg font-semibold text-lg transition-all shadow-lg shadow-green-500/50"
                    >
                      Generate TDA Account
                    </button>

                    <div className="mt-6 p-4 bg-yellow-600/20 border border-yellow-500/30 rounded-lg">
                      <p className="text-sm text-yellow-300">
                        ⚠️ <strong>Educational Purposes Only:</strong> This is a simulation of TDA concepts.
                        Consult with a qualified financial advisor before taking any action.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="max-w-2xl mx-auto space-y-6">
                    <div className="p-6 bg-gradient-to-r from-green-600/20 to-emerald-600/20 border border-green-500/30 rounded-lg">
                      <h3 className="text-xl font-bold mb-4 text-green-400">✓ TDA Account Generated</h3>
                      
                      <div className="space-y-3">
                        <div className="flex justify-between items-center p-3 bg-slate-700/50 rounded">
                          <span className="text-gray-400">Account Number:</span>
                          <span className="font-mono font-bold">{tdaAccount.accountNumber}</span>
                        </div>

                        <div className="flex justify-between items-center p-3 bg-slate-700/50 rounded">
                          <span className="text-gray-400">CUSIP Number:</span>
                          <span className="font-mono font-bold">{tdaAccount.cusipNumber}</span>
                        </div>

                        <div className="flex justify-between items-center p-3 bg-slate-700/50 rounded">
                          <span className="text-gray-400">Bond Value:</span>
                          <span className="font-bold text-yellow-400">
                            ${tdaAccount.bondValue.toLocaleString()}
                          </span>
                        </div>

                        <div className="flex justify-between items-center p-3 bg-slate-700/50 rounded">
                          <span className="text-gray-400">Available Balance:</span>
                          <span className="font-bold text-green-400">
                            ${tdaAccount.availableBalance.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => setTdaAccount(null)}
                      className="w-full px-6 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
                    >
                      Generate New Account
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Quantum Financial System Tab */}
            {activeTab === 'qfs' && (
              <div>
                <h2 className="text-2xl font-bold mb-6 text-purple-300">Quantum Financial System (QFS)</h2>
                <p className="text-gray-300 mb-6">
                  The QFS is a new financial system backed by quantum computing technology,
                  eliminating corruption and ensuring transparent, instant transactions.
                </p>

                <div className="max-w-2xl mx-auto space-y-6">
                  <div className="p-8 bg-gradient-to-r from-cyan-600/20 to-blue-600/20 border border-cyan-500/30 rounded-lg text-center">
                    <p className="text-lg text-gray-300 mb-2">Your QFS Balance</p>
                    <p className="text-6xl font-bold text-cyan-400">
                      ${qfsBalance.toLocaleString()}
                    </p>
                    <p className="text-sm text-gray-400 mt-2">
                      Quantum-secured digital currency
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Transfer Amount</label>
                    <div className="flex gap-3">
                      <input
                        type="number"
                        value={qfsTransferAmount}
                        onChange={(e) => setQfsTransferAmount(e.target.value)}
                        placeholder="0.00"
                        className="flex-1 px-4 py-3 bg-slate-700 border border-purple-500/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                      <button
                        onClick={transferToQFS}
                        className="px-8 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 rounded-lg font-semibold transition-all shadow-lg shadow-cyan-500/50"
                      >
                        Transfer to QFS
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-700/50 rounded-lg text-center">
                      <p className="text-sm text-gray-400 mb-1">Transaction Speed</p>
                      <p className="text-2xl font-bold text-green-400">Instant</p>
                    </div>
                    <div className="p-4 bg-slate-700/50 rounded-lg text-center">
                      <p className="text-sm text-gray-400 mb-1">Security Level</p>
                      <p className="text-2xl font-bold text-cyan-400">Quantum</p>
                    </div>
                    <div className="p-4 bg-slate-700/50 rounded-lg text-center">
                      <p className="text-sm text-gray-400 mb-1">Transaction Fee</p>
                      <p className="text-2xl font-bold text-purple-400">$0.00</p>
                    </div>
                    <div className="p-4 bg-slate-700/50 rounded-lg text-center">
                      <p className="text-sm text-gray-400 mb-1">Corruption Level</p>
                      <p className="text-2xl font-bold text-red-400">0%</p>
                    </div>
                  </div>

                  <div className="p-4 bg-blue-600/20 border border-blue-500/30 rounded-lg">
                    <h4 className="font-bold mb-2 text-blue-300">QFS Features:</h4>
                    <ul className="space-y-2 text-sm text-gray-300">
                      <li>✓ Quantum encryption prevents hacking</li>
                      <li>✓ AI monitors all transactions for fraud</li>
                      <li>✓ Instant global transfers</li>
                      <li>✓ Asset-backed digital currency</li>
                      <li>✓ No central bank control</li>
                      <li>✓ Complete transparency</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Birth Certificate Bond Tab */}
            {activeTab === 'bond' && (
              <div>
                <h2 className="text-2xl font-bold mb-6 text-purple-300">Birth Certificate Bond Calculator</h2>
                <p className="text-gray-300 mb-6">
                  When you were born, a bond was created in your name and traded on the stock market.
                  Calculate the estimated value of your birth certificate bond.
                </p>

                <div className="max-w-2xl mx-auto">
                  <div className="mb-6">
                    <label className="block text-sm font-medium mb-2">Birth Year</label>
                    <input
                      type="number"
                      value={birthYear}
                      onChange={(e) => setBirthYear(e.target.value)}
                      placeholder="YYYY"
                      min="1900"
                      max="2024"
                      className="w-full px-4 py-3 bg-slate-700 border border-purple-500/30 rounded-lg text-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <button
                    onClick={calculateBondValue}
                    className="w-full px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-lg font-semibold text-lg transition-all shadow-lg shadow-purple-500/50 mb-6"
                  >
                    Calculate Bond Value
                  </button>

                  {bondEstimate > 0 && (
                    <div className="p-8 bg-gradient-to-r from-purple-600/20 to-pink-600/20 border border-purple-500/30 rounded-lg text-center">
                      <p className="text-lg text-gray-300 mb-2">Estimated Bond Value</p>
                      <p className="text-6xl font-bold text-purple-400">
                        ${bondEstimate.toLocaleString()}
                      </p>
                      <p className="text-sm text-gray-400 mt-4">
                        Based on birth year {birthYear} with compound interest
                      </p>
                    </div>
                  )}

                  <div className="mt-6 p-4 bg-purple-600/20 border border-purple-500/30 rounded-lg">
                    <h4 className="font-bold mb-2 text-purple-300">How It Works:</h4>
                    <ul className="space-y-2 text-sm text-gray-300">
                      <li>• Your birth certificate is registered with the Treasury</li>
                      <li>• A bond is created using your name in ALL CAPS</li>
                      <li>• This bond is traded on the stock market</li>
                      <li>• The bond accrues value over your lifetime</li>
                      <li>• Under NESARA/GESARA, you can access this value</li>
                    </ul>
                  </div>

                  <div className="mt-6 p-4 bg-yellow-600/20 border border-yellow-500/30 rounded-lg">
                    <p className="text-sm text-yellow-300">
                      ⚠️ <strong>Note:</strong> Bond values are estimates based on common theories.
                      Actual values may vary. This is for educational purposes only.
                    </p>
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* Footer Info */}
          <div className="mt-8 p-6 bg-slate-800/30 border border-purple-500/20 rounded-lg">
            <h3 className="text-xl font-bold mb-4 text-purple-300">About NESARA/GESARA</h3>
            <div className="grid md:grid-cols-2 gap-6 text-sm text-gray-300">
              <div>
                <h4 className="font-semibold text-purple-400 mb-2">NESARA (National)</h4>
                <ul className="space-y-1">
                  <li>• Eliminates all illegal debt</li>
                  <li>• Abolishes income tax</li>
                  <li>• Returns to Constitutional Law</li>
                  <li>• Releases prosperity funds</li>
                  <li>• New precious metal-backed currency</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-purple-400 mb-2">GESARA (Global)</h4>
                <ul className="space-y-1">
                  <li>• Worldwide debt forgiveness</li>
                  <li>• End to poverty and hunger</li>
                  <li>• Release of suppressed technologies</li>
                  <li>• Environmental restoration</li>
                  <li>• Global peace and prosperity</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
