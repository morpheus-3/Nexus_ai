"use client";
import React, { useCallback, useEffect, useState } from "react";
import { TopBar } from "@/components/layout/TopBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate, getStatusColor } from "@/lib/utils";
import {
  Package, ShieldAlert, FileCode2, CheckSquare, TrendingUp, TrendingDown,
  AlertTriangle, Activity, ArrowRight, Clock, Zap, Bot,
} from "lucide-react";
import Link from "next/link";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";

interface DashboardData {
  kpis: {
    inventoryHealth: number;
    openPRs: number;
    invoicesReviewed: number;
    totalInvoices: number;
    highRiskAlerts: number;
    activeFraudCases: number;
    batchSuccessRate: number;
    totalBatches: number;
    delayedPOs: number;
    pendingApprovals: number;
    belowSafetyStock: number;
    totalMaterials: number;
  };
  inventoryByCategory: Array<{ category: string; count: number; below: number }>;
  recentAgentActivity: Array<{
    id: number;
    agent: string;
    status: string;
    durationMs: number;
    createdAt: string;
    message: string;
  }>;
  agentActivityByDay: Array<{ time: string; supply: number; fraud: number; bdc: number; multi: number }>;
}

const COLORS = ["hsl(185 84% 45%)", "hsl(38 92% 50%)", "hsl(0 72% 51%)", "hsl(200 84% 55%)"];

const agentLabels: Record<string, string> = {
  supply_chain: "Supply Chain",
  fraud: "Fraud & Compliance",
  bdc: "BDC Automation",
  multi_agent: "Multi-Agent",
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/dashboard");
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `Dashboard request failed (HTTP ${response.status})`);
      setData(result as DashboardData);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load dashboard data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  if (loading) {
    return (
      <div>
        <TopBar title="Overview Dashboard" subtitle="Enterprise KPIs & Agent Activity" />
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-28 rounded-xl shimmer-bg" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return <div><TopBar title="Overview Dashboard" subtitle="Enterprise KPIs & Agent Activity" /><div role="alert" className="m-6 rounded-xl border border-red-500/25 bg-red-500/5 p-5 text-sm text-red-200"><p>{error || "Dashboard data is unavailable."}</p><Button className="mt-3" variant="outline" size="sm" onClick={() => void load()}>Retry</Button></div></div>;
  }

  const kpis = data.kpis;
  const hasWeeklyActivity = data.agentActivityByDay.some(day => day.supply + day.fraud + day.bdc + day.multi > 0);

  const kpiCards = [
    {
      title: "Inventory Health",
      value: `${kpis?.inventoryHealth ?? 0}%`,
      subtitle: `${kpis?.belowSafetyStock} of ${kpis?.totalMaterials} below safety stock`,
      icon: Package,
      trend: kpis?.inventoryHealth ?? 0 >= 80 ? "up" : "down",
      color: kpis?.inventoryHealth ?? 0 >= 80 ? "text-emerald-400" : kpis?.inventoryHealth ?? 0 >= 60 ? "text-yellow-400" : "text-red-400",
      bg: kpis?.inventoryHealth ?? 0 >= 80 ? "from-emerald-500/10" : "from-yellow-500/10",
      href: "/supply-chain",
    },
    {
      title: "Open Requisitions",
      value: String(kpis?.openPRs ?? 0),
      subtitle: `${kpis?.pendingApprovals} pending approval`,
      icon: CheckSquare,
      trend: (kpis?.openPRs ?? 0) === 0 ? "up" : "neutral",
      color: "text-sky-400",
      bg: "from-sky-500/10",
      href: "/approvals",
    },
    {
      title: "Invoices Reviewed",
      value: `${kpis?.invoicesReviewed ?? 0}/${kpis?.totalInvoices ?? 0}`,
      subtitle: `${kpis?.activeFraudCases} active fraud cases`,
      icon: ShieldAlert,
      trend: "neutral",
      color: "text-[hsl(185_84%_55%)]",
      bg: "from-[hsl(185_84%_45%)/10%]",
      href: "/fraud",
    },
    {
      title: "High-Risk Alerts",
      value: String(kpis?.highRiskAlerts ?? 0),
      subtitle: `${kpis?.delayedPOs} delayed purchase orders`,
      icon: AlertTriangle,
      trend: (kpis?.highRiskAlerts ?? 0) > 0 ? "down" : "up",
      color: (kpis?.highRiskAlerts ?? 0) > 0 ? "text-red-400" : "text-emerald-400",
      bg: (kpis?.highRiskAlerts ?? 0) > 0 ? "from-red-500/10" : "from-emerald-500/10",
      href: "/fraud",
    },
    {
      title: "Batch Success Rate",
      value: `${kpis?.batchSuccessRate ?? 0}%`,
      subtitle: `${kpis?.totalBatches} batches total`,
      icon: FileCode2,
      trend: kpis?.batchSuccessRate ?? 0 >= 90 ? "up" : "neutral",
      color: "text-violet-400",
      bg: "from-violet-500/10",
      href: "/bdc",
    },
    {
      title: "Agent Runs (7d)",
      value: String(data?.recentAgentActivity?.length ?? 0),
      subtitle: "Supply, Fraud, BDC agents",
      icon: Bot,
      trend: "up",
      color: "text-[hsl(185_84%_55%)]",
      bg: "from-[hsl(185_84%_45%)/10%]",
      href: "/observability",
    },
  ];

  return (
    <div className="animate-fadeIn">
      <TopBar
        title="Overview Dashboard"
        subtitle="SAP Nexus AI — Enterprise Intelligence Platform"
        actions={
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sky-500/10 border border-sky-500/20">
            <div className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
            <span className="text-[10px] font-semibold text-sky-400">SIMULATION MODE</span>
          </div>
        }
      />

      <div className="p-6 space-y-6">
        {/* KPI Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {kpiCards.map(kpi => {
            const Icon = kpi.icon;
            return (
              <Link key={kpi.title} href={kpi.href}>
                <Card className="hover:border-[hsl(185_84%_45%)/30%] transition-all hover:card-glow cursor-pointer group">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-xs text-slate-500 font-medium mb-1">{kpi.title}</p>
                        <p className={`text-3xl font-bold ${kpi.color} mb-1`}>{kpi.value}</p>
                        <p className="text-xs text-slate-500">{kpi.subtitle}</p>
                      </div>
                      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${kpi.bg} to-transparent flex items-center justify-center border border-[hsl(222_30%_22%)] group-hover:scale-110 transition-transform`}>
                        <Icon className={`w-5 h-5 ${kpi.color}`} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {/* Agent Activity Chart */}
          <Card className="xl:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Agent Activity (7 Days)</CardTitle>
                  <p className="text-xs text-slate-500 mt-0.5">Runs by agent type</p>
                </div>
                <Badge variant="info" className="text-xs">Database</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {hasWeeklyActivity ? <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={data.agentActivityByDay}>
                  <defs>
                    <linearGradient id="colorSupply" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(185,84%,45%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(185,84%,45%)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorFraud" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(38,92%,50%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(38,92%,50%)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorBdc" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(267,84%,65%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(267,84%,65%)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorMulti" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(267,84%,65%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(267,84%,65%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(222,30%,18%)" />
                  <XAxis dataKey="time" stroke="hsl(215,20%,35%)" fontSize={11} />
                  <YAxis stroke="hsl(215,20%,35%)" fontSize={11} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "hsl(222,40%,10%)", border: "1px solid hsl(222,30%,22%)", borderRadius: "8px" }}
                    labelStyle={{ color: "hsl(210,40%,80%)" }}
                    itemStyle={{ color: "hsl(210,40%,70%)" }}
                  />
                  <Area type="monotone" dataKey="supply" stroke="hsl(185,84%,45%)" fill="url(#colorSupply)" strokeWidth={2} name="Supply Chain" />
                  <Area type="monotone" dataKey="fraud" stroke="hsl(38,92%,50%)" fill="url(#colorFraud)" strokeWidth={2} name="Fraud" />
                  <Area type="monotone" dataKey="bdc" stroke="hsl(267,84%,65%)" fill="url(#colorBdc)" strokeWidth={2} name="BDC" />
                  <Area type="monotone" dataKey="multi" stroke="hsl(267,84%,65%)" fill="url(#colorMulti)" strokeWidth={2} name="Multi-agent" />
                </AreaChart>
              </ResponsiveContainer> : <div className="h-[200px] flex items-center justify-center text-sm text-slate-500">No agent runs in the last 7 days</div>}
              <div className="flex items-center gap-4 mt-3">
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[hsl(185,84%,45%)]" /><span className="text-xs text-slate-500">Supply Chain</span></div>
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[hsl(38,92%,50%)]" /><span className="text-xs text-slate-500">Fraud</span></div>
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[hsl(267,84%,65%)]" /><span className="text-xs text-slate-500">BDC</span></div>
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-violet-300" /><span className="text-xs text-slate-500">Multi-agent</span></div>
              </div>
            </CardContent>
          </Card>

          {/* Inventory by Category */}
          <Card>
            <CardHeader>
              <CardTitle>Inventory by Category</CardTitle>
              <p className="text-xs text-slate-500">Stock vs safety threshold</p>
            </CardHeader>
            <CardContent>
              {data?.inventoryByCategory && data.inventoryByCategory.length > 0 ? (
                <div className="space-y-3">
                  {data.inventoryByCategory.slice(0, 6).map((cat, i) => {
                    const pct = cat.count > 0 ? Math.round((1 - cat.below / cat.count) * 100) : 100;
                    return (
                      <div key={cat.category || i}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-slate-400">{cat.category || "Uncategorized"}</span>
                          <span className="text-xs font-semibold text-slate-300">{pct}%</span>
                        </div>
                        <Progress value={pct} className="h-1.5" />
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-slate-500 text-center py-8">No inventory data</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Agent Activity */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recent Agent Activity</CardTitle>
                <p className="text-xs text-slate-500 mt-0.5">Last agent runs across all workspaces</p>
              </div>
              <Link href="/observability" className="text-xs text-[hsl(185_84%_55%)] hover:underline flex items-center gap-1">
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {data?.recentAgentActivity && data.recentAgentActivity.length > 0 ? (
              <div className="space-y-2">
                {data.recentAgentActivity.map(run => (
                  <div key={run.id} className="flex items-center gap-3 p-3 rounded-lg bg-[hsl(222_30%_12%)] border border-[hsl(222_30%_16%)] hover:border-[hsl(222_30%_22%)] transition-colors">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${run.status === "completed" ? "bg-emerald-400" : "bg-red-400"}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-300 truncate">{run.message}...</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        {agentLabels[run.agent] || run.agent} · {run.durationMs ? `${(run.durationMs / 1000).toFixed(1)}s` : "—"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge variant={run.status === "completed" ? "success" : "danger"} className="text-[10px]">
                        {run.status}
                      </Badge>
                      <span className="text-[10px] text-slate-500 hidden sm:block">{formatDate(run.createdAt, "relative")}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Bot className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-sm text-slate-500">No agent runs yet</p>
                <Link href="/command" className="text-xs text-[hsl(185_84%_55%)] hover:underline mt-1 inline-block">
                  Go to AI Command Center
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: "Check Safety Stock", href: "/command", icon: Package, desc: "Supply chain analysis" },
            { label: "Review Invoices", href: "/fraud", icon: ShieldAlert, desc: "Fraud & compliance" },
            { label: "Upload BDC File", href: "/bdc", icon: FileCode2, desc: "Batch automation" },
            { label: "Pending Approvals", href: "/approvals", icon: CheckSquare, desc: `${kpis?.pendingApprovals || 0} waiting` },
          ].map(action => {
            const Icon = action.icon;
            return (
              <Link key={action.label} href={action.href}>
                <div className="p-4 rounded-xl border border-[hsl(222_30%_18%)] bg-[hsl(222_40%_10%)] hover:border-[hsl(185_84%_45%)/30%] hover:card-glow transition-all cursor-pointer group">
                  <Icon className="w-5 h-5 text-[hsl(185_84%_55%)] mb-2 group-hover:scale-110 transition-transform" />
                  <p className="text-sm font-medium text-slate-200">{action.label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{action.desc}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
