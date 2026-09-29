"use client";
import React, { useState, useEffect, useCallback } from "react";
import { TopBar } from "@/components/layout/TopBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate, cn } from "@/lib/utils";
import { ScrollText, Search, RefreshCw, AlertTriangle, Info, AlertCircle } from "lucide-react";

interface AuditEntry {
  id: number;
  userEmail: string | null;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  description: string;
  severity: string | null;
  createdAt: string;
  metadata: Record<string, unknown> | null;
}

const severityConfig: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  info: { icon: Info, color: "text-sky-400", bg: "bg-sky-400/10 border-sky-400/20" },
  warning: { icon: AlertTriangle, color: "text-yellow-400", bg: "bg-yellow-400/10 border-yellow-400/20" },
  error: { icon: AlertCircle, color: "text-orange-400", bg: "bg-orange-400/10 border-orange-400/20" },
  critical: { icon: AlertTriangle, color: "text-red-400", bg: "bg-red-400/10 border-red-400/20" },
};

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (search) params.append("search", search);
      if (severity !== "all") params.append("severity", severity);
      const res = await fetch(`/api/audit?${params}`);
      const d = await res.json();
      setLogs(d.logs || []);
    } finally {
      setLoading(false);
    }
  }, [search, severity]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    load();
  };

  return (
    <div className="animate-fadeIn">
      <TopBar
        title="Audit Log"
        subtitle="Searchable, filterable action history & security events"
        actions={
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
            Refresh
          </Button>
        }
      />

      <div className="p-6 space-y-6">
        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <form onSubmit={handleSearch} className="flex items-center gap-3 flex-wrap">
              <div className="flex-1 relative min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <Input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search descriptions, emails, actions..."
                  className="pl-9"
                />
              </div>
              <Select value={severity} onValueChange={setSeverity}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severities</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
              <Button type="submit" size="sm">Search</Button>
            </form>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(["info", "warning", "error", "critical"] as const).map(s => {
            const cfg = severityConfig[s];
            const Icon = cfg.icon;
            const count = logs.filter(l => l.severity === s).length;
            return (
              <div key={s} className={cn("p-3 rounded-xl border flex items-center gap-3", cfg.bg)}>
                <Icon className={`w-4 h-4 ${cfg.color}`} />
                <div>
                  <p className={`text-xl font-bold ${cfg.color}`}>{count}</p>
                  <p className="text-[10px] text-slate-500 capitalize">{s}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Log Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ScrollText className="w-4 h-4 text-[hsl(185_84%_55%)]" />
              Audit Events ({logs.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 space-y-2">
                {[...Array(5)].map((_, i) => <div key={i} className="h-12 rounded-lg shimmer-bg" />)}
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-10">
                <ScrollText className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400">No audit events found</p>
              </div>
            ) : (
              <div className="divide-y divide-[hsl(222_30%_14%)]">
                {logs.map(entry => {
                  const cfg = severityConfig[entry.severity || "info"] || severityConfig.info;
                  const Icon = cfg.icon;
                  return (
                    <div key={entry.id} className={cn("flex items-start gap-3 p-4 hover:bg-[hsl(222_30%_12%)] transition-colors",
                      entry.severity === "critical" && "bg-red-500/5",
                      entry.severity === "warning" && "bg-yellow-500/5",
                    )}>
                      <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center border flex-shrink-0 mt-0.5", cfg.bg)}>
                        <Icon className={`w-3.5 h-3.5 ${cfg.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                          <span className="text-xs font-mono font-medium text-slate-300">{entry.action}</span>
                          {entry.resourceType && (
                            <span className="text-[10px] text-slate-500 font-medium">{entry.resourceType}</span>
                          )}
                          {entry.resourceId && (
                            <span className="text-[10px] font-mono text-slate-500">#{entry.resourceId}</span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400">{entry.description}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          {entry.userEmail && <span className="text-slate-400 mr-2">{entry.userEmail}</span>}
                          {formatDate(entry.createdAt, "long")}
                        </p>
                      </div>
                      <div className="flex-shrink-0">
                        <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-full border capitalize", cfg.bg, cfg.color)}>
                          {entry.severity}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
