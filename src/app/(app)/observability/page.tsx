"use client";
import React, { useState, useEffect, useCallback } from "react";
import { TopBar } from "@/components/layout/TopBar";
import { ExecutionTrace } from "@/components/agents/ExecutionTrace";
import type { AgentExecution } from "@/lib/agent-planner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate, cn, getStatusColor } from "@/lib/utils";
import { Activity, Bot, Clock, CheckCircle, XCircle, ChevronDown, ChevronUp, RefreshCw, AlertTriangle } from "lucide-react";

interface AgentRun {
  id: number;
  runId: string;
  sessionId: string | null;
  userMessage: string;
  supervisorDecision: string | null;
  agentsInvoked: string[];
  toolsUsed: string[];
  response: string | null;
  status: string;
  executionMode: string | null;
  durationMs: number | null;
  tokenCount: number | null;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
  structuredOutput: Record<string, unknown> | null;
}

const agentColors: Record<string, string> = {
  supply_chain: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  fraud: "text-orange-400 bg-orange-400/10 border-orange-400/20",
  bdc: "text-violet-400 bg-violet-400/10 border-violet-400/20",
  multi_agent: "text-[hsl(185_84%_55%)] bg-[hsl(185_84%_45%)/10%] border-[hsl(185_84%_45%)/20%]",
};

const agentLabels: Record<string, string> = {
  supply_chain: "Supply Chain",
  fraud: "Fraud & Compliance",
  bdc: "BDC Automation",
  multi_agent: "Multi-Agent",
};

function RunCard({ run }: { run: AgentRun }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className={cn(
      "border transition-all",
      run.status === "failed" ? "border-red-500/20 bg-red-500/5" : "border-[hsl(222_30%_18%)]"
    )}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center border flex-shrink-0 mt-0.5",
            run.status === "completed" ? "bg-emerald-500/10 border-emerald-500/20" :
            run.status === "failed" ? "bg-red-500/10 border-red-500/20" :
            "bg-[hsl(222_30%_14%)] border-[hsl(222_30%_22%)]"
          )}>
            <Bot className={cn("w-4 h-4", run.status === "completed" ? "text-emerald-400" : run.status === "failed" ? "text-red-400" : "text-slate-400")} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  {run.supervisorDecision && (
                    <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border", agentColors[run.supervisorDecision] || "text-slate-400 bg-slate-400/10 border-slate-400/20")}>
                      {agentLabels[run.supervisorDecision] || run.supervisorDecision}
                    </span>
                  )}
                  <span className={cn("text-[10px] px-2 py-0.5 rounded-full border font-medium", getStatusColor(run.status))}>
                    {run.status}
                  </span>
                  {run.executionMode && (
                    <span className="text-[10px] text-sky-400 bg-sky-400/10 border border-sky-400/20 px-1.5 py-0.5 rounded-full">
                      {run.executionMode}
                    </span>
                  )}
                  {run.durationMs && (
                    <span className="text-[10px] text-slate-500 flex items-center gap-0.5">
                      <Clock className="w-3 h-3" /> {(run.durationMs / 1000).toFixed(2)}s
                    </span>
                  )}
                </div>
                <p className="text-xs font-medium text-slate-300 mb-1">{run.userMessage}</p>
                <p className="text-[10px] text-slate-500">
                  Run {run.runId.slice(0, 8)} · {formatDate(run.createdAt, "relative")}
                  {run.sessionId && ` · Session ${run.sessionId.slice(0, 8)}`}
                </p>
              </div>
            </div>

            {/* Tools */}
            <div className="flex flex-wrap gap-1 mt-2">
              {run.agentsInvoked.map(a => (
                <span key={a} className="text-[10px] px-1.5 py-0.5 rounded bg-[hsl(222_30%_16%)] border border-[hsl(222_30%_22%)] text-slate-300">
                  {a.replace("_agent", "").replace("_", " ")}
                </span>
              ))}
              {run.toolsUsed.slice(0, 4).map(t => (
                <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-[hsl(222_30%_14%)] border border-[hsl(222_30%_20%)] text-slate-500 font-mono">
                  {t}()
                </span>
              ))}
              {run.toolsUsed.length > 4 && (
                <span className="text-[10px] text-slate-500">+{run.toolsUsed.length - 4} more</span>
              )}
            </div>

            {/* Expand button */}
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-[10px] text-slate-500 hover:text-slate-400 flex items-center gap-1 mt-2 transition-colors"
            >
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {expanded ? "Hide" : "Show"} response
            </button>

            {expanded && run.response && (
              <div className="mt-2 p-3 rounded-lg bg-[hsl(222_30%_12%)] border border-[hsl(222_30%_16%)]">
                <p className="text-xs text-slate-400 whitespace-pre-wrap line-clamp-10">{run.response.slice(0, 500)}{run.response.length > 500 ? "…" : ""}</p>
              </div>
            )}
            {expanded && <ExecutionTrace execution={run.structuredOutput?.execution as AgentExecution | undefined} />}

            {run.errorMessage && (
              <div className="mt-2 p-2 rounded-lg bg-red-500/10 border border-red-500/20">
                <p className="text-xs text-red-400">{run.errorMessage}</p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ObservabilityPage() {
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/agent/runs");
      const text = await res.text();
      let data: { runs?: unknown; error?: string };
      try {
        if (!text.trim()) throw new Error("The server returned an empty response.");
        data = JSON.parse(text) as { runs?: unknown; error?: string };
      } catch {
        throw new Error(`The server returned an invalid response (HTTP ${res.status}).`);
      }

      if (!res.ok) {
        throw new Error(data.error || `Unable to load agent runs (HTTP ${res.status}).`);
      }
      if (!Array.isArray(data.runs)) {
        throw new Error("The server response did not include an agent runs list.");
      }

      setRuns(data.runs as AgentRun[]);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load agent runs.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const filtered = filter === "all" ? runs : runs.filter(r => r.supervisorDecision === filter);

  const completed = runs.filter(r => r.status === "completed").length;
  const failed = runs.filter(r => r.status === "failed").length;
  const avgDuration = runs.filter(r => r.durationMs).reduce((s, r) => s + (r.durationMs || 0), 0) / (runs.filter(r => r.durationMs).length || 1);
  const agentCounts: Record<string, number> = {};
  runs.forEach(r => { if (r.supervisorDecision) agentCounts[r.supervisorDecision] = (agentCounts[r.supervisorDecision] || 0) + 1; });

  return (
    <div className="animate-fadeIn">
      <TopBar
        title="Agent Observability"
        subtitle="Workflow steps, tool calls, execution history & performance"
        actions={
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
            Refresh
          </Button>
        }
      />

      <div className="p-6 space-y-6">
        {/* Metrics */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {[
            { label: "Total Runs", value: runs.length, icon: Activity, color: "text-[hsl(185_84%_55%)]", bg: "from-[hsl(185_84%_45%)/10%]" },
            { label: "Completed", value: completed, icon: CheckCircle, color: "text-emerald-400", bg: "from-emerald-500/10" },
            { label: "Failed", value: failed, icon: XCircle, color: "text-red-400", bg: "from-red-500/10" },
            { label: "Avg Duration", value: `${(avgDuration / 1000).toFixed(1)}s`, icon: Clock, color: "text-sky-400", bg: "from-sky-500/10" },
          ].map(m => {
            const Icon = m.icon;
            return (
              <Card key={m.label}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${m.bg} to-transparent flex items-center justify-center border border-[hsl(222_30%_22%)]`}>
                      <Icon className={`w-4 h-4 ${m.color}`} />
                    </div>
                    <div>
                      <p className={`text-2xl font-bold ${m.color}`}>{m.value}</p>
                      <p className="text-xs text-slate-500">{m.label}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Agent breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Agent Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {Object.entries(agentCounts).map(([agent, count]) => (
                <div key={agent} className={cn("px-3 py-2 rounded-lg border", agentColors[agent] || "text-slate-400 bg-slate-400/10 border-slate-400/20")}>
                  <p className="text-sm font-bold">{count}</p>
                  <p className="text-[10px] opacity-80">{agentLabels[agent] || agent}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Filter */}
        <div className="flex items-center gap-2 flex-wrap">
          {["all", "supply_chain", "fraud", "bdc", "multi_agent"].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                filter === f
                  ? "bg-[hsl(185_84%_45%)/15%] text-[hsl(185_84%_55%)] border border-[hsl(185_84%_45%)/25%]"
                  : "text-slate-400 hover:text-slate-200 hover:bg-[hsl(222_30%_14%)]"
              )}
            >
              {f === "all" ? "All Agents" : agentLabels[f] || f} ({f === "all" ? runs.length : runs.filter(r => r.supervisorDecision === f).length})
            </button>
          ))}
        </div>

        {/* Run cards */}
        <div className="space-y-3">
          {loading ? (
            [...Array(4)].map((_, i) => <div key={i} className="h-28 rounded-xl shimmer-bg" />)
          ) : error ? (
            <Card>
              <CardContent className="text-center py-10">
                <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
                <p className="text-slate-200 font-medium">Agent runs could not be loaded</p>
                <p className="text-sm text-slate-400 mt-1">{error}</p>
                <Button variant="outline" size="sm" onClick={() => void load()} className="mt-4">
                  <RefreshCw className="w-4 h-4" /> Try again
                </Button>
              </CardContent>
            </Card>
          ) : filtered.length === 0 ? (
            <Card>
              <CardContent className="text-center py-10">
                <Activity className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400">{runs.length === 0 ? "No agent runs yet" : "No runs match this agent filter"}</p>
              </CardContent>
            </Card>
          ) : (
            filtered.map(run => <RunCard key={run.id} run={run} />)
          )}
        </div>
      </div>
    </div>
  );
}
