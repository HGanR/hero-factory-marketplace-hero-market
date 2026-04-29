"use client";

// Final Enhanced Accounting System with Document Import Integration
// TroothHurtz Complete Accounting Solution

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  Calculator,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  Receipt,
  FileText,
  Download,
  Upload,
  Plus,
  Trash2,
  Search,
  Filter,
  Settings,
  BarChart3,
  CheckCircle,
  AlertTriangle,
  Shield,
  Globe,
  Database,
  UserPlus,
  X,
} from "lucide-react";

import DocumentImportInterface from "@/components/DocumentImportInterface";
import type { ExtractedTransaction } from "@/lib/document-import-system";

// Enhanced interfaces with document import integration
interface Transaction {
  id: string;
  date: string;
  description: string;
  client?: string;
  amount: number;
  category: string;
  type: "income" | "expense";
  taxDeductible: boolean;
  businessExpense: boolean;
  receiptUrl?: string;
  notes?: string;
  confidence?: number;
  imported?: boolean;
  importSource?: string;
  merchant?: string;
  location?: string;
  checkNumber?: string;
  referenceNumber?: string;
}

interface BusinessInfo {
  name: string;
  ein: string;
  address: string;
  phone: string;
  email: string;
  businessType: string;
  taxYear: number;
  accountingMethod: "cash" | "accrual";
}

interface TaxSettings {
  federalRate: number;
  stateRate: number;
  selfEmploymentRate: number;
  state: string;
  filingStatus: "single" | "married_joint" | "married_separate" | "head_of_household";
  standardDeduction: number;
}

interface AccountingData {
  transactions: Transaction[];
  businessInfo: BusinessInfo;
  taxSettings: TaxSettings;
  lastSaved: string;
  version: string;
}

// US State tax rates (simplified - in production, use real-time API)
const STATE_TAX_RATES: Record<string, number> = {
  AL: 0.05,
  AK: 0.0,
  AZ: 0.045,
  AR: 0.063,
  CA: 0.133,
  CO: 0.0463,
  CT: 0.0699,
  DE: 0.066,
  FL: 0.0,
  GA: 0.0575,
  HI: 0.11,
  ID: 0.0625,
  IL: 0.0495,
  IN: 0.0323,
  IA: 0.0853,
  KS: 0.057,
  KY: 0.05,
  LA: 0.06,
  ME: 0.0715,
  MD: 0.0575,
  MA: 0.05,
  MI: 0.0425,
  MN: 0.0985,
  MS: 0.05,
  MO: 0.054,
  MT: 0.0675,
  NE: 0.0684,
  NV: 0.0,
  NH: 0.05,
  NJ: 0.1075,
  NM: 0.059,
  NY: 0.0882,
  NC: 0.0525,
  ND: 0.029,
  OH: 0.0399,
  OK: 0.05,
  OR: 0.099,
  PA: 0.0307,
  RI: 0.0599,
  SC: 0.07,
  SD: 0.0,
  TN: 0.0,
  TX: 0.0,
  UT: 0.0495,
  VT: 0.0875,
  VA: 0.0575,
  WA: 0.0,
  WV: 0.065,
  WI: 0.0765,
  WY: 0.0,
};

// IRS tax categories with codes
const TAX_CATEGORIES = [
  { code: "01", name: "Advertising", deductible: true },
  { code: "02", name: "Vehicle expenses", deductible: true },
  { code: "03", name: "Commissions and fees", deductible: true },
  { code: "04", name: "Contract labor", deductible: true },
  { code: "05", name: "Depletion", deductible: true },
  { code: "06", name: "Depreciation", deductible: true },
  { code: "07", name: "Employee benefit programs", deductible: true },
  { code: "08", name: "Insurance (other than health)", deductible: true },
  { code: "09", name: "Interest (mortgage/other)", deductible: true },
  { code: "10", name: "Legal and professional services", deductible: true },
  { code: "11", name: "Office expense", deductible: true },
  { code: "12", name: "Pension and profit-sharing plans", deductible: true },
  { code: "13", name: "Rent or lease (vehicles/equipment)", deductible: true },
  { code: "14", name: "Rent or lease (other business property)", deductible: true },
  { code: "15", name: "Repairs and maintenance", deductible: true },
  { code: "16", name: "Supplies", deductible: true },
  { code: "17", name: "Taxes and licenses", deductible: true },
  { code: "18", name: "Travel", deductible: true },
  { code: "19", name: "Meals", deductible: true, percentage: 50 },
  { code: "20", name: "Utilities", deductible: true },
  { code: "21", name: "Wages", deductible: true },
  { code: "22", name: "Bank service charges", deductible: true },
  { code: "23", name: "Education and training", deductible: true },
  { code: "24", name: "Cryptocurrency Operations", deductible: true },
  { code: "25", name: "XRPL Transaction Fees", deductible: true },
  { code: "26", name: "Other expenses", deductible: true },
  { code: "27", name: "Personal expenses", deductible: false },
];

const EnhancedAccountingSystem: React.FC = () => {
  // Core state (SSR-safe)
  const [accountingData, setAccountingData] = useState<AccountingData>(() => {
    if (typeof window === "undefined") {
      // Return default data during SSR
      return {
        transactions: [],
        businessInfo: {
          name: "",
          ein: "",
          address: "",
          phone: "",
          email: "",
          businessType: "",
          taxYear: new Date().getFullYear(),
          accountingMethod: "cash",
        },
        taxSettings: {
          federalRate: 0.22,
          stateRate: 0.05,
          selfEmploymentRate: 0.1413,
          state: "CA",
          filingStatus: "single",
          standardDeduction: 14600,
        },
        lastSaved: new Date().toISOString(),
        version: "1.0.0",
      };
    }
    const saved = localStorage.getItem("troothhurtz_accounting_data");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (error) {
        console.error("Error loading saved data:", error);
      }
    }

    return {
      transactions: [],
      businessInfo: {
        name: "TroothHurtz Business",
        ein: "",
        address: "",
        phone: "",
        email: "",
        businessType: "LLC",
        taxYear: new Date().getFullYear(),
        accountingMethod: "cash",
      },
      taxSettings: {
        federalRate: 0.22,
        stateRate: 0.05,
        selfEmploymentRate: 0.1413,
        state: "CA",
        filingStatus: "single",
        standardDeduction: 13850,
      },
      lastSaved: new Date().toISOString(),
      version: "2.0.0",
    };
  });

  // UI state
  const [activeTab, setActiveTab] = useState<
    "dashboard" | "income" | "expenses" | "taxes" | "reports" | "settings"
  >("dashboard");
  const [showAddTransaction, setShowAddTransaction] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterType, setFilterType] = useState<"all" | "income" | "expense">("all");
  const [sortBy, setSortBy] = useState<"date" | "amount" | "description">("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [showDocumentImport, setShowDocumentImport] = useState(false);
  const [selectedTransactions, setSelectedTransactions] = useState<Set<string>>(new Set());
  const [bulkEditMode, setBulkEditMode] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [addTxError, setAddTxError] = useState("");
  const [newTx, setNewTx] = useState<{
    date: string;
    type: "income" | "expense";
    description: string;
    client: string;
    amount: string; // keep as string for controlled input
    category: string;
    taxDeductible: boolean;
    businessExpense: boolean;
    notes: string;
  }>({
    date: new Date().toISOString().split("T")[0],
    type: "expense",
    description: "",
    client: "",
    amount: "",
    category: "Other expenses",
    taxDeductible: false,
    businessExpense: false,
    notes: "",
  });

  // Reset add-transaction form when opening modal
  useEffect(() => {
    if (!showAddTransaction) return;
    setAddTxError("");
    setNewTx({
      date: new Date().toISOString().split("T")[0],
      type: "expense",
      description: "",
      client: "",
      amount: "",
      category: "Other expenses",
      taxDeductible: false,
      businessExpense: false,
      notes: "",
    });
  }, [showAddTransaction]);

  // Auto-save functionality (SSR-safe)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saveData = () => {
      const dataToSave = {
        ...accountingData,
        lastSaved: new Date().toISOString(),
      };
      localStorage.setItem("troothhurtz_accounting_data", JSON.stringify(dataToSave));
    };

    const timeoutId = setTimeout(saveData, 1000);
    return () => clearTimeout(timeoutId);
  }, [accountingData]);

  // Update state tax rate when state changes
  useEffect(() => {
    if (accountingData.taxSettings.state) {
      const stateRate = STATE_TAX_RATES[accountingData.taxSettings.state] || 0;
      if (stateRate !== accountingData.taxSettings.stateRate) {
        setAccountingData((prev) => ({
          ...prev,
          taxSettings: {
            ...prev.taxSettings,
            stateRate,
          },
        }));
      }
    }
  }, [accountingData.taxSettings.state]);

  // Calculations
  const calculations = useMemo(() => {
    const { transactions } = accountingData;

    const totalIncome = transactions
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + t.amount, 0);

    const totalExpenses = transactions
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + t.amount, 0);

    const deductibleExpenses = transactions
      .filter((t) => t.type === "expense" && t.taxDeductible)
      .reduce((sum, t) => sum + t.amount, 0);

    const netIncome = totalIncome - totalExpenses;
    const taxableIncome = Math.max(0, totalIncome - deductibleExpenses);

    const federalTax = taxableIncome * accountingData.taxSettings.federalRate;
    const stateTax = taxableIncome * accountingData.taxSettings.stateRate;
    const selfEmploymentTax = netIncome * accountingData.taxSettings.selfEmploymentRate;

    const totalTaxes = federalTax + stateTax + selfEmploymentTax;
    const netAfterTax = netIncome - totalTaxes;

    const quarterlyEstimate = totalTaxes / 4;

    // Monthly breakdown
    const monthlyData = Array.from({ length: 12 }, (_, i) => {
      const month = i + 1;
      const monthTransactions = transactions.filter((t) => {
        const transactionMonth = new Date(t.date).getMonth() + 1;
        return transactionMonth === month;
      });

      const monthIncome = monthTransactions
        .filter((t) => t.type === "income")
        .reduce((sum, t) => sum + t.amount, 0);

      const monthExpenses = monthTransactions
        .filter((t) => t.type === "expense")
        .reduce((sum, t) => sum + t.amount, 0);

      return {
        month,
        income: monthIncome,
        expenses: monthExpenses,
        net: monthIncome - monthExpenses,
      };
    });

    // Category breakdown
    const categoryBreakdown = TAX_CATEGORIES.map((category) => {
      const categoryTransactions = transactions.filter((t) => t.category === category.name);
      const total = categoryTransactions.reduce((sum, t) => sum + t.amount, 0);

      return {
        ...category,
        total,
        count: categoryTransactions.length,
        percentage: totalExpenses > 0 ? (total / totalExpenses) * 100 : 0,
      };
    }).filter((c) => c.total > 0);

    return {
      totalIncome,
      totalExpenses,
      deductibleExpenses,
      netIncome,
      taxableIncome,
      federalTax,
      stateTax,
      selfEmploymentTax,
      totalTaxes,
      netAfterTax,
      quarterlyEstimate,
      monthlyData,
      categoryBreakdown,
      profitMargin: totalIncome > 0 ? (netIncome / totalIncome) * 100 : 0,
      taxRate: taxableIncome > 0 ? (totalTaxes / taxableIncome) * 100 : 0,
    };
  }, [accountingData]);

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    let filtered = accountingData.transactions;

    // Apply filters
    if (filterType !== "all") {
      filtered = filtered.filter((t) => t.type === filterType);
    }

    if (filterCategory !== "all") {
      filtered = filtered.filter((t) => t.category === filterCategory);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.description.toLowerCase().includes(term) ||
          t.client?.toLowerCase().includes(term) ||
          t.category.toLowerCase().includes(term) ||
          t.notes?.toLowerCase().includes(term)
      );
    }

    if (dateRange.start) {
      filtered = filtered.filter((t) => t.date >= dateRange.start);
    }

    if (dateRange.end) {
      filtered = filtered.filter((t) => t.date <= dateRange.end);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aVal: any, bVal: any;

      switch (sortBy) {
        case "date":
          aVal = new Date(a.date);
          bVal = new Date(b.date);
          break;
        case "amount":
          aVal = a.amount;
          bVal = b.amount;
          break;
        case "description":
          aVal = a.description.toLowerCase();
          bVal = b.description.toLowerCase();
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return sortOrder === "asc" ? -1 : 1;
      if (aVal > bVal) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [
    accountingData.transactions,
    filterType,
    filterCategory,
    searchTerm,
    dateRange,
    sortBy,
    sortOrder,
  ]);

  // Transaction management
  const addTransaction = useCallback((transaction: Omit<Transaction, "id">) => {
    const newTransaction: Transaction = {
      ...transaction,
      id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
    };

    setAccountingData((prev) => ({
      ...prev,
      transactions: [...prev.transactions, newTransaction],
    }));
  }, []);

  const deleteTransaction = useCallback((id: string) => {
    setAccountingData((prev) => ({
      ...prev,
      transactions: prev.transactions.filter((t) => t.id !== id),
    }));
  }, []);

  const deleteSelectedTransactions = useCallback(() => {
    setAccountingData((prev) => ({
      ...prev,
      transactions: prev.transactions.filter((t) => !selectedTransactions.has(t.id)),
    }));
    setSelectedTransactions(new Set());
  }, [selectedTransactions]);

  // Document import handler
  const handleDocumentImport = useCallback(
    (importedTransactions: ExtractedTransaction[], accountInfo: any) => {
      const newTransactions: Transaction[] = importedTransactions.map((tx) => ({
        id: `imported_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
        date: tx.date,
        description: tx.description,
        amount: Math.abs(tx.amount),
        category: tx.suggestedAccountingCategory,
        type: tx.type === "credit" ? "income" : "expense",
        taxDeductible: tx.taxDeductible,
        businessExpense: tx.isBusinessExpense,
        confidence: tx.confidence,
        imported: true,
        importSource: "document_import",
        merchant: tx.merchant,
        location: tx.location,
        checkNumber: tx.checkNumber,
        referenceNumber: tx.referenceNumber,
      }));

      setAccountingData((prev) => ({
        ...prev,
        transactions: [...prev.transactions, ...newTransactions],
      }));

      setShowDocumentImport(false);
    },
    []
  );

  // Export functions
  const exportToCSV = useCallback(() => {
    const headers = [
      "Date",
      "Description",
      "Client",
      "Amount",
      "Category",
      "Type",
      "Tax Deductible",
      "Business Expense",
      "Notes",
    ];
    const csvContent = [
      headers.join(","),
      ...filteredTransactions.map((t) =>
        [
          t.date,
          `"${t.description}"`,
          `"${t.client || ""}"`,
          t.amount,
          `"${t.category}"`,
          t.type,
          t.taxDeductible,
          t.businessExpense,
          `"${t.notes || ""}"`,
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `troothhurtz_accounting_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filteredTransactions]);

  const exportToJSON = useCallback(() => {
    const exportData = {
      ...accountingData,
      calculations,
      exportDate: new Date().toISOString(),
      version: "2.0.0",
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `troothhurtz_accounting_complete_${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [accountingData, calculations]);

  // Render dashboard
  const renderDashboard = () => (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-xl border border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-600 text-sm font-medium">Total Income</p>
              <p className="text-2xl font-bold text-green-900">
                ${calculations.totalIncome.toLocaleString()}
              </p>
              <p className="text-green-600 text-sm">
                +{calculations.profitMargin.toFixed(1)}% margin
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-green-600" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-red-50 to-red-100 p-6 rounded-xl border border-red-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-600 text-sm font-medium">Total Expenses</p>
              <p className="text-2xl font-bold text-red-900">
                ${calculations.totalExpenses.toLocaleString()}
              </p>
              <p className="text-red-600 text-sm">
                ${calculations.deductibleExpenses.toLocaleString()} deductible
              </p>
            </div>
            <TrendingDown className="w-8 h-8 text-red-600" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-xl border border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-600 text-sm font-medium">Net Income</p>
              <p className="text-2xl font-bold text-blue-900">
                ${calculations.netIncome.toLocaleString()}
              </p>
              <p className="text-blue-600 text-sm">After expenses</p>
            </div>
            <DollarSign className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-xl border border-purple-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-600 text-sm font-medium">Estimated Taxes</p>
              <p className="text-2xl font-bold text-purple-900">
                ${calculations.totalTaxes.toLocaleString()}
              </p>
              <p className="text-purple-600 text-sm">
                ${calculations.quarterlyEstimate.toLocaleString()}/quarter
              </p>
            </div>
            <Receipt className="w-8 h-8 text-purple-600" />
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-slate-950 p-6 rounded-xl border border-slate-800">
        <h3 className="text-lg font-semibold text-slate-100 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => setShowAddTransaction(true)}
            className="flex items-center justify-center space-x-2 p-4 bg-cyan-500 text-black rounded-lg hover:bg-cyan-400 transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span>Add Transaction</span>
          </button>

          <button
            onClick={() => setShowDocumentImport(true)}
            className="flex items-center justify-center space-x-2 p-4 bg-slate-800 text-slate-50 rounded-lg hover:bg-slate-700 transition-colors"
          >
            <Upload className="w-5 h-5" />
            <span>Import Documents</span>
          </button>

          <button
            onClick={exportToCSV}
            className="flex items-center justify-center space-x-2 p-4 bg-slate-800 text-slate-50 rounded-lg hover:bg-slate-700 transition-colors"
          >
            <Download className="w-5 h-5" />
            <span>Export Data</span>
          </button>
        </div>
      </div>
    </div>
  );

  // Render transactions table (trimmed: retains core table, filters, and bulk delete)
  const renderTransactionsTable = () => (
    <div className="space-y-6">
      {/* Filters and Actions */}
      <div className="bg-slate-950 p-6 rounded-xl border border-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div className="flex items-center space-x-4">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search transactions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-slate-800 bg-slate-950/40 text-slate-50 placeholder:text-slate-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>

            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              className="px-3 py-2 border border-slate-800 bg-slate-950/40 text-slate-50 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="all">All Types</option>
              <option value="income">Income</option>
              <option value="expense">Expenses</option>
            </select>

            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-3 py-2 border border-slate-800 bg-slate-950/40 text-slate-50 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="all">All Categories</option>
              {TAX_CATEGORIES.map((category) => (
                <option key={category.code} value={category.name}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className="p-2 text-slate-300 hover:text-slate-100 transition-colors"
              title="Advanced filters"
            >
              <Filter className="w-5 h-5" />
            </button>

            <button
              onClick={() => setBulkEditMode(!bulkEditMode)}
              className={`px-3 py-2 rounded-lg transition-colors ${
                bulkEditMode
                  ? "bg-cyan-500 text-black"
                  : "bg-slate-800 text-slate-200 hover:bg-slate-700"
              }`}
            >
              Bulk Edit
            </button>

            <button
              onClick={() => setShowAddTransaction(true)}
              className="px-4 py-2 bg-cyan-500 text-black rounded-lg hover:bg-cyan-400 transition-colors flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>Add</span>
            </button>

            <button
              onClick={() => setShowDocumentImport(true)}
              className="px-4 py-2 bg-slate-800 text-slate-50 rounded-lg hover:bg-slate-700 transition-colors flex items-center space-x-2"
            >
              <Upload className="w-4 h-4" />
              <span>Import</span>
            </button>
          </div>
        </div>

        {/* Advanced Filters */}
        {showAdvancedFilters && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-slate-900/40 border border-slate-800 rounded-lg">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Start Date</label>
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange((prev) => ({ ...prev, start: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-800 bg-slate-950/40 text-slate-50 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">End Date</label>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange((prev) => ({ ...prev, end: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-800 bg-slate-950/40 text-slate-50 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>

            <div className="flex items-end">
              <button
                onClick={() => setDateRange({ start: "", end: "" })}
                className="px-4 py-2 bg-slate-800 text-slate-50 rounded-lg hover:bg-slate-700 transition-colors"
              >
                Clear Filters
              </button>
            </div>
          </div>
        )}

        {/* Bulk Actions */}
        {bulkEditMode && selectedTransactions.size > 0 && (
          <div className="flex items-center justify-between p-4 bg-cyan-900/20 border border-cyan-800/50 rounded-lg mt-4">
            <span className="text-cyan-100 font-medium">
              {selectedTransactions.size} transaction(s) selected
            </span>
            <div className="flex items-center space-x-2">
              <button
                onClick={deleteSelectedTransactions}
                className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors flex items-center space-x-1"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Transactions Table */}
      <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-900/60">
              <tr>
                {bulkEditMode && (
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={
                        selectedTransactions.size === filteredTransactions.length &&
                        filteredTransactions.length > 0
                      }
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedTransactions(new Set(filteredTransactions.map((t) => t.id)));
                        } else {
                          setSelectedTransactions(new Set());
                        }
                      }}
                      className="rounded border-slate-700 text-cyan-400 focus:ring-cyan-500"
                    />
                  </th>
                )}
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Description
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Tax
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-slate-950 divide-y divide-slate-800">
              {filteredTransactions.map((transaction) => (
                <tr
                  key={transaction.id}
                  className={selectedTransactions.has(transaction.id) ? "bg-cyan-900/20" : "hover:bg-slate-900/40"}
                >
                  {bulkEditMode && (
                    <td className="px-4 py-4">
                      <input
                        type="checkbox"
                        checked={selectedTransactions.has(transaction.id)}
                        onChange={(e) => {
                          const newSelected = new Set(selectedTransactions);
                          if (e.target.checked) newSelected.add(transaction.id);
                          else newSelected.delete(transaction.id);
                          setSelectedTransactions(newSelected);
                        }}
                        className="rounded border-slate-700 text-cyan-400 focus:ring-cyan-500"
                      />
                    </td>
                  )}
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-100">
                    {new Date(transaction.date).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-4 text-sm text-slate-100 max-w-xs">
                    <div className="flex items-center space-x-2">
                      <span className="truncate">{transaction.description}</span>
                      {transaction.imported && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-900/40 text-green-200">
                          Imported
                        </span>
                      )}
                      {transaction.confidence && transaction.confidence < 0.7 && (
                        <span
                          title={`Low confidence: ${Math.round(transaction.confidence * 100)}%`}
                        >
                          <AlertTriangle className="w-4 h-4 text-yellow-500" />
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                    <span className={transaction.type === "income" ? "text-green-600" : "text-red-600"}>
                      {transaction.type === "income" ? "+" : "-"}${transaction.amount.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-100">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-200">
                      {transaction.category}
                    </span>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        transaction.type === "income" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                      }`}
                    >
                      {transaction.type}
                    </span>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-100">
                    {transaction.taxDeductible ? (
                      <span title="Tax deductible">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      </span>
                    ) : (
                      <span title="Not deductible">
                        <X className="w-4 h-4 text-gray-400" />
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    <button
                      onClick={() => setEditingTransaction(transaction)}
                      className="text-cyan-300 hover:text-cyan-200 transition-colors"
                      title="Edit transaction"
                    >
                      <Settings className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteTransaction(transaction.id)}
                      className="text-red-600 hover:text-red-900 transition-colors"
                      title="Delete transaction"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      {/* Header */}
      <div className="bg-slate-950 border-b border-slate-800">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between min-h-16 py-3 gap-4 flex-wrap">
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <Calculator className="w-6 h-6 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl font-bold text-slate-100 break-words">
                  TroothHurtz Accounting
                </h1>
                <p className="text-sm text-slate-300 break-words">
                  Professional Business Management
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-4 flex-wrap justify-end">
              {/* Primary Navigation Buttons */}
              <div className="flex items-center space-x-2">
                <Link
                  href="/compliance"
                  className="flex items-center space-x-2 px-4 py-2 bg-orange-500 text-black rounded-lg hover:bg-[#00d1ff] hover:text-black transition-colors"
                  title="Compliance Dashboard"
                >
                  <Shield className="w-4 h-4" />
                  <span className="text-sm font-medium">Compliance</span>
                </Link>

                <Link
                  href="/postalone"
                  className="flex items-center space-x-2 px-4 py-2 bg-orange-500 text-black rounded-lg hover:bg-[#00d1ff] hover:text-black transition-colors"
                  title="PostalOne! Trust Account"
                >
                  <Database className="w-4 h-4" />
                  <span className="text-sm font-medium">PostalOne!</span>
                </Link>

                <Link
                  href="/instrument-deposits"
                  className="flex items-center space-x-2 px-4 py-2 bg-orange-500 text-black rounded-lg hover:bg-[#00d1ff] hover:text-black transition-colors"
                  title="Instrument Deposits"
                >
                  <FileText className="w-4 h-4" />
                  <span className="text-sm font-medium">Instrument Deposits</span>
                </Link>

                <Link
                  href="/onboarding"
                  className="flex items-center space-x-2 px-4 py-2 bg-orange-500 text-black rounded-lg hover:bg-[#00d1ff] hover:text-black transition-colors"
                  title="Onboarding"
                >
                  <UserPlus className="w-4 h-4" />
                  <span className="text-sm font-medium">Onboarding</span>
                </Link>

                <Link
                  href="/nesara-gesara"
                  className="flex items-center space-x-2 px-4 py-2 bg-orange-500 text-black rounded-lg hover:bg-[#00d1ff] hover:text-black transition-colors"
                  title="NESARA GESARA"
                >
                  <Globe className="w-4 h-4" />
                  <span className="text-sm font-medium">NESARA GESARA</span>
                </Link>
              </div>

              <div className="flex items-center space-x-4">
                <div className="text-right">
                  <p className="text-sm font-medium text-slate-200">Net Income</p>
                  <p className={`text-lg font-bold ${calculations.netIncome >= 0 ? "text-green-600" : "text-red-600"}`}>
                    ${calculations.netIncome.toLocaleString()}
                  </p>
                </div>

                <button
                  onClick={exportToJSON}
                  className="p-2 text-slate-300 hover:text-slate-100 transition-colors"
                  title="Export all data"
                >
                  <Download className="w-5 h-5" />
                </button>

                <button
                  onClick={() => setShowDocumentImport(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
                >
                  <Upload className="w-4 h-4" />
                  <span>Import</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8">
            {[
              { id: "dashboard", name: "Dashboard", icon: BarChart3 },
              { id: "income", name: "Income", icon: TrendingUp },
              { id: "expenses", name: "Expenses", icon: TrendingDown },
              { id: "taxes", name: "Taxes", icon: Receipt },
              { id: "reports", name: "Reports", icon: FileText },
              { id: "settings", name: "Settings", icon: Settings },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`
                    flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors
                    ${
                      activeTab === tab.id
                        ? "border-cyan-500 text-cyan-300"
                        : "border-transparent text-slate-400 hover:text-slate-100 hover:border-slate-700"
                    }
                  `}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.name}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === "dashboard" && renderDashboard()}
        {(activeTab === "income" || activeTab === "expenses") && renderTransactionsTable()}
        {/* Other tabs can be extended similarly */}
      </div>

      {/* Document Import Modal */}
      {showDocumentImport && (
        <DocumentImportInterface
          onImportComplete={handleDocumentImport}
          onClose={() => setShowDocumentImport(false)}
          existingCategories={TAX_CATEGORIES.map((c) => c.name)}
          businessInfo={accountingData.businessInfo}
        />
      )}

      {/* Add Transaction Modal */}
      {showAddTransaction && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-xl shadow-2xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-slate-100 mb-4">Add Transaction</h2>
            {addTxError ? (
              <div className="mb-4 p-3 rounded-lg border border-red-300 bg-red-50 text-red-700 text-sm">
                {addTxError}
              </div>
            ) : null}

            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                setAddTxError("");

                const description = newTx.description.trim();
                if (!description) {
                  setAddTxError("Description is required.");
                  return;
                }

                const amountNum = Number(newTx.amount);
                if (!isFinite(amountNum) || amountNum <= 0) {
                  setAddTxError("Amount must be a number greater than 0.");
                  return;
                }

                addTransaction({
                  date: newTx.date,
                  description,
                  client: newTx.client.trim() ? newTx.client.trim() : undefined,
                  amount: Math.abs(amountNum),
                  category: newTx.category,
                  type: newTx.type,
                  taxDeductible: newTx.taxDeductible,
                  businessExpense: newTx.businessExpense,
                  notes: newTx.notes.trim() ? newTx.notes.trim() : undefined,
                });

                setShowAddTransaction(false);
              }}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-slate-300 mb-1">Date</label>
                  <input
                    type="date"
                    value={newTx.date}
                    onChange={(e) => setNewTx((p) => ({ ...p, date: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-800 bg-slate-950/40 text-slate-50 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-300 mb-1">Type</label>
                  <select
                    value={newTx.type}
                    onChange={(e) => setNewTx((p) => ({ ...p, type: e.target.value as "income" | "expense" }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-800 bg-slate-950/40 text-slate-50 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  >
                    <option value="income">Income</option>
                    <option value="expense">Expense</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-slate-300 mb-1">Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newTx.amount}
                    onChange={(e) => setNewTx((p) => ({ ...p, amount: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-800 bg-slate-950/40 text-slate-50 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    placeholder="0.00"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-300 mb-1">Category</label>
                  <select
                    value={newTx.category}
                    onChange={(e) => setNewTx((p) => ({ ...p, category: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-800 bg-slate-950/40 text-slate-50 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  >
                    {TAX_CATEGORIES.map((c) => (
                      <option key={c.code} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-300 mb-1">Description</label>
                <input
                  value={newTx.description}
                  onChange={(e) => setNewTx((p) => ({ ...p, description: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-800 bg-slate-950/40 text-slate-50 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  placeholder="What was this for?"
                  required
                />
              </div>

              <div>
                <label className="block text-sm text-slate-300 mb-1">Client (optional)</label>
                <input
                  value={newTx.client}
                  onChange={(e) => setNewTx((p) => ({ ...p, client: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-800 bg-slate-950/40 text-slate-50 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  placeholder="Client name"
                />
              </div>

              <div className="flex items-center gap-6 flex-wrap">
                <label className="inline-flex items-center gap-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={newTx.taxDeductible}
                    onChange={(e) => setNewTx((p) => ({ ...p, taxDeductible: e.target.checked }))}
                  />
                  Tax deductible
                </label>
                <label className="inline-flex items-center gap-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={newTx.businessExpense}
                    onChange={(e) => setNewTx((p) => ({ ...p, businessExpense: e.target.checked }))}
                  />
                  Business expense
                </label>
              </div>

              <div>
                <label className="block text-sm text-slate-300 mb-1">Notes (optional)</label>
                <textarea
                  value={newTx.notes}
                  onChange={(e) => setNewTx((p) => ({ ...p, notes: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-800 bg-slate-950/40 text-slate-50 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  rows={3}
                  placeholder="Any additional details…"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddTransaction(false)}
                  className="px-4 py-2 text-slate-200 border border-slate-700 rounded-lg hover:bg-slate-900/40 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-cyan-500 text-black rounded-lg hover:bg-cyan-400 transition-colors"
                >
                  Add Transaction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Transaction Modal (placeholder) */}
      {editingTransaction && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-slate-100">Edit Transaction</h2>
              <button onClick={() => setEditingTransaction(null)} className="text-slate-400 hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-slate-300">
              Placeholder editor for: <span className="font-medium">{editingTransaction.description}</span>
            </p>
            <div className="flex justify-end mt-6">
              <button
                onClick={() => setEditingTransaction(null)}
                className="px-4 py-2 bg-slate-800 text-slate-50 rounded-lg hover:bg-slate-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnhancedAccountingSystem;


