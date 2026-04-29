"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle, Filter, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const TRANSACTION_TYPES = [
  { value: "INCOME", label: "Income" },
  { value: "EXPENSE", label: "Expense" },
  { value: "CAPITAL_GAIN", label: "Capital Gain" },
  { value: "CAPITAL_LOSS", label: "Capital Loss" },
  { value: "DIVIDEND", label: "Dividend" },
  { value: "INTEREST", label: "Interest" },
  { value: "RENTAL_INCOME", label: "Rental Income" },
  { value: "BUSINESS_INCOME", label: "Business Income" },
  { value: "TRANSFER", label: "Transfer" },
  { value: "LOAN", label: "Loan" },
] as const;

const IRS_FORMS = [
  { value: "1099-NEC", label: "Form 1099-NEC (Non-Employee Compensation)", category: "1099" },
  { value: "1099-DIV", label: "Form 1099-DIV (Dividends)", category: "1099" },
  { value: "1099-INT", label: "Form 1099-INT (Interest)", category: "1099" },
  { value: "1099-B", label: "Form 1099-B (Broker Transactions)", category: "1099" },
  { value: "1099-S", label: "Form 1099-S (Proceeds from Real Estate)", category: "1099" },
  { value: "1099-OID", label: "Form 1099-OID (Original Issue Discount)", category: "1099" },
  { value: "1099-A", label: "Form 1099-A (Abandoned Property)", category: "1099" },
  { value: "1099-C", label: "Form 1099-C (Cancelled Debt)", category: "1099" },
  { value: "1099-K", label: "Form 1099-K (Payment Card Transactions)", category: "1099" },
  { value: "Schedule D", label: "Schedule D (Capital Gains/Losses)", category: "Schedule" },
  { value: "Schedule E", label: "Schedule E (Rental Income)", category: "Schedule" },
  { value: "Schedule C", label: "Schedule C (Business Income)", category: "Schedule" },
  { value: "1041", label: "Form 1041 (Trust/Estate Income)", category: "Form" },
  { value: "1041-ES", label: "Form 1041-ES (Estimated Tax)", category: "Form" },
  { value: "1040-ES", label: "Form 1040-ES (Estimated Tax)", category: "Form" },
] as const;

const ENTITY_TYPES = [
  { value: "INDIVIDUAL", label: "Individual" },
  { value: "PARTNERSHIP", label: "Partnership" },
  { value: "S_CORP", label: "S-Corporation" },
  { value: "C_CORP", label: "C-Corporation" },
  { value: "LLC", label: "LLC" },
  { value: "TRUST", label: "Trust" },
  { value: "ESTATE", label: "Estate" },
] as const;

interface TaggedTransaction {
  id: string;
  date: Date;
  type: string;
  amount: number;
  description: string;
  formTypes: string[];
  counterpartyName: string;
  gain?: number;
  loss?: number;
  isReconciled: boolean;
}

export default function TransactionTaggingPanel() {
  const [entityId, setEntityId] = useState<string>("");
  const [transactions, setTransactions] = useState<TaggedTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [filterType, setFilterType] = useState<string>("ALL");

  const [date, setDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [transactionType, setTransactionType] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [incomeOrExpense, setIncomeOrExpense] = useState<string>("INCOME");
  const [selectedForms, setSelectedForms] = useState<string[]>([]);
  const [counterpartyName, setCounterpartyName] = useState<string>("");
  const [counterpartyTaxId, setCounterpartyTaxId] = useState<string>("");
  const [counterpartyType, setCounterpartyType] = useState<string>("");
  const [costBasis, setCostBasis] = useState<string>("");
  const [proceeds, setProceeds] = useState<string>("");

  useEffect(() => {
    if (entityId) fetchTransactions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityId]);

  const fetchTransactions = async () => {
    try {
      // Placeholder: wire to backend later
      console.log("Fetching transactions for entity:", entityId);
      toast.message("Loaded transactions (demo)");
    } catch {
      toast.error("Failed to fetch transactions");
    }
  };

  const toggleForm = (formValue: string) => {
    setSelectedForms((prev) => (prev.includes(formValue) ? prev.filter((f) => f !== formValue) : [...prev, formValue]));
  };

  const handleCreateTransaction = async () => {
    if (!entityId) return toast.error("Please select an entity");
    if (!date || !transactionType || !amount || !description || selectedForms.length === 0 || !counterpartyName || !counterpartyType) {
      return toast.error("Please fill in all required fields");
    }

    setIsLoading(true);
    try {
      const tx: TaggedTransaction = {
        id: `${Date.now()}`,
        date: new Date(date),
        type: transactionType,
        amount: parseFloat(amount),
        description,
        formTypes: selectedForms,
        counterpartyName,
        gain: costBasis && proceeds ? Math.max(0, parseFloat(proceeds) - parseFloat(costBasis)) : undefined,
        loss: costBasis && proceeds ? Math.max(0, parseFloat(costBasis) - parseFloat(proceeds)) : undefined,
        isReconciled: false,
      };
      setTransactions((prev) => [tx, ...prev]);
      toast.success("Transaction created (demo)");

      setDate(new Date().toISOString().split("T")[0]);
      setTransactionType("");
      setAmount("");
      setDescription("");
      setSelectedForms([]);
      setCounterpartyName("");
      setCounterpartyTaxId("");
      setCounterpartyType("");
      setCostBasis("");
      setProceeds("");
      setIsDialogOpen(false);
      await fetchTransactions();
    } catch (e) {
      console.error(e);
      toast.error("Failed to create transaction");
    } finally {
      setIsLoading(false);
    }
  };

  const getFormCategoryColor = (category: string) => {
    switch (category) {
      case "1099":
        return "bg-blue-100 text-blue-800";
      case "Schedule":
        return "bg-purple-100 text-purple-800";
      case "Form":
        return "bg-orange-100 text-orange-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getTransactionTypeColor = (type: string) => {
    if (type.includes("GAIN")) return "bg-green-100 text-green-800";
    if (type.includes("LOSS")) return "bg-red-100 text-red-800";
    if (type.includes("INCOME")) return "bg-blue-100 text-blue-800";
    if (type.includes("EXPENSE")) return "bg-orange-100 text-orange-800";
    return "bg-gray-100 text-gray-800";
  };

  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      if (filterType === "ALL") return true;
      if (filterType === "INCOME") return tx.formTypes.some((f) => f.includes("1099"));
      if (filterType === "CAPITAL") return !!(tx.gain || tx.loss);
      if (filterType === "UNRECONCILED") return !tx.isReconciled;
      return true;
    });
  }, [transactions, filterType]);

  return (
    <div className="space-y-6">
      <Card className="border-slate-800 bg-slate-950">
        <CardHeader>
          <CardTitle>Transaction Tagging</CardTitle>
          <p className="text-sm text-slate-300">Tag transactions with IRS forms for compliance tracking.</p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <Input placeholder="Enter Entity ID" value={entityId} onChange={(e) => setEntityId(e.target.value)} />
            <Button onClick={fetchTransactions} disabled={!entityId}>
              Load Transactions
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="transactions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="transactions">Transactions ({filteredTransactions.length})</TabsTrigger>
          <TabsTrigger value="summary">Summary</TabsTrigger>
        </TabsList>

        <TabsContent value="transactions" className="space-y-4">
          <Card className="border-slate-800 bg-slate-950">
            <CardContent className="pt-6">
              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-slate-600" />
                  <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger className="w-56">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Transactions</SelectItem>
                      <SelectItem value="INCOME">Income Transactions</SelectItem>
                      <SelectItem value="CAPITAL">Capital Gains/Losses</SelectItem>
                      <SelectItem value="UNRECONCILED">Unreconciled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex-1" />

                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      New Transaction
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Create New Transaction</DialogTitle>
                      <DialogDescription>Tag a transaction with IRS forms for compliance tracking.</DialogDescription>
                    </DialogHeader>

                    <div className="space-y-6">
                      <div>
                        <h3 className="mb-4 font-semibold text-slate-100">Basic Information</h3>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label>Date *</Label>
                            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                          </div>
                          <div className="space-y-2">
                            <Label>Transaction Type *</Label>
                            <Select value={transactionType} onValueChange={setTransactionType}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select type" />
                              </SelectTrigger>
                              <SelectContent>
                                {TRANSACTION_TYPES.map((t) => (
                                  <SelectItem key={t.value} value={t.value}>
                                    {t.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Amount *</Label>
                            <Input type="number" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} step="0.01" />
                          </div>
                          <div className="space-y-2">
                            <Label>Classification *</Label>
                            <Select value={incomeOrExpense} onValueChange={setIncomeOrExpense}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="INCOME">Income</SelectItem>
                                <SelectItem value="EXPENSE">Expense</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="mt-4 space-y-2">
                          <Label>Description *</Label>
                          <textarea
                            placeholder="Describe this transaction"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="w-full rounded-lg border border-slate-800 bg-slate-950/40 p-3 text-sm text-slate-50 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                            rows={3}
                          />
                        </div>
                      </div>

                      <div>
                        <h3 className="mb-4 font-semibold text-slate-100">Counterparty</h3>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label>Name *</Label>
                            <Input value={counterpartyName} onChange={(e) => setCounterpartyName(e.target.value)} />
                          </div>
                          <div className="space-y-2">
                            <Label>Tax ID</Label>
                            <Input value={counterpartyTaxId} onChange={(e) => setCounterpartyTaxId(e.target.value)} />
                          </div>
                          <div className="space-y-2 md:col-span-2">
                            <Label>Entity Type *</Label>
                            <Select value={counterpartyType} onValueChange={setCounterpartyType}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select type" />
                              </SelectTrigger>
                              <SelectContent>
                                {ENTITY_TYPES.map((t) => (
                                  <SelectItem key={t.value} value={t.value}>
                                    {t.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>

                      {(transactionType.includes("CAPITAL") || transactionType === "INVESTMENT") && (
                        <div>
                          <h3 className="mb-4 font-semibold text-slate-100">Capital Gains/Losses</h3>
                          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                              <Label>Cost Basis</Label>
                              <Input type="number" value={costBasis} onChange={(e) => setCostBasis(e.target.value)} step="0.01" />
                            </div>
                            <div className="space-y-2">
                              <Label>Proceeds</Label>
                              <Input type="number" value={proceeds} onChange={(e) => setProceeds(e.target.value)} step="0.01" />
                            </div>
                          </div>
                        </div>
                      )}

                      <div>
                        <h3 className="mb-4 font-semibold text-slate-100">IRS Forms *</h3>
                        <div className="max-h-48 space-y-2 overflow-auto rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                          {IRS_FORMS.map((form) => (
                            <label key={form.value} className="flex cursor-pointer items-start gap-3 rounded-md p-2 hover:bg-slate-900/40">
                              <input
                                type="checkbox"
                                checked={selectedForms.includes(form.value)}
                                onChange={() => toggleForm(form.value)}
                                className="mt-1 h-4 w-4"
                              />
                              <div className="flex-1">
                                <div className="text-sm text-slate-100">{form.label}</div>
                                <div className={`mt-1 inline-flex rounded px-2 py-0.5 text-xs ${getFormCategoryColor(form.category)}`}>
                                  {form.category}
                                </div>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className="flex gap-3 pt-2">
                        <Button onClick={handleCreateTransaction} disabled={isLoading} className="flex-1">
                          {isLoading ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Creating...
                            </>
                          ) : (
                            "Create Transaction"
                          )}
                        </Button>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-800 bg-slate-950">
            <CardHeader>
              <CardTitle>Tagged Transactions</CardTitle>
              <p className="text-sm text-slate-300">
                {filteredTransactions.length} transaction{filteredTransactions.length !== 1 ? "s" : ""}
              </p>
            </CardHeader>
            <CardContent>
              {filteredTransactions.length === 0 ? (
                <div className="py-10 text-center">
                  <AlertCircle className="mx-auto mb-3 h-10 w-10 text-slate-300" />
                  <p className="text-slate-300">No transactions found</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredTransactions.map((tx) => (
                    <div key={tx.id} className="flex items-start justify-between gap-4 rounded-lg border border-slate-800 p-4 hover:bg-slate-900/40">
                      <div className="flex-1">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <span className={`rounded px-2 py-1 text-xs font-medium ${getTransactionTypeColor(tx.type)}`}>{tx.type}</span>
                          {tx.isReconciled ? <CheckCircle className="h-4 w-4 text-green-600" /> : null}
                        </div>
                        <div className="font-medium text-slate-100">{tx.description}</div>
                        <div className="mt-1 text-sm text-slate-300">
                          {tx.counterpartyName} • {new Date(tx.date).toLocaleDateString()}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {tx.formTypes.map((f) => (
                            <span key={f} className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-200">
                              {f}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-semibold text-slate-100">${tx.amount.toFixed(2)}</div>
                        {tx.gain ? <div className="text-sm text-green-600">Gain: ${tx.gain.toFixed(2)}</div> : null}
                        {tx.loss ? <div className="text-sm text-red-600">Loss: ${tx.loss.toFixed(2)}</div> : null}
                        <div className="mt-2 flex justify-end gap-2">
                          <Button variant="outline" size="sm">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="summary">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Total Transactions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-slate-900">{transactions.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Total Amount</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-slate-900">
                  ${transactions.reduce((sum, tx) => sum + tx.amount, 0).toFixed(2)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Reconciliation Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-slate-900">
                  {transactions.length > 0
                    ? Math.round((transactions.filter((tx) => tx.isReconciled).length / transactions.length) * 100)
                    : 0}
                  %
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}


