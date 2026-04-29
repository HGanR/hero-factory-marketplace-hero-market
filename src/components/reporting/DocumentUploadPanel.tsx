"use client";

import React, { useId, useState } from "react";
import { Upload, File, AlertCircle, CheckCircle, Loader2, X, Eye } from "lucide-react";
import { toast } from "sonner";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const DOCUMENT_TYPES = [
  { value: "RECEIPT", label: "Receipt" },
  { value: "INVOICE", label: "Invoice" },
  { value: "CERTIFICATE", label: "Certificate" },
  { value: "COUPON", label: "Coupon" },
  { value: "FINANCIAL_STATEMENT", label: "Financial Statement" },
  { value: "BANK_STATEMENT", label: "Bank Statement" },
  { value: "TRANSFER_CONFIRMATION", label: "Transfer Confirmation" },
  { value: "IOU_DOCUMENT", label: "IOU Document" },
  { value: "LOAN_AGREEMENT", label: "Loan Agreement" },
  { value: "PROMISSORY_NOTE", label: "Promissory Note" },
  { value: "DEED", label: "Deed" },
  { value: "CLOSING_STATEMENT", label: "Closing Statement" },
  { value: "DIVIDEND_STATEMENT", label: "Dividend Statement" },
  { value: "INTEREST_STATEMENT", label: "Interest Statement" },
  { value: "OTHER", label: "Other" },
] as const;

const DOCUMENT_CLASSIFICATIONS = [
  { value: "INCOME", label: "Income" },
  { value: "EXPENSE", label: "Expense" },
  { value: "CAPITAL_ASSET", label: "Capital Asset" },
  { value: "LIABILITY", label: "Liability" },
  { value: "EQUITY", label: "Equity" },
  { value: "SUPPORTING", label: "Supporting Document" },
] as const;

interface UploadedDocument {
  id: string;
  fileName: string;
  documentType: string;
  classification: string;
  amount?: number;
  uploadDate: Date;
  verificationStatus: string;
}

export default function DocumentUploadPanel() {
  const fileInputId = useId();
  const [entityId, setEntityId] = useState<string>("");
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [documentType, setDocumentType] = useState<string>("");
  const [classification, setClassification] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [counterpartyName, setCounterpartyName] = useState<string>("");
  const [counterpartyTaxId, setCounterpartyTaxId] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [tags, setTags] = useState<string>("");

  const fetchDocuments = async () => {
    try {
      // Placeholder: wire to backend/tRPC later
      console.log("Fetching documents for entity:", entityId);
      toast.message("Loaded documents (demo)");
    } catch {
      toast.error("Failed to fetch documents");
    }
  };

  const handleFileSelect = (files: FileList | null) => {
    if (!files) return;
    const newFiles = Array.from(files);
    const validFiles = newFiles.filter((file) => {
      const maxSize = 50 * 1024 * 1024; // 50MB
      if (file.size > maxSize) {
        toast.error(`${file.name} exceeds 50MB limit`);
        return false;
      }
      return true;
    });
    setSelectedFiles((prev) => [...prev, ...validFiles]);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (!entityId) return toast.error("Please select an entity");
    if (selectedFiles.length === 0) return toast.error("Please select at least one file");
    if (!documentType) return toast.error("Please select a document type");
    if (!classification) return toast.error("Please select a classification");

    setIsLoading(true);
    try {
      // Demo only: store in memory
      const now = new Date();
      const newDocs: UploadedDocument[] = selectedFiles.map((f, idx) => ({
        id: `${Date.now()}_${idx}`,
        fileName: f.name,
        documentType,
        classification,
        amount: amount ? Number(amount) : undefined,
        uploadDate: now,
        verificationStatus: "PENDING",
      }));
      setDocuments((prev) => [...newDocs, ...prev]);
      toast.success(`${selectedFiles.length} document(s) uploaded (demo)`);

      setSelectedFiles([]);
      setDocumentType("");
      setClassification("");
      setAmount("");
      setCounterpartyName("");
      setCounterpartyTaxId("");
      setDescription("");
      setTags("");
      await fetchDocuments();
    } catch (e) {
      console.error(e);
      toast.error("Upload failed");
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "VERIFIED":
        return "bg-green-100 text-green-800";
      case "PENDING":
        return "bg-yellow-100 text-yellow-800";
      case "FLAGGED":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "VERIFIED":
        return <CheckCircle className="h-4 w-4" />;
      case "PENDING":
      case "FLAGGED":
        return <AlertCircle className="h-4 w-4" />;
      default:
        return <File className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-slate-800 bg-slate-950">
        <CardHeader>
          <CardTitle>Document Upload</CardTitle>
          <p className="text-sm text-slate-300">Upload tax/compliance documents and link them to an entity.</p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <Input placeholder="Enter Entity ID" value={entityId} onChange={(e) => setEntityId(e.target.value)} />
            <Button onClick={fetchDocuments} disabled={!entityId}>
              Load Documents
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="upload" className="space-y-4">
        <TabsList>
          <TabsTrigger value="upload">Upload</TabsTrigger>
          <TabsTrigger value="documents">Uploaded ({documents.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="upload">
          <Card className="border-slate-800 bg-slate-950">
            <CardHeader>
              <CardTitle>Upload New Documents</CardTitle>
              <p className="text-sm text-slate-300">Drag and drop or click to select documents.</p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`rounded-lg border-2 border-dashed p-10 text-center transition-colors ${
                  isDragging ? "border-cyan-500 bg-slate-900/60" : "border-slate-700 bg-slate-900/40 hover:border-slate-600"
                }`}
              >
                <Upload className="mx-auto mb-3 h-10 w-10 text-slate-400" />
                <p className="text-lg font-medium text-slate-100">Drag and drop files here</p>
                <p className="mt-1 text-sm text-slate-400">or</p>
                <div className="mt-4">
                  <label
                    htmlFor={fileInputId}
                    className={cn(buttonVariants({ variant: "outline" }), "cursor-pointer select-none")}
                  >
                    Select Files
                  </label>
                  <input
                    id={fileInputId}
                    type="file"
                    multiple
                    onChange={(e) => handleFileSelect(e.target.files)}
                    className="sr-only"
                    accept=".pdf,.jpg,.jpeg,.png,.gif,.doc,.docx,.xls,.xlsx"
                  />
                </div>
                <p className="mt-3 text-xs text-slate-500">
                  Supported: PDF, JPG, PNG, GIF, DOC, DOCX, XLS, XLSX (Max 50MB)
                </p>
              </div>

              {selectedFiles.length > 0 && (
                <div className="space-y-2">
                  <div className="text-sm font-semibold">Selected Files</div>
                  <div className="space-y-2">
                    {selectedFiles.map((file, index) => (
                      <div key={index} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/40 p-3">
                        <div className="flex items-center gap-3">
                          <File className="h-5 w-5 text-slate-400" />
                          <div>
                            <p className="font-medium text-slate-100">{file.name}</p>
                            <p className="text-sm text-slate-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => removeFile(index)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Document Type *</Label>
                  <Select value={documentType} onValueChange={setDocumentType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {DOCUMENT_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Classification *</Label>
                  <Select value={classification} onValueChange={setClassification}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select classification" />
                    </SelectTrigger>
                    <SelectContent>
                      {DOCUMENT_CLASSIFICATIONS.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Amount (Optional)</Label>
                  <Input type="number" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} step="0.01" />
                </div>
                <div className="space-y-2">
                  <Label>Counterparty Name (Optional)</Label>
                  <Input value={counterpartyName} onChange={(e) => setCounterpartyName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Counterparty Tax ID (Optional)</Label>
                  <Input value={counterpartyTaxId} onChange={(e) => setCounterpartyTaxId(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Tags (Optional)</Label>
                  <Input placeholder="Comma-separated tags" value={tags} onChange={(e) => setTags(e.target.value)} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Description (Optional)</Label>
                <textarea
                  placeholder="Additional details"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950/40 p-3 text-sm text-slate-50 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  rows={4}
                />
              </div>

              <Button
                onClick={handleUpload}
                disabled={isLoading || selectedFiles.length === 0 || !documentType || !classification}
                className="w-full"
                size="lg"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload {selectedFiles.length} Document{selectedFiles.length !== 1 ? "s" : ""}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          <Card className="border-slate-800 bg-slate-950">
            <CardHeader>
              <CardTitle>Uploaded Documents</CardTitle>
              <p className="text-sm text-slate-300">Manage and review documents (demo list).</p>
            </CardHeader>
            <CardContent>
              {documents.length === 0 ? (
                <div className="py-10 text-center text-slate-300">No documents uploaded yet</div>
              ) : (
                <div className="space-y-3">
                  {documents.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between rounded-lg border border-slate-800 p-4 hover:bg-slate-900/40">
                      <div className="flex items-center gap-3">
                        <File className="h-5 w-5 text-slate-400" />
                        <div>
                          <div className="font-medium text-slate-100">{doc.fileName}</div>
                          <div className="mt-1 flex flex-wrap gap-2 text-xs">
                            <span className="rounded bg-slate-800 px-2 py-1 text-slate-200">{doc.documentType}</span>
                            <span className="rounded bg-cyan-900/40 px-2 py-1 text-cyan-200">{doc.classification}</span>
                            {doc.amount ? (
                              <span className="rounded bg-green-900/40 px-2 py-1 text-green-200">${doc.amount.toFixed(2)}</span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className={`flex items-center gap-1 rounded px-2 py-1 text-xs font-medium ${getStatusColor(doc.verificationStatus)}`}>
                          {getStatusIcon(doc.verificationStatus)}
                          {doc.verificationStatus}
                        </div>
                        <Button variant="outline" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}


