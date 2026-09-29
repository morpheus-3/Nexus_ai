"use client";
import React, { useState, useEffect, useCallback } from "react";
import { TopBar } from "@/components/layout/TopBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { formatCurrency, formatDate, getRiskColor, getRiskLabel, getStatusColor, cn } from "@/lib/utils";
import { ShieldAlert, AlertTriangle, CheckCircle, XCircle, Eye, Lock, TrendingUp, User, RefreshCw } from "lucide-react";
import { AgentRunButton } from "@/components/agents/AgentRunButton";

interface Invoice {
  id: number;
  invoiceNumber: string;
  vendorName: string;
  amount: number;
  riskScore: number;
  riskFactors: string[];
  paymentStatus: string;
  reviewStatus: string;
  isDuplicate: boolean | null;
  duplicateOf: string | null;
  invoiceDate: string;
}

interface FraudCase {
  id: number;
  caseNumber: string;
  caseType: string;
  severity: string;
  riskScore: number;
  evidence: Array<{ type: string; detail: string; [key: string]: unknown }>;
  status: string;
}

interface Vendor {
  id: number;
  vendorNumber: string;
  name: string;
  country: string | null;
  riskScore: number;
  onWatchlist: boolean | null;
}

const caseTypeLabels: Record<string, string> = {
  duplicate_invoice: "Duplicate Invoice",
  bank_mismatch: "Bank Account Mismatch",
  price_anomaly: "Price Anomaly",
  vendor_anomaly: "Vendor Anomaly",
};

export default function FraudPage() {
  const [data, setData] = useState<{ invoices: Invoice[]; vendors: Vendor[]; cases: FraudCase[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [reviewAction, setReviewAction] = useState<string>("");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionNotes, setActionNotes] = useState("");
  const [actionMessage, setActionMessage] = useState("");

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/fraud");
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || `Unable to load fraud data (HTTP ${res.status})`);
      if (!Array.isArray(d.invoices) || !Array.isArray(d.vendors) || !Array.isArray(d.cases)) throw new Error("The server returned an invalid fraud data response.");
      setData(d);
      setLoadError(null);
    } catch (cause) {
      setLoadError(cause instanceof Error ? cause.message : "Unable to load fraud data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const handleInvoiceAction = async (invoiceId: number, action: string) => {
    setActionLoading(true);
    setActionMessage("");
    try {
      const response = await fetch("/api/fraud", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId, action, notes: actionNotes }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `Invoice action failed (HTTP ${response.status})`);
      setActionMessage(result.approvalRequired
        ? `Payment block request ${result.approvalId} is awaiting human approval. Payment remains ${result.paymentStatus}.`
        : `Invoice status updated to ${result.paymentStatus}.`);
      setSelectedInvoice(null);
      setActionNotes("");
      await load();
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : "Invoice action failed. Retry or contact an administrator.");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div>
        <TopBar title="Fraud & Compliance" />
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="h-24 rounded-xl shimmer-bg" />)}
        </div>
      </div>
    );
  }

  if (loadError || !data) {
    return <div><TopBar title="Fraud & Compliance" /><div role="alert" className="m-6 rounded-xl border border-red-500/25 bg-red-500/5 p-5 text-sm text-red-200"><p>{loadError || "Fraud data is unavailable."}</p><Button className="mt-3" variant="outline" size="sm" onClick={() => void load()}>Retry</Button></div></div>;
  }

  const highRisk = data?.invoices.filter(i => i.riskScore >= 60) || [];
  const blocked = data?.invoices.filter(i => i.paymentStatus === "blocked") || [];
  const openCases = data?.cases.filter(c => c.status !== "resolved" && c.status !== "false_positive") || [];
  const watchlistVendors = data?.vendors.filter(v => v.onWatchlist) || [];

  return (
    <div className="animate-fadeIn">
      <TopBar
        title="Fraud & Compliance Intelligence"
        subtitle="Risk indicators for human review; findings do not establish fraud."
        actions={<div className="flex items-center gap-2"><AgentRunButton agent="fraud"/><Button variant="outline" size="sm" onClick={load} disabled={refreshing}>
            <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
            Refresh
          </Button></div>}
      />
      {actionMessage && <p role="status" className="px-6 pt-4 text-sm text-amber-300">{actionMessage}</p>}

      <div className="p-6 space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {[
            { label: "High-Risk Invoices", value: highRisk.length, icon: AlertTriangle, color: "text-red-400", bg: "from-red-500/10" },
            { label: "Payment Blocks", value: blocked.length, icon: Lock, color: "text-orange-400", bg: "from-orange-500/10" },
            { label: "Active Cases", value: openCases.length, icon: ShieldAlert, color: "text-yellow-400", bg: "from-yellow-500/10" },
            { label: "Watchlist Vendors", value: watchlistVendors.length, icon: User, color: "text-red-400", bg: "from-red-500/10" },
          ].map(kpi => {
            const Icon = kpi.icon;
            return (
              <Card key={kpi.label}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${kpi.bg} to-transparent flex items-center justify-center border border-[hsl(222_30%_22%)]`}>
                      <Icon className={`w-4 h-4 ${kpi.color}`} />
                    </div>
                    <div>
                      <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
                      <p className="text-xs text-slate-500">{kpi.label}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Tabs defaultValue="invoices">
          <TabsList>
            <TabsTrigger value="invoices">Invoice Queue ({data?.invoices.length})</TabsTrigger>
            <TabsTrigger value="cases">Fraud Cases ({data?.cases.length})</TabsTrigger>
            <TabsTrigger value="vendors">Vendor Profiles ({data?.vendors.length})</TabsTrigger>
          </TabsList>

          {/* Invoice Queue */}
          <TabsContent value="invoices">
            <Card>
              <CardHeader>
                <CardTitle>Invoice Review Queue</CardTitle>
                <p className="text-xs text-slate-500">Sorted by risk score · Click to review</p>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[hsl(222_30%_18%)]">
                        {["Invoice #", "Vendor", "Amount", "Risk Score", "Risk Factors", "Payment", "Review", "Actions"].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data?.invoices.map(inv => (
                        <tr key={inv.id} className={cn(
                          "border-b border-[hsl(222_30%_14%)] hover:bg-[hsl(222_30%_12%)] transition-colors cursor-pointer",
                          inv.riskScore >= 80 && "bg-red-500/5",
                          inv.isDuplicate && "bg-orange-500/5",
                        )} onClick={() => setSelectedInvoice(inv)}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono text-slate-300">{inv.invoiceNumber}</span>
                              {inv.isDuplicate && <Badge variant="danger" className="text-[10px]">DUPE</Badge>}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-300 max-w-[160px]">
                            <div className="truncate">{inv.vendorName}</div>
                          </td>
                          <td className="px-4 py-3 text-xs font-semibold text-slate-200 whitespace-nowrap">
                            {formatCurrency(inv.amount)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-16">
                                <div className="w-full bg-[hsl(222_30%_18%)] rounded-full h-1.5">
                                  <div
                                    className={cn("h-1.5 rounded-full risk-bar")}
                                    style={{ width: `${inv.riskScore}%` }}
                                  />
                                </div>
                              </div>
                              <span className={cn("text-xs font-bold", getRiskColor(inv.riskScore))}>
                                {Math.round(inv.riskScore)}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 max-w-[200px]">
                            {inv.riskFactors.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {inv.riskFactors.slice(0, 2).map((f, i) => (
                                  <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-[hsl(222_30%_16%)] text-slate-400 truncate max-w-[120px]" title={f}>
                                    {f.replace(/_/g, " ").slice(0, 20)}
                                  </span>
                                ))}
                                {inv.riskFactors.length > 2 && (
                                  <span className="text-[10px] text-slate-500">+{inv.riskFactors.length - 2}</span>
                                )}
                              </div>
                            ) : <span className="text-xs text-slate-500">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            <span className={cn("inline-flex text-[10px] font-medium px-2 py-0.5 rounded-full border", getStatusColor(inv.paymentStatus))}>
                              {inv.paymentStatus}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={cn("inline-flex text-[10px] font-medium px-2 py-0.5 rounded-full border", getStatusColor(inv.reviewStatus))}>
                              {inv.reviewStatus?.replace("_", " ")}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <Button size="icon-sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setSelectedInvoice(inv); }}>
                              <Eye className="w-3.5 h-3.5" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Fraud Cases */}
          <TabsContent value="cases">
            <div className="space-y-3">
              {data?.cases.map(fc => (
                <Card key={fc.id} className={cn(
                  "border",
                  fc.severity === "critical" ? "border-red-500/30 bg-red-500/5 card-glow-danger" :
                  fc.severity === "high" ? "border-orange-500/30 bg-orange-500/5 card-glow-warning" :
                  "border-[hsl(222_30%_18%)]"
                )}>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className="text-sm font-bold text-slate-100">{fc.caseNumber}</span>
                          <Badge variant={fc.severity === "critical" ? "danger" : fc.severity === "high" ? "warning" : "muted"} className="capitalize">
                            {fc.severity}
                          </Badge>
                          <Badge variant="muted" className="text-[10px]">{caseTypeLabels[fc.caseType] || fc.caseType}</Badge>
                          <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full border", getStatusColor(fc.status))}>
                            {fc.status}
                          </span>
                        </div>
                        <div className="space-y-1.5">
                          {fc.evidence.map((e, i) => (
                            <div key={i} className="flex items-start gap-2 text-xs text-slate-400">
                              <span className="text-[hsl(185_84%_55%)] mt-0.5">•</span>
                              <span>{e.detail}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-2xl font-bold" style={{ color: fc.riskScore >= 80 ? "hsl(0,72%,55%)" : fc.riskScore >= 60 ? "hsl(38,92%,55%)" : "hsl(38,92%,55%)" }}>
                          {Math.round(fc.riskScore)}
                        </div>
                        <div className="text-xs text-slate-500">risk score</div>
                        <div className="w-16 bg-[hsl(222_30%_18%)] rounded-full h-1 mt-1">
                          <div className="h-1 rounded-full risk-bar" style={{ width: `${fc.riskScore}%` }} />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Vendors */}
          <TabsContent value="vendors">
            <Card>
              <CardHeader>
                <CardTitle>Vendor Risk Profiles</CardTitle>
                <p className="text-xs text-slate-500">Sorted by risk score</p>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[hsl(222_30%_18%)]">
                        {["Vendor #", "Name", "Country", "Bank Account", "Risk Score", "Status"].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data?.vendors.map(v => (
                        <tr key={v.id} className={cn(
                          "border-b border-[hsl(222_30%_14%)] hover:bg-[hsl(222_30%_12%)] transition-colors",
                          v.onWatchlist && "bg-red-500/5"
                        )}>
                          <td className="px-4 py-3 text-xs font-mono text-slate-300">{v.vendorNumber}</td>
                          <td className="px-4 py-3 text-xs text-slate-200 font-medium">
                            <div className="flex items-center gap-2">
                              {v.name}
                              {v.onWatchlist && <Badge variant="danger" className="text-[10px]">WATCHLIST</Badge>}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-400">{v.country || "—"}</td>
                          <td className="px-4 py-3 text-xs text-slate-400">{v.onWatchlist ? "Watchlist" : "No current alert"}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-16 bg-[hsl(222_30%_18%)] rounded-full h-1.5">
                                <div className="h-1.5 rounded-full risk-bar" style={{ width: `${v.riskScore}%` }} />
                              </div>
                              <span className={cn("text-xs font-bold", getRiskColor(v.riskScore))}>{v.riskScore}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={cn("inline-flex text-[10px] font-medium px-2 py-0.5 rounded-full border",
                              v.onWatchlist ? "text-red-400 bg-red-400/10 border-red-400/20" :
                              v.riskScore >= 60 ? "text-orange-400 bg-orange-400/10 border-orange-400/20" :
                              "text-emerald-400 bg-emerald-400/10 border-emerald-400/20"
                            )}>
                              {v.onWatchlist ? "Watchlist" : v.riskScore >= 60 ? "High Risk" : "Active"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Invoice Review Dialog */}
      <Dialog open={!!selectedInvoice} onOpenChange={() => { setSelectedInvoice(null); setActionNotes(""); }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-[hsl(185_84%_55%)]" />
              Invoice Review: {selectedInvoice?.invoiceNumber}
            </DialogTitle>
          </DialogHeader>

          {selectedInvoice && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-slate-500 mb-0.5">Vendor</p>
                  <p className="font-medium text-slate-200">{selectedInvoice.vendorName}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-0.5">Amount</p>
                  <p className="font-bold text-slate-100">{formatCurrency(selectedInvoice.amount)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-0.5">Invoice Date</p>
                  <p className="text-slate-300">{formatDate(selectedInvoice.invoiceDate)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-0.5">Bank (at submission)</p>
                  <p className="text-slate-300">Bank details are protected; mismatch finding is shown in the risk factors.</p>
                </div>
              </div>

              {/* Risk Score */}
              <div className={cn("p-4 rounded-xl border", selectedInvoice.riskScore >= 80 ? "border-red-500/20 bg-red-500/5" : "border-[hsl(222_30%_22%)]")}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-slate-300">Risk Score</span>
                  <span className={cn("text-2xl font-bold", getRiskColor(selectedInvoice.riskScore))}>
                    {Math.round(selectedInvoice.riskScore)}/100
                  </span>
                </div>
                <Progress value={selectedInvoice.riskScore} className="h-2 [&>div]:bg-gradient-to-r [&>div]:from-emerald-500 [&>div]:via-yellow-500 [&>div]:to-red-500" />
                <p className={cn("text-xs mt-1 font-semibold", getRiskColor(selectedInvoice.riskScore))}>
                  {getRiskLabel(selectedInvoice.riskScore)} Risk
                </p>
              </div>

              {/* Evidence */}
              {selectedInvoice.riskFactors.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-400 mb-2">Risk Evidence</p>
                  <div className="space-y-1">
                    {selectedInvoice.riskFactors.map((f, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-slate-400 p-2 rounded-lg bg-[hsl(222_30%_12%)]">
                        <AlertTriangle className="w-3 h-3 text-orange-400 flex-shrink-0" />
                        {f.replace(/_/g, " ")}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <p className="text-xs font-medium text-slate-400 mb-1.5">Review Notes</p>
                <textarea
                  value={actionNotes}
                  onChange={e => setActionNotes(e.target.value)}
                  placeholder="Add review notes..."
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-[hsl(222_30%_22%)] bg-[hsl(222_30%_14%)] text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-[hsl(185_84%_45%)] resize-none"
                />
              </div>

              <p className="text-xs text-yellow-400/80 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                Block and escalate actions create approval requests. Payments remain unchanged until the approval request is approved.
              </p>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="success" size="sm" onClick={() => selectedInvoice && handleInvoiceAction(selectedInvoice.id, "approve")} disabled={actionLoading}>
              <CheckCircle className="w-4 h-4" />
              Approve
            </Button>
            <Button variant="warning" size="sm" onClick={() => selectedInvoice && handleInvoiceAction(selectedInvoice.id, "escalate")} disabled={actionLoading}>
              <AlertTriangle className="w-4 h-4" />
              Escalate
            </Button>
            <Button variant="destructive" size="sm" onClick={() => selectedInvoice && handleInvoiceAction(selectedInvoice.id, "block")} disabled={actionLoading}>
              <Lock className="w-4 h-4" />
              Block Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
