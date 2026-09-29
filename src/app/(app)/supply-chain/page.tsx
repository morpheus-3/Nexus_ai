"use client";
import React, { useState, useEffect, useCallback } from "react";
import { TopBar } from "@/components/layout/TopBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { Package, AlertTriangle, Clock, CheckCircle, ArrowRight, RefreshCw, TrendingDown, Truck } from "lucide-react";
import { AgentRunButton } from "@/components/agents/AgentRunButton";

interface InventoryItem {
  id: number;
  materialNumber: string;
  description: string;
  plant: string;
  storageLocation: string;
  currentStock: number;
  safetyStock: number;
  reorderPoint: number;
  maxStock: number | null;
  unitOfMeasure: string;
  category: string | null;
  supplier: string | null;
  leadTimeDays: number | null;
  unitCost: number | null;
  currency: string | null;
  pctOfSafety: number;
  status: "critical" | "low" | "warning" | "healthy";
  totalValue: number | null;
}

interface PurchaseOrder {
  id: number;
  poNumber: string;
  vendorName: string;
  description: string | null;
  quantity: string;
  totalAmount: string;
  status: string;
  expectedDelivery: string | null;
  plant: string | null;
}

interface PR {
  id: number;
  prNumber: string;
  description: string;
  quantity: string;
  estimatedValue: string | null;
  status: string;
  priority: string | null;
  aiGenerated: boolean | null;
  requiredDate: string | null;
}

const statusConfig: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  critical: { label: "Critical", color: "text-red-400", bg: "bg-red-500/10 border-red-500/20", icon: AlertTriangle },
  low: { label: "Below Safety", color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20", icon: TrendingDown },
  warning: { label: "Warning", color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20", icon: AlertTriangle },
  healthy: { label: "Healthy", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", icon: CheckCircle },
};

export default function SupplyChainPage() {
  const [data, setData] = useState<{ items: InventoryItem[]; delayedPOs: PurchaseOrder[]; openPRs: PR[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/inventory");
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || `Unable to load inventory (HTTP ${res.status})`);
      if (!Array.isArray(d.items) || !Array.isArray(d.delayedPOs) || !Array.isArray(d.openPRs)) throw new Error("The server returned an invalid inventory response.");
      setData(d);
      setLoadError(null);
    } catch (cause) {
      setLoadError(cause instanceof Error ? cause.message : "Unable to load inventory.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const [currentTime] = useState(() => Date.now());
  const belowSafety = data?.items.filter(i => i.status !== "healthy") || [];
  const healthyItems = data?.items.filter(i => i.status === "healthy") || [];

  if (loading) {
    return (
      <div>
        <TopBar title="Supply Chain" />
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => <div key={i} className="h-24 rounded-xl shimmer-bg" />)}
        </div>
      </div>
    );
  }

  if (loadError || !data) {
    return <div><TopBar title="Supply Chain" /><div role="alert" className="m-6 rounded-xl border border-red-500/25 bg-red-500/5 p-5 text-sm text-red-200"><p>{loadError || "Supply-chain data is unavailable."}</p><Button className="mt-3" variant="outline" size="sm" onClick={() => void load()}>Retry</Button></div></div>;
  }

  return (
    <div className="animate-fadeIn">
      <TopBar
        title="Supply Chain Intelligence"
        subtitle="Inventory monitoring, purchase orders & replenishment"
        actions={<div className="flex items-center gap-2"><AgentRunButton agent="supply_chain" /><Button variant="outline" size="sm" onClick={load} disabled={refreshing}><RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />Refresh</Button></div>}
      />

      <div className="p-6 space-y-6">
        {/* Summary KPIs */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {[
            { label: "Below Safety Stock", value: belowSafety.length, icon: TrendingDown, color: "text-red-400", bg: "from-red-500/10" },
            { label: "Delayed POs", value: data?.delayedPOs.length || 0, icon: Clock, color: "text-orange-400", bg: "from-orange-500/10" },
            { label: "Open Requisitions", value: data?.openPRs.length || 0, icon: Package, color: "text-sky-400", bg: "from-sky-500/10" },
            { label: "Healthy Stock", value: healthyItems.length, icon: CheckCircle, color: "text-emerald-400", bg: "from-emerald-500/10" },
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

        <Tabs defaultValue="inventory">
          <TabsList>
            <TabsTrigger value="inventory">Inventory ({data?.items.length})</TabsTrigger>
            <TabsTrigger value="delayed">Delayed POs ({data?.delayedPOs.length})</TabsTrigger>
            <TabsTrigger value="requisitions">Requisitions ({data?.openPRs.length})</TabsTrigger>
          </TabsList>

          {/* Inventory Tab */}
          <TabsContent value="inventory">
            <Card>
              <CardHeader>
                <CardTitle>Material Stock Levels</CardTitle>
                <p className="text-xs text-slate-500">Sorted by urgency · Below safety stock highlighted</p>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[hsl(222_30%_18%)]">
                        {["Material", "Description", "Plant", "Stock", "Safety Stock", "% of Safety", "Status", "Lead Time", "Value"].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data?.items.map(item => {
                        const cfg = statusConfig[item.status];
                        const Icon = cfg.icon;
                        return (
                          <tr key={item.id} className={cn(
                            "border-b border-[hsl(222_30%_14%)] hover:bg-[hsl(222_30%_12%)] transition-colors",
                            item.status === "critical" && "bg-red-500/5",
                          )}>
                            <td className="px-4 py-3 text-xs font-mono text-slate-300">{item.materialNumber}</td>
                            <td className="px-4 py-3 text-xs text-slate-300 max-w-[200px]">
                              <div className="truncate" title={item.description}>{item.description}</div>
                              {item.supplier && <div className="text-[10px] text-slate-500 truncate">{item.supplier}</div>}
                            </td>
                            <td className="px-4 py-3 text-xs text-slate-400">{item.plant}</td>
                            <td className="px-4 py-3 text-xs font-semibold text-slate-200 whitespace-nowrap">
                              {item.currentStock.toLocaleString()} {item.unitOfMeasure}
                            </td>
                            <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
                              {item.safetyStock.toLocaleString()} {item.unitOfMeasure}
                            </td>
                            <td className="px-4 py-3 min-w-[120px]">
                              <div className="flex items-center gap-2">
                                <Progress value={Math.min(item.pctOfSafety, 100)} className={cn("flex-1 h-1.5",
                                  item.pctOfSafety < 50 ? "[&>div]:bg-red-500" :
                                  item.pctOfSafety < 80 ? "[&>div]:bg-yellow-500" : "[&>div]:bg-emerald-500"
                                )} />
                                <span className={cn("text-xs font-medium w-8 text-right", cfg.color)}>{item.pctOfSafety}%</span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className={cn("inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border", cfg.bg, cfg.color)}>
                                <Icon className="w-3 h-3" />
                                {cfg.label}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs text-slate-400">{item.leadTimeDays ?? "—"}d</td>
                            <td className="px-4 py-3 text-xs text-slate-300">
                              {item.totalValue ? formatCurrency(item.totalValue) : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Delayed POs Tab */}
          <TabsContent value="delayed">
            <Card>
              <CardHeader>
                <CardTitle>Delayed Purchase Orders</CardTitle>
                <p className="text-xs text-slate-500">Orders past expected delivery date</p>
              </CardHeader>
              <CardContent>
                {data?.delayedPOs.length === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                    <p className="text-sm text-slate-400">No delayed purchase orders</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {data?.delayedPOs.map(po => {
                      const daysDelayed = po.expectedDelivery
                        ? Math.floor((currentTime - new Date(po.expectedDelivery).getTime()) / 86400000)
                        : 0;
                      return (
                        <div key={po.id} className="flex items-center gap-4 p-4 rounded-xl border border-orange-500/20 bg-orange-500/5 card-glow-warning">
                          <Truck className="w-5 h-5 text-orange-400 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-semibold text-slate-200">{po.poNumber}</span>
                              <Badge variant="warning" className="text-[10px]">{daysDelayed}d overdue</Badge>
                            </div>
                            <p className="text-xs text-slate-400 truncate">{po.description}</p>
                            <p className="text-xs text-slate-500 mt-0.5">{po.vendorName} · {po.plant}</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-sm font-semibold text-slate-200">{formatCurrency(po.totalAmount)}</p>
                            <p className="text-xs text-slate-500">Expected: {formatDate(po.expectedDelivery)}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Requisitions Tab */}
          <TabsContent value="requisitions">
            <Card>
              <CardHeader>
                <CardTitle>Open Purchase Requisitions</CardTitle>
                <p className="text-xs text-slate-500">AI-generated and manual requisitions pending approval</p>
              </CardHeader>
              <CardContent>
                {data?.openPRs.length === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                    <p className="text-sm text-slate-400">No open purchase requisitions</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {data?.openPRs.map(pr => (
                      <div key={pr.id} className={cn(
                        "flex items-center gap-4 p-4 rounded-xl border transition-colors",
                        pr.priority === "critical" ? "border-red-500/20 bg-red-500/5" :
                        pr.priority === "high" ? "border-orange-500/20 bg-orange-500/5" :
                        "border-[hsl(222_30%_18%)] bg-[hsl(222_30%_12%)]"
                      )}>
                        <Package className={cn("w-5 h-5 flex-shrink-0",
                          pr.priority === "critical" ? "text-red-400" :
                          pr.priority === "high" ? "text-orange-400" : "text-slate-400"
                        )} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-sm font-semibold text-slate-200">{pr.prNumber}</span>
                            {pr.aiGenerated && <Badge variant="info" className="text-[10px]">AI Generated</Badge>}
                            <Badge variant={pr.priority === "critical" ? "danger" : pr.priority === "high" ? "warning" : "muted"} className="text-[10px] capitalize">
                              {pr.priority}
                            </Badge>
                          </div>
                          <p className="text-xs text-slate-400 truncate">{pr.description}</p>
                          {pr.requiredDate && (
                            <p className="text-xs text-slate-500 mt-0.5">Required: {formatDate(pr.requiredDate)}</p>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-semibold text-slate-200">{pr.estimatedValue ? formatCurrency(pr.estimatedValue) : "—"}</p>
                          <p className="text-xs text-slate-500">Qty: {pr.quantity}</p>
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
    </div>
  );
}
