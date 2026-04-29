"use client";

// Comprehensive Document Import Interface Component
// TroothHurtz Enhanced Accounting System

import React, { useId, useState, useCallback, useRef } from "react";
import {
  Upload,
  FileText,
  Image,
  File as FileIcon,
  CheckCircle,
  AlertCircle,
  X,
  Eye,
  Download,
  RefreshCw,
  Zap,
  Brain,
  Target,
  TrendingUp,
  DollarSign,
  Building,
  CreditCard,
  Banknote,
  Receipt,
  FileSpreadsheet,
  Settings,
  Filter,
  Search,
  Edit3,
  Trash2,
  ArrowRight,
  ArrowLeft,
  Check,
} from "lucide-react";

import type {
  DocumentImportResult,
  ExtractedFinancialData,
  ExtractedTransaction,
} from "@/lib/document-import-system";
import { DocumentImportSystem } from "@/lib/document-import-system";

interface DocumentImportInterfaceProps {
  onImportComplete: (transactions: ExtractedTransaction[], accountInfo: any) => void;
  onClose: () => void;
  existingCategories: string[];
  businessInfo: any;
}

interface ProcessingStep {
  id: string;
  name: string;
  status: "pending" | "processing" | "completed" | "error";
  progress: number;
  message: string;
  duration?: number;
}

interface ReviewTransaction extends ExtractedTransaction {
  selected: boolean;
  edited: boolean;
  originalData: Partial<ExtractedTransaction>;
}

export const DocumentImportInterface: React.FC<DocumentImportInterfaceProps> = ({
  onImportComplete,
  onClose,
  existingCategories,
  businessInfo,
}) => {
  // State management
  const [currentStep, setCurrentStep] = useState<
    "upload" | "processing" | "review" | "complete"
  >("upload");
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [processingSteps, setProcessingSteps] = useState<ProcessingStep[]>([]);
  const [extractedData, setExtractedData] = useState<ExtractedFinancialData | null>(null);
  const [reviewTransactions, setReviewTransactions] = useState<ReviewTransaction[]>([]);
  const [importResult, setImportResult] = useState<DocumentImportResult | null>(null);
  const [selectedTransactions, setSelectedTransactions] = useState<Set<string>>(new Set());
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [previewMode, setPreviewMode] = useState<"table" | "cards">("table");
  const [sortBy, setSortBy] = useState<"date" | "amount" | "description" | "confidence">(
    "date"
  );
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileInputId = useId();
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // Initialize processing steps
  const initializeProcessingSteps = useCallback(() => {
    const steps: ProcessingStep[] = [
      {
        id: "upload",
        name: "File Upload",
        status: "completed",
        progress: 100,
        message: "File uploaded successfully",
      },
      {
        id: "detection",
        name: "Document Type Detection",
        status: "pending",
        progress: 0,
        message: "Analyzing document structure...",
      },
      {
        id: "extraction",
        name: "Text Extraction (OCR)",
        status: "pending",
        progress: 0,
        message: "Extracting text from document...",
      },
      {
        id: "parsing",
        name: "Data Parsing",
        status: "pending",
        progress: 0,
        message: "Parsing financial data...",
      },
      {
        id: "categorization",
        name: "Smart Categorization",
        status: "pending",
        progress: 0,
        message: "Categorizing transactions...",
      },
      {
        id: "validation",
        name: "Data Validation",
        status: "pending",
        progress: 0,
        message: "Validating extracted data...",
      },
    ];
    setProcessingSteps(steps);
  }, []);

  // File upload handlers
  const handleFileSelect = useCallback(
    (files: FileList | null) => {
      if (!files) return;

      const validFiles = Array.from(files).filter((file) => {
        const isValidType =
          [
            "application/pdf",
            "image/jpeg",
            "image/png",
            "image/gif",
            "text/csv",
            "application/vnd.ms-excel",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "text/plain",
          ].includes(file.type) ||
          file.name.endsWith(".csv") ||
          file.name.endsWith(".txt");

        const isValidSize = file.size <= 10 * 1024 * 1024; // 10MB limit

        return isValidType && isValidSize;
      });

      setUploadedFiles(validFiles);
      if (validFiles.length > 0) {
        initializeProcessingSteps();
      }
    },
    [initializeProcessingSteps]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      handleFileSelect(e.dataTransfer.files);
    },
    [handleFileSelect]
  );

  // Document processing
  const processDocuments = useCallback(async () => {
    if (uploadedFiles.length === 0) return;

    setCurrentStep("processing");

    try {
      // Simulate processing steps with realistic timing
      const steps = [...processingSteps];

      for (let i = 1; i < steps.length; i++) {
        const step = steps[i];

        // Start processing step
        step.status = "processing";
        step.progress = 0;
        setProcessingSteps([...steps]);

        // Simulate progress
        for (let progress = 0; progress <= 100; progress += 10) {
          step.progress = progress;
          setProcessingSteps([...steps]);
          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        // Complete step
        step.status = "completed";
        step.duration = Math.random() * 2000 + 500; // Random duration

        // Update step message based on completion
        switch (step.id) {
          case "detection":
            step.message = "Bank statement detected";
            break;
          case "extraction":
            step.message = "Text extracted successfully";
            break;
          case "parsing":
            step.message = "Financial data parsed";
            break;
          case "categorization":
            step.message = "Transactions categorized";
            break;
          case "validation":
            step.message = "Data validation complete";
            break;
        }

        setProcessingSteps([...steps]);
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      // Process the actual document
      const result = await DocumentImportSystem.processDocument(uploadedFiles[0]);
      setImportResult(result);

      if (result.success) {
        setExtractedData(result.extractedData);

        // Convert to review transactions
        const reviewTxns: ReviewTransaction[] = result.extractedData.transactions.map(
          (tx) => ({
            ...tx,
            selected: true,
            edited: false,
            originalData: { ...tx },
          })
        );

        setReviewTransactions(reviewTxns);
        setSelectedTransactions(new Set(reviewTxns.map((tx) => tx.id)));
        setCurrentStep("review");
      } else {
        // Handle error
        const lastStep = steps[steps.length - 1];
        lastStep.status = "error";
        lastStep.message = result.errors[0] || "Processing failed";
        setProcessingSteps([...steps]);
      }
    } catch (error) {
      console.error("Processing error:", error);
      const steps = [...processingSteps];
      const currentProcessingStep = steps.find((s) => s.status === "processing");
      if (currentProcessingStep) {
        currentProcessingStep.status = "error";
        currentProcessingStep.message = "Processing failed";
        setProcessingSteps([...steps]);
      }
    }
  }, [uploadedFiles, processingSteps]);

  // Transaction management
  const toggleTransactionSelection = useCallback(
    (transactionId: string) => {
      const newSelected = new Set(selectedTransactions);
      if (newSelected.has(transactionId)) {
        newSelected.delete(transactionId);
      } else {
        newSelected.add(transactionId);
      }
      setSelectedTransactions(newSelected);

      // Update transaction selected state
      setReviewTransactions((prev) =>
        prev.map((tx) =>
          tx.id === transactionId ? { ...tx, selected: newSelected.has(transactionId) } : tx
        )
      );
    },
    [selectedTransactions]
  );

  const updateTransaction = useCallback(
    (transactionId: string, updates: Partial<ExtractedTransaction>) => {
      setReviewTransactions((prev) =>
        prev.map((tx) => (tx.id === transactionId ? { ...tx, ...updates, edited: true } : tx))
      );
    },
    []
  );

  const deleteTransaction = useCallback((transactionId: string) => {
    setReviewTransactions((prev) => prev.filter((tx) => tx.id !== transactionId));
    setSelectedTransactions((prev) => {
      const newSet = new Set(prev);
      newSet.delete(transactionId);
      return newSet;
    });
  }, []);

  // Filtering and sorting
  const filteredTransactions = React.useMemo(() => {
    let filtered = reviewTransactions;

    // Apply category filter
    if (filterCategory !== "all") {
      filtered = filtered.filter((tx) => tx.category === filterCategory);
    }

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (tx) =>
          tx.description.toLowerCase().includes(term) ||
          tx.merchant?.toLowerCase().includes(term) ||
          tx.category.toLowerCase().includes(term)
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aVal: any,
        bVal: any;

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
        case "confidence":
          aVal = a.confidence;
          bVal = b.confidence;
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return sortOrder === "asc" ? -1 : 1;
      if (aVal > bVal) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [reviewTransactions, filterCategory, searchTerm, sortBy, sortOrder]);

  // Complete import
  const completeImport = useCallback(() => {
    const selectedTxns = reviewTransactions.filter((tx) => tx.selected);
    const accountInfo = extractedData?.accountInfo;

    onImportComplete(selectedTxns, accountInfo);
    setCurrentStep("complete");
  }, [reviewTransactions, extractedData, onImportComplete]);

  // Get file icon
  const getFileIcon = (file: File) => {
    if (file.type.startsWith("image/")) return <Image className="w-8 h-8 text-blue-500" />;
    if (file.type === "application/pdf") return <FileText className="w-8 h-8 text-red-500" />;
    if (file.type.includes("spreadsheet") || file.name.endsWith(".csv"))
      return <FileSpreadsheet className="w-8 h-8 text-green-500" />;
    return <FileIcon className="w-8 h-8 text-gray-500" />;
  };

  // Get confidence color
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return "text-green-600 bg-green-100";
    if (confidence >= 0.6) return "text-yellow-600 bg-yellow-100";
    return "text-red-600 bg-red-100";
  };

  // Render upload step
  const renderUploadStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <Upload className="w-16 h-16 text-blue-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Import Financial Documents</h2>
        <p className="text-gray-600 mb-6">
          Upload bank statements, credit card statements, receipts, or other financial documents
        </p>
      </div>

      {/* Drag and drop zone */}
      <div
        ref={dropZoneRef}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200
          ${isDragOver ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"}
        `}
      >
        <div className="space-y-4">
          <div className="flex justify-center space-x-4">
            <FileText className="w-12 h-12 text-gray-400" />
            <Image className="w-12 h-12 text-gray-400" />
            <FileSpreadsheet className="w-12 h-12 text-gray-400" />
          </div>

          <div>
            <p className="text-lg font-medium text-gray-900">Drag and drop your documents here</p>
            <p className="text-gray-500">or</p>
            <label
              htmlFor={fileInputId}
              className="mt-2 inline-flex cursor-pointer select-none px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:scale-[0.99] transition-[background-color,transform]"
            >
              Browse Files
            </label>
          </div>

          <div className="text-sm text-gray-500">
            <p>Supported formats: PDF, JPG, PNG, CSV, Excel</p>
            <p>Maximum file size: 10MB</p>
          </div>
        </div>
      </div>

      <input
        ref={fileInputRef}
        id={fileInputId}
        type="file"
        multiple
        accept=".pdf,.jpg,.jpeg,.png,.csv,.xlsx,.xls,.txt"
        onChange={(e) => handleFileSelect(e.target.files)}
        className="sr-only"
      />

      {/* Uploaded files */}
      {uploadedFiles.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Uploaded Files</h3>
          <div className="space-y-2">
            {uploadedFiles.map((file, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  {getFileIcon(file)}
                  <div>
                    <p className="font-medium text-gray-900">{file.name}</p>
                    <p className="text-sm text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                </div>
                <button
                  onClick={() => setUploadedFiles((prev) => prev.filter((_, i) => i !== index))}
                  className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex justify-end space-x-3">
            <button
              onClick={() => setUploadedFiles([])}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Clear All
            </button>
            <button
              onClick={processDocuments}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
            >
              <Zap className="w-4 h-4" />
              <span>Process Documents</span>
            </button>
          </div>
        </div>
      )}

      {/* Supported document types */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
        <div className="p-4 border border-gray-200 rounded-lg">
          <div className="flex items-center space-x-3 mb-2">
            <Banknote className="w-6 h-6 text-green-600" />
            <h4 className="font-semibold text-gray-900">Bank Statements</h4>
          </div>
          <p className="text-sm text-gray-600">
            Checking, savings, and business account statements from major banks
          </p>
        </div>

        <div className="p-4 border border-gray-200 rounded-lg">
          <div className="flex items-center space-x-3 mb-2">
            <CreditCard className="w-6 h-6 text-blue-600" />
            <h4 className="font-semibold text-gray-900">Credit Card Statements</h4>
          </div>
          <p className="text-sm text-gray-600">
            Monthly statements from Visa, MasterCard, Amex, and other cards
          </p>
        </div>

        <div className="p-4 border border-gray-200 rounded-lg">
          <div className="flex items-center space-x-3 mb-2">
            <Receipt className="w-6 h-6 text-purple-600" />
            <h4 className="font-semibold text-gray-900">Receipts & Invoices</h4>
          </div>
          <p className="text-sm text-gray-600">
            Business receipts, invoices, and transaction records
          </p>
        </div>
      </div>
    </div>
  );

  // Render processing step
  const renderProcessingStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <Brain className="w-16 h-16 text-blue-500 mx-auto mb-4 animate-pulse" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Processing Document</h2>
        <p className="text-gray-600">
          Using AI-powered extraction to analyze your financial document
        </p>
      </div>

      <div className="space-y-4">
        {processingSteps.map((step) => (
          <div key={step.id} className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
            <div className="flex-shrink-0">
              {step.status === "completed" && <CheckCircle className="w-6 h-6 text-green-500" />}
              {step.status === "processing" && (
                <RefreshCw className="w-6 h-6 text-blue-500 animate-spin" />
              )}
              {step.status === "error" && <AlertCircle className="w-6 h-6 text-red-500" />}
              {step.status === "pending" && (
                <div className="w-6 h-6 rounded-full border-2 border-gray-300" />
              )}
            </div>

            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <h4 className="font-medium text-gray-900">{step.name}</h4>
                {step.duration && (
                  <span className="text-sm text-gray-500">{(step.duration / 1000).toFixed(1)}s</span>
                )}
              </div>

              <p className="text-sm text-gray-600 mb-2">{step.message}</p>

              {step.status === "processing" && (
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${step.progress}%` }}
                  />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {importResult && !importResult.success && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center space-x-2 mb-2">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <h4 className="font-medium text-red-900">Processing Failed</h4>
          </div>
          <div className="space-y-1">
            {importResult.errors.map((error, index) => (
              <p key={index} className="text-sm text-red-700">
                {error}
              </p>
            ))}
          </div>
          <button
            onClick={() => setCurrentStep("upload")}
            className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );

  // Render review step (kept from OLDSITE; long but functional)
  const renderReviewStep = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Review Extracted Data</h2>
          <p className="text-gray-600">Review and edit the extracted transactions before importing</p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setPreviewMode(previewMode === "table" ? "cards" : "table")}
            className="p-2 text-gray-600 hover:text-gray-900 transition-colors"
            title="Toggle view mode"
          >
            {previewMode === "table" ? <Eye className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
          </button>

          <button
            onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
            className="p-2 text-gray-600 hover:text-gray-900 transition-colors"
            title="Advanced options"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Account Information */}
      {extractedData?.accountInfo && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center space-x-2 mb-3">
            <Building className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold text-blue-900">Account Information</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="font-medium text-blue-900">Bank:</span>
              <p className="text-blue-700">{extractedData.accountInfo.bankName}</p>
            </div>
            <div>
              <span className="font-medium text-blue-900">Account:</span>
              <p className="text-blue-700">{extractedData.accountInfo.accountNumber}</p>
            </div>
            <div>
              <span className="font-medium text-blue-900">Type:</span>
              <p className="text-blue-700 capitalize">{extractedData.accountInfo.accountType}</p>
            </div>
          </div>
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center space-x-2">
            <TrendingUp className="w-5 h-5 text-green-600" />
            <span className="font-medium text-green-900">Total Transactions</span>
          </div>
          <p className="text-2xl font-bold text-green-700 mt-1">{reviewTransactions.length}</p>
        </div>

        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center space-x-2">
            <Target className="w-5 h-5 text-blue-600" />
            <span className="font-medium text-blue-900">Selected</span>
          </div>
          <p className="text-2xl font-bold text-blue-700 mt-1">{selectedTransactions.size}</p>
        </div>

        <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
          <div className="flex items-center space-x-2">
            <DollarSign className="w-5 h-5 text-purple-600" />
            <span className="font-medium text-purple-900">Total Amount</span>
          </div>
          <p className="text-2xl font-bold text-purple-700 mt-1">
            ${reviewTransactions.reduce((sum, tx) => sum + Math.abs(tx.amount), 0).toFixed(2)}
          </p>
        </div>

        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-center space-x-2">
            <Brain className="w-5 h-5 text-yellow-600" />
            <span className="font-medium text-yellow-900">Avg Confidence</span>
          </div>
          <p className="text-2xl font-bold text-yellow-700 mt-1">
            {reviewTransactions.length > 0
              ? Math.round(
                  (reviewTransactions.reduce((sum, tx) => sum + tx.confidence, 0) /
                    reviewTransactions.length) *
                    100
                )
              : 0}
            %
          </p>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-wrap items-center gap-4 p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center space-x-2">
          <Search className="w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search transactions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-3 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-gray-500" />
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Categories</option>
            {Array.from(new Set(reviewTransactions.map((tx) => tx.category))).map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-600">Sort by:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="date">Date</option>
            <option value="amount">Amount</option>
            <option value="description">Description</option>
            <option value="confidence">Confidence</option>
          </select>

          <button
            onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
            className="p-1 text-gray-500 hover:text-gray-700 transition-colors"
          >
            {sortOrder === "asc" ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
          </button>
        </div>

        <div className="flex items-center space-x-2 ml-auto">
          <button
            onClick={() => {
              const allIds = new Set(filteredTransactions.map((tx) => tx.id));
              setSelectedTransactions(allIds);
              setReviewTransactions((prev) =>
                prev.map((tx) => ({
                  ...tx,
                  selected: allIds.has(tx.id),
                }))
              );
            }}
            className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Select All
          </button>

          <button
            onClick={() => {
              setSelectedTransactions(new Set());
              setReviewTransactions((prev) =>
                prev.map((tx) => ({
                  ...tx,
                  selected: false,
                }))
              );
            }}
            className="px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
          >
            Select None
          </button>
        </div>
      </div>

      {/* Transactions Table/Cards */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        {previewMode === "table" ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <input
                      type="checkbox"
                      checked={
                        selectedTransactions.size === filteredTransactions.length &&
                        filteredTransactions.length > 0
                      }
                      onChange={(e) => {
                        if (e.target.checked) {
                          const allIds = new Set(filteredTransactions.map((tx) => tx.id));
                          setSelectedTransactions(allIds);
                        } else {
                          setSelectedTransactions(new Set());
                        }
                      }}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Confidence
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredTransactions.map((transaction) => (
                  <tr key={transaction.id} className={transaction.selected ? "bg-blue-50" : ""}>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={transaction.selected}
                        onChange={() => toggleTransactionSelection(transaction.id)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(transaction.date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-900 max-w-xs truncate">
                      {transaction.description}
                      {transaction.edited && (
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                          Edited
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm">
                      <span className={transaction.type === "debit" ? "text-red-600" : "text-green-600"}>
                        {transaction.type === "debit" ? "-" : "+"}${Math.abs(transaction.amount).toFixed(2)}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      <select
                        value={transaction.suggestedAccountingCategory}
                        onChange={(e) =>
                          updateTransaction(transaction.id, {
                            suggestedAccountingCategory: e.target.value,
                            category: e.target.value,
                          })
                        }
                        className="text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {existingCategories.map((category) => (
                          <option key={category} value={category}>
                            {category}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getConfidenceColor(
                          transaction.confidence
                        )}`}
                      >
                        {Math.round(transaction.confidence * 100)}%
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                      <button
                        onClick={() => {
                          // Future: open edit modal
                        }}
                        className="text-blue-600 hover:text-blue-900 transition-colors"
                        title="Edit transaction"
                      >
                        <Edit3 className="w-4 h-4" />
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
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
            {filteredTransactions.map((transaction) => (
              <div
                key={transaction.id}
                className={`p-4 border rounded-lg transition-all duration-200 ${
                  transaction.selected ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <input
                    type="checkbox"
                    checked={transaction.selected}
                    onChange={() => toggleTransactionSelection(transaction.id)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span
                    className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getConfidenceColor(
                      transaction.confidence
                    )}`}
                  >
                    {Math.round(transaction.confidence * 100)}%
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">
                      {new Date(transaction.date).toLocaleDateString()}
                    </span>
                    <span
                      className={`font-semibold ${
                        transaction.type === "debit" ? "text-red-600" : "text-green-600"
                      }`}
                    >
                      {transaction.type === "debit" ? "-" : "+"}${Math.abs(transaction.amount).toFixed(2)}
                    </span>
                  </div>

                  <p className="text-sm font-medium text-gray-900 line-clamp-2">{transaction.description}</p>

                  <div className="flex items-center justify-between">
                    <select
                      value={transaction.suggestedAccountingCategory}
                      onChange={(e) =>
                        updateTransaction(transaction.id, {
                          suggestedAccountingCategory: e.target.value,
                          category: e.target.value,
                        })
                      }
                      className="text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {existingCategories.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>

                    <div className="flex space-x-1">
                      <button
                        onClick={() => {
                          // Future: open edit modal
                        }}
                        className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                        title="Edit"
                      >
                        <Edit3 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => deleteTransaction(transaction.id)}
                        className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex justify-between items-center">
        <button
          onClick={() => setCurrentStep("upload")}
          className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center space-x-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Upload</span>
        </button>

        <div className="flex items-center space-x-3">
          <span className="text-sm text-gray-600">
            {selectedTransactions.size} of {reviewTransactions.length} transactions selected
          </span>

          <button
            onClick={completeImport}
            disabled={selectedTransactions.size === 0}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
          >
            <Check className="w-4 h-4" />
            <span>Import Selected ({selectedTransactions.size})</span>
          </button>
        </div>
      </div>
    </div>
  );

  // Render complete step
  const renderCompleteStep = () => (
    <div className="text-center space-y-6">
      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
        <CheckCircle className="w-10 h-10 text-green-600" />
      </div>

      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Import Complete!</h2>
        <p className="text-gray-600">
          Successfully imported {selectedTransactions.size} transactions to your accounting system
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-md mx-auto">
        <div className="text-center">
          <div className="text-2xl font-bold text-green-600">{selectedTransactions.size}</div>
          <div className="text-sm text-gray-500">Transactions</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600">
            {importResult ? Math.round(importResult.confidence * 100) : 0}%
          </div>
          <div className="text-sm text-gray-500">Confidence</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-purple-600">
            {importResult ? (importResult.processingTime / 1000).toFixed(1) : 0}s
          </div>
          <div className="text-sm text-gray-500">Processing Time</div>
        </div>
      </div>

      <button
        onClick={onClose}
        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
      >
        Close
      </button>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Upload className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Document Import</h1>
              <p className="text-sm text-gray-500">
                Step {currentStep === "upload" ? 1 : currentStep === "processing" ? 2 : currentStep === "review" ? 3 : 4} of 4
              </p>
            </div>
          </div>

          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="px-6 py-2 bg-gray-50">
          <div className="flex items-center space-x-4">
            {["upload", "processing", "review", "complete"].map((step, index) => (
              <div key={step} className="flex items-center">
                <div
                  className={`
                  w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                  ${currentStep === step
                    ? "bg-blue-600 text-white"
                    : index < ["upload", "processing", "review", "complete"].indexOf(currentStep)
                      ? "bg-green-600 text-white"
                      : "bg-gray-300 text-gray-600"
                  }
                `}
                >
                  {index < ["upload", "processing", "review", "complete"].indexOf(currentStep) ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    index + 1
                  )}
                </div>
                {index < 3 && (
                  <div
                    className={`
                    w-12 h-1 mx-2
                    ${index < ["upload", "processing", "review", "complete"].indexOf(currentStep)
                      ? "bg-green-600"
                      : "bg-gray-300"
                    }
                  `}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {currentStep === "upload" && renderUploadStep()}
          {currentStep === "processing" && renderProcessingStep()}
          {currentStep === "review" && renderReviewStep()}
          {currentStep === "complete" && renderCompleteStep()}
        </div>
      </div>
    </div>
  );
};

export default DocumentImportInterface;


