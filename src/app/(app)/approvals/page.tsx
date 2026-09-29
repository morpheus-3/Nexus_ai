"use client";
import React, { useState, useEffect } from "react";
import { TopBar } from "@/components/layout/TopBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { formatDate, formatCurrency, cn, getStatusColor } from "@/lib/utils";
import { CheckSquare, CheckCircle, XCircle, AlertTriangle, Clock, Package, Lock, FileCode2, RefreshCw, User } from "lucide-react";

interface ApprovalRequest {
  id: number;
  requestId: string;
  type: string;
  title: string;
  description: string | null;
  requestedByName: string | null;
  status: string;
  priority: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
  expiresAt: string | null;
  approvedByName: string | null;
  resolvedAt: string | null;
  approvalNotes: string | null;
  rejectionReason: string | null;
}

const typeIcons: Record<string, React.ElementType> = {
  purchase_requisition: Package,
  payment_block: Lock,
  vendor_change: User,
  batch_execution: FileCode2,
};

const typeColors: Record<string, string> = {
  purchase_requisition: "text-sky-400",
  payment_block: "text-orange-400",
  vendor_change: "text-yellow-400",
  batch_execution: "text-violet-400",
};

export default function ApprovalsPage() {
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ApprovalRequest | null>(null);
  const [action, setAction] = useState<"approve" | "reject" | null>(null);
  const [notes, setNotes] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [filter, setFilter] = useState<"all" | "pending" | "resolved">("pending");

  const load = async () => {
    try {
      const res = await fetch("/api/approvals");
      const d = await res.json();
      setRequests(d.requests || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleAction = async () => {
    if (!selected || !action) return;
    setActionLoading(true);
    try {
      await fetch("/api/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: selected.requestId,
          action,
          notes: action === "approve" ? notes : undefined,
          reason: action === "reject" ? notes : undefined,
        }),
      });
      setSelected(null);
      setAction(null);
      setNotes("");
      await load();
    } finally {
      setActionLoading(false);
    }
  };

  const filtered = requests.filter(r => {
    if (filter === "pending") return r.status === "pending";
    if (filter === "resolved") return r.status !== "pending";
    return true;
  });

  const pending = requests.filter(r => r.status === "pending");
  const critical = pending.filter(r => r.priority === "critical");

  return (
    <div className="animate-fadeIn">
      <TopBar
        title="Human Approval Center"
        subtitle="Purchase requisitions, payment blocks, vendor changes & batch execution"
        actions={
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
            Refresh
          </Button>
        }
      />

      <div className="p-6 space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {[
            { label: "Pending Approvals", value: pending.length, icon: Clock, color: "text-yellow-400", bg: "from-yellow-500/10" },
            { label: "Critical Priority", value: critical.length, icon: AlertTriangle, color: "text-red-400", bg: "from-red-500/10" },
            { label: "Approved (All Time)", value: requests.filter(r => r.status === "approved").length, icon: CheckCircle, color: "text-emerald-400", bg: "from-emerald-500/10" },
            { label: "Rejected", value: requests.filter(r => r.status === "rejected").length, icon: XCircle, color: "text-slate-400", bg: "from-slate-500/10" },
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

        {/* Alerts for critical */}
        {critical.length > 0 && (
          <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/5 card-glow-danger">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <p className="text-sm font-semibold text-red-300">
                {critical.length} critical approval{critical.length !== 1 ? "s" : ""} require immediate action
              </p>
            </div>
          </div>
        )}

        {/* Filter tabs */}
        <div className="flex items-center gap-2">
          {(["pending", "all", "resolved"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize",
                filter === f
                  ? "bg-[hsl(185_84%_45%)/15%] text-[hsl(185_84%_55%)] border border-[hsl(185_84%_45%)/25%]"
                  : "text-slate-400 hover:text-slate-200 hover:bg-[hsl(222_30%_14%)]"
              )}
            >
              {f} ({f === "pending" ? pending.length : f === "all" ? requests.length : requests.filter(r => r.status !== "pending").length})
            </button>
          ))}
        </div>

        {/* Requests list */}
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <Card>
              <CardContent className="text-center py-10">
                <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
                <p className="text-slate-400">No {filter === "pending" ? "pending" : ""} approval requests</p>
              </CardContent>
            </Card>
          ) : (
            filtered.map(req => {
              const Icon = typeIcons[req.type] || CheckSquare;
              const iconColor = typeColors[req.type] || "text-slate-400";
              const isPending = req.status === "pending";
              return (
                <Card
                  key={req.id}
                  className={cn(
                    "border transition-all",
                    isPending && req.priority === "critical" ? "border-red-500/30 bg-red-500/5 card-glow-danger" :
                    isPending && req.priority === "high" ? "border-orange-500/20 bg-orange-500/5" :
                    isPending ? "border-[hsl(222_30%_22%)]" :
                    "border-[hsl(222_30%_16%)] opacity-70"
                  )}
                >
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center border flex-shrink-0",
                        req.priority === "critical" ? "bg-red-500/10 border-red-500/20" :
                        req.priority === "high" ? "bg-orange-500/10 border-orange-500/20" :
                        "bg-[hsl(222_30%_14%)] border-[hsl(222_30%_22%)]"
                      )}>
                        <Icon className={`w-5 h-5 ${iconColor}`} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="text-sm font-semibold text-slate-100">{req.title}</span>
                              <Badge variant={req.priority === "critical" ? "danger" : req.priority === "high" ? "warning" : "muted"} className="text-[10px] capitalize">
                                {req.priority}
                              </Badge>
                              <span className={cn("text-[10px] px-2 py-0.5 rounded-full border font-medium", getStatusColor(req.status))}>
                                {req.status}
                              </span>
                            </div>
                            <p className="text-xs text-slate-400 line-clamp-2">{req.description}</p>
                            <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                              <span>Requested by: <span className="text-slate-300">{req.requestedByName}</span></span>
                              <span>·</span>
                              <span>{formatDate(req.createdAt, "relative")}</span>
                              {req.expiresAt && isPending && (
                                <>
                                  <span>·</span>
                                  <span className="text-orange-400">Expires: {formatDate(req.expiresAt)}</span>
                                </>
                              )}
                            </div>

                            {/* Resolution info */}
                            {!isPending && (
                              <div className="mt-2 text-xs text-slate-500">
                                {req.approvedByName && <span className="text-emerald-400">Approved by {req.approvedByName}</span>}
                                {req.approvalNotes && <span className="text-slate-400 ml-2">— {req.approvalNotes}</span>}
                                {req.rejectionReason && <span className="text-red-400">Rejected: {req.rejectionReason}</span>}
                                {req.resolvedAt && <span className="ml-2">({formatDate(req.resolvedAt, "relative")})</span>}
                              </div>
                            )}
                          </div>

                          {/* Payload preview */}
                          {req.payload && Object.keys(req.payload).length > 0 && (
                            <div className="text-right flex-shrink-0 min-w-[100px]">
                              {req.payload.estimatedValue != null && (
                                <p className="text-sm font-bold text-slate-200">{formatCurrency(String(req.payload.estimatedValue))}</p>
                              )}
                              {req.payload.amount != null && !req.payload.estimatedValue && (
                                <p className="text-sm font-bold text-slate-200">{formatCurrency(String(req.payload.amount))}</p>
                              )}
                              {req.payload.recordCount != null && (
                                <p className="text-sm font-bold text-slate-200">{String(req.payload.recordCount)} records</p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action buttons for pending */}
                    {isPending && (
                      <div className="flex items-center gap-2 mt-4 pt-4 border-t border-[hsl(222_30%_16%)]">
                        <Button size="sm" variant="success" onClick={() => { setSelected(req); setAction("approve"); }}>
                          <CheckCircle className="w-4 h-4" />
                          Approve
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => { setSelected(req); setAction("reject"); }}>
                          <XCircle className="w-4 h-4" />
                          Reject
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={!!selected && !!action} onOpenChange={() => { setSelected(null); setAction(null); setNotes(""); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className={cn(
              "flex items-center gap-2",
              action === "approve" ? "text-emerald-400" : "text-red-400"
            )}>
              {action === "approve" ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
              {action === "approve" ? "Confirm Approval" : "Confirm Rejection"}
            </DialogTitle>
          </DialogHeader>

          {selected && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-[hsl(222_30%_12%)] border border-[hsl(222_30%_18%)]">
                <p className="text-sm font-medium text-slate-200">{selected.title}</p>
                <p className="text-xs text-slate-400 mt-1">{selected.description}</p>
              </div>

              <div>
                <p className="text-xs font-medium text-slate-400 mb-1.5">
                  {action === "approve" ? "Approval notes (optional)" : "Rejection reason"}
                </p>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder={action === "approve" ? "Add notes..." : "Reason for rejection..."}
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-[hsl(222_30%_22%)] bg-[hsl(222_30%_14%)] text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-[hsl(185_84%_45%)] resize-none"
                />
              </div>

              <p className="text-xs text-slate-500 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-yellow-400" />
                This action will be recorded in the audit log and cannot be undone.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setSelected(null); setAction(null); setNotes(""); }}>
              Cancel
            </Button>
            <Button
              variant={action === "approve" ? "success" : "destructive"}
              onClick={handleAction}
              disabled={actionLoading || (action === "reject" && !notes.trim())}
            >
              {actionLoading ? "Processing..." : action === "approve" ? "Confirm Approve" : "Confirm Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
