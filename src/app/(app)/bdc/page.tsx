"use client";
import React, { useState, useEffect, useRef } from "react";
import { TopBar } from "@/components/layout/TopBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { formatDate, formatNumber, cn, getStatusColor } from "@/lib/utils";
import { Upload, FileCode2, CheckCircle, XCircle, AlertTriangle, RefreshCw, Download, Play, Eye, Zap } from "lucide-react";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import { DataImportPanel } from "@/components/ingestion/DataImportPanel";

interface BatchJob {
  id: number;
  jobId: string;
  name: string;
  fileName: string | null;
  recordCount: number;
  successCount: number;
  errorCount: number;
  warningCount: number;
  status: string;
  sapTransaction: string | null;
  simulationMode: boolean | null;
  createdAt: string;
  completedAt: string | null;
  validationResults: Array<{ row: number; status: string; errors: string[]; warnings: string[] }>;
  executionResults: Array<{ row: number; status: string; documentNumber: string | null; message: string }>;
  errorReport: Array<{ row: number; error: string }>;
  fieldMapping: Record<string, string>;
}

async function readJsonResponse<T>(response: Response): Promise<T> {
  const body = await response.text();
  if (!body.trim()) throw new Error(`The server returned an empty response (HTTP ${response.status}).`);
  let data: unknown;
  try {
    data = JSON.parse(body);
  } catch {
    throw new Error(`The server returned an invalid response (HTTP ${response.status}).`);
  }
  if (!response.ok) {
    const message = typeof data === "object" && data !== null && "error" in data && typeof data.error === "string"
      ? data.error
      : `Request failed (HTTP ${response.status}).`;
    throw new Error(message);
  }
  return data as T;
}

const SAP_TRANSACTIONS = [
  { value: "ME21N", label: "ME21N — Purchase Order Create" },
  { value: "MB1C", label: "MB1C — Goods Receipt (Other)" },
  { value: "XK01", label: "XK01 — Create Vendor Master" },
];

const SAMPLE_FIELDS: Record<string, string[]> = {
  ME21N: ["Vendor", "Material", "Quantity", "Price", "Currency", "Plant", "Delivery Date"],
  MB1C: ["Material Number", "Plant", "Storage Location", "Quantity", "Unit", "Movement Type"],
  XK01: ["Vendor Number", "Name", "Country", "Street", "City", "Tax ID", "Bank Account"],
};

export default function BDCPage() {
  const [jobs, setJobs] = useState<BatchJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Upload state
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<Record<string, string>[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [transaction, setTransaction] = useState("ME21N");
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState(false);
  const [result, setResult] = useState<{ successCount: number; errorCount: number; status: string; jobId: string } | null>(null);

  const load = async () => {
    try {
      const res = await fetch("/api/bdc");
      const d = await readJsonResponse<{ jobs: BatchJob[] }>(res);
      if (!d || !Array.isArray(d.jobs)) throw new Error("The server returned an invalid batch history response.");
      setJobs(d.jobs);
      setHistoryError(null);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load batch history.";
      setHistoryError(message);
      return false;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setResult(null);

    if (f.name.endsWith(".csv")) {
      const text = await f.text();
      Papa.parse<Record<string, string>>(text, {
        header: true,
        skipEmptyLines: true,
        complete: (res) => {
          setParsedData(res.data);
          setCsvHeaders(res.meta.fields || []);
          // Auto-map
          const autoMap: Record<string, string> = {};
          const sapFields = SAMPLE_FIELDS[transaction] || [];
          sapFields.forEach(sapField => {
            const match = res.meta.fields?.find(h =>
              h.toLowerCase().replace(/[^a-z]/g, "") === sapField.toLowerCase().replace(/[^a-z]/g, "")
            );
            if (match) autoMap[sapField] = match;
          });
          setMapping(autoMap);
        },
      });
    } else {
      const buf = await f.arrayBuffer();
      const wb = XLSX.read(buf);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { raw: false });
      const headers = data.length > 0 ? Object.keys(data[0]) : [];
      setParsedData(data);
      setCsvHeaders(headers);
      const autoMap: Record<string, string> = {};
      const sapFields = SAMPLE_FIELDS[transaction] || [];
      sapFields.forEach(sapField => {
        const match = headers.find(h =>
          h.toLowerCase().replace(/[^a-z]/g, "") === sapField.toLowerCase().replace(/[^a-z]/g, "")
        );
        if (match) autoMap[sapField] = match;
      });
      setMapping(autoMap);
    }
    setPreview(true);
  };

  const handleSubmit = async (simMode: boolean) => {
    if (!parsedData.length || !file) return;
    setUploading(true);
    setSubmitError(null);

    // Convert mapping: { "SAP Field": "CSV Column" } -> { "CSV Column": "SAP Field" }
    const reverseMapping: Record<string, string> = {};
    Object.entries(mapping).forEach(([sapField, csvCol]) => {
      if (csvCol) reverseMapping[csvCol] = sapField;
    });

    try {
      const res = await fetch("/api/bdc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${transaction} - ${file.name}`,
          records: parsedData.slice(0, 200).map(row => {
            const r: Record<string, string> = {};
            Object.entries(row).forEach(([k, v]) => { r[k] = String(v ?? ""); });
            return r;
          }),
          fieldMapping: reverseMapping,
          sapTransaction: transaction,
          simulationMode: simMode,
          fileName: file.name,
        }),
      });
      const d = await readJsonResponse<{ successCount: number; errorCount: number; status: string; jobId: string }>(res);
      setResult({ successCount: d.successCount, errorCount: d.errorCount, status: d.status, jobId: d.jobId });
      await load();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Unable to process this BDC batch.");
    } finally {
      setUploading(false);
    }
  };

  const downloadErrorReport = (job: BatchJob) => {
    if (!job.errorReport.length) return;
    const csv = Papa.unparse(job.errorReport.map(e => ({ Row: e.row, Error: e.error })));
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `error_report_${job.jobId.slice(0, 8)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const successRate = (job: BatchJob) => job.recordCount > 0
    ? Math.round((job.successCount / job.recordCount) * 100)
    : 0;

  return (
    <div className="animate-fadeIn">
      <TopBar
        title="BDC Data Automation"
        subtitle="CSV/XLSX ingestion · SAP field mapping · Batch simulation"
        actions={
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sky-500/10 border border-sky-500/20">
            <Zap className="w-3 h-3 text-sky-400" />
            <span className="text-[10px] font-semibold text-sky-400">SIMULATION SAFE</span>
          </div>
        }
      />

      <div className="p-6 space-y-6">
        <DataImportPanel />
        {/* Upload Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-4 h-4 text-[hsl(185_84%_55%)]" />
              Upload & Process
            </CardTitle>
            <p className="text-xs text-slate-500">Upload CSV or XLSX file · Map to SAP fields · Simulate or execute</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Transaction selector */}
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <p className="text-xs text-slate-500 mb-1.5">SAP Transaction</p>
                <Select value={transaction} onValueChange={(v) => { setTransaction(v); setMapping({}); }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SAP_TRANSACTIONS.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1.5">File (CSV/XLSX)</p>
                <Button variant="outline" onClick={() => fileRef.current?.click()}>
                  <Upload className="w-4 h-4" />
                  Choose File
                </Button>
                <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFileChange} />
              </div>
              {file && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-[hsl(222_30%_14%)] border border-[hsl(222_30%_22%)]">
                  <FileCode2 className="w-4 h-4 text-[hsl(185_84%_55%)]" />
                  <div>
                    <p className="text-xs font-medium text-slate-200">{file.name}</p>
                    <p className="text-[10px] text-slate-500">{parsedData.length} records · {(file.size / 1024).toFixed(1)} KB</p>
                  </div>
                </div>
              )}
            </div>

            {/* Sample data hint */}
            {!file && (
              <div className="border-2 border-dashed border-[hsl(222_30%_20%)] rounded-xl p-8 text-center hover:border-[hsl(185_84%_45%)/30%] transition-colors cursor-pointer" onClick={() => fileRef.current?.click()}>
                <Upload className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-sm text-slate-400">Drop CSV/XLSX here or click to browse</p>
                <p className="text-xs text-slate-500 mt-1">Max 500 records · Supports .csv, .xlsx, .xls</p>
                <p className="text-xs text-[hsl(185_84%_55%)] mt-2">
                  Try the sample file: <code className="font-mono">sample_inventory.csv</code>
                </p>
              </div>
            )}

            {/* Field Mapping */}
            {csvHeaders.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-400 mb-3">SAP Field Mapping</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {(SAMPLE_FIELDS[transaction] || []).map(sapField => (
                    <div key={sapField} className="flex items-center gap-2">
                      <div className="flex-1">
                        <p className="text-[10px] text-slate-500 mb-1 font-mono">{sapField}</p>
                        <Select value={mapping[sapField] || ""} onValueChange={v => setMapping(prev => ({ ...prev, [sapField]: v }))}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="— not mapped —" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">— not mapped —</SelectItem>
                            {csvHeaders.map(h => (
                              <SelectItem key={h} value={h}>{h}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Preview */}
            {parsedData.length > 0 && preview && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-slate-400">Data Preview (first 5 rows)</p>
                  <Button variant="ghost" size="sm" onClick={() => setPreview(!preview)}>
                    <Eye className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <div className="overflow-x-auto rounded-lg border border-[hsl(222_30%_18%)]">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-[hsl(222_30%_14%)]">
                        {csvHeaders.slice(0, 6).map(h => (
                          <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold text-slate-500">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {parsedData.slice(0, 5).map((row, i) => (
                        <tr key={i} className="border-t border-[hsl(222_30%_16%)]">
                          {csvHeaders.slice(0, 6).map(h => (
                            <td key={h} className="px-3 py-2 text-xs text-slate-400">{String(row[h] ?? "")}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            {parsedData.length > 0 && (
              <div className="flex items-center gap-3 flex-wrap pt-2">
                <Button onClick={() => handleSubmit(true)} disabled={uploading}>
                  <Play className="w-4 h-4" />
                  {uploading ? "Processing..." : `Simulate (${parsedData.length} records)`}
                </Button>
                <Button variant="outline" disabled>
                  <Zap className="w-4 h-4" />
                  Execute (requires approval)
                </Button>
                <p className="text-xs text-slate-500">
                  🔵 Simulation mode — no actual SAP changes
                </p>
              </div>
            )}
            {submitError && <div role="alert" className="rounded-lg border border-red-500/25 bg-red-500/5 px-3 py-2 text-xs text-red-300">{submitError}</div>}

            {/* Result */}
            {result && (
              <div className={cn(
                "p-4 rounded-xl border",
                result.errorCount === 0 ? "border-emerald-500/20 bg-emerald-500/5" :
                result.errorCount > result.successCount ? "border-red-500/20 bg-red-500/5" :
                "border-yellow-500/20 bg-yellow-500/5"
              )}>
                <div className="flex items-center gap-3">
                  {result.errorCount === 0 ? <CheckCircle className="w-5 h-5 text-emerald-400" /> : <AlertTriangle className="w-5 h-5 text-yellow-400" />}
                  <div>
                    <p className="text-sm font-semibold text-slate-200">
                      Simulation Complete — {result.status}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {result.successCount} succeeded · {result.errorCount} errors · Job ID: {result.jobId.slice(0, 8)}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Batch History */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Batch Job History</CardTitle>
                <p className="text-xs text-slate-500 mt-0.5">Recent BDC batch executions</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => void load()} disabled={loading} aria-label="Refresh batch history">
                <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {historyError ? (
              <div role="alert" className="m-4 flex items-center justify-between gap-3 rounded-lg border border-red-500/25 bg-red-500/5 p-4">
                <div><p className="text-sm font-medium text-red-300">Batch history could not be loaded</p><p className="mt-1 text-xs text-slate-400">{historyError}</p></div>
                <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>Retry</Button>
              </div>
            ) : jobs.length === 0 ? (
              <div className="text-center py-8">
                <FileCode2 className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-sm text-slate-400">No batch jobs yet</p>
              </div>
            ) : (
              <div className="divide-y divide-[hsl(222_30%_14%)]">
                {jobs.map(job => (
                  <div key={job.id} className="p-4 hover:bg-[hsl(222_30%_12%)] transition-colors">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-sm font-semibold text-slate-200 truncate">{job.name}</span>
                          <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full border", getStatusColor(job.status))}>
                            {job.status}
                          </span>
                          {job.simulationMode && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/10 border border-sky-500/20 text-sky-400">
                              SIMULATION
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-500">
                          <span>{job.fileName || "—"}</span>
                          <span>·</span>
                          <span className="font-mono text-[10px]">{job.sapTransaction}</span>
                          <span>·</span>
                          <span>{formatDate(job.createdAt, "relative")}</span>
                        </div>
                        {job.recordCount > 0 && (
                          <div className="flex items-center gap-3 mt-2">
                            <div className="flex-1 max-w-[200px]">
                              <Progress value={successRate(job)} className="h-1.5" />
                            </div>
                            <span className="text-xs text-slate-400">
                              <span className="text-emerald-400 font-medium">{job.successCount}</span> / {job.recordCount} records
                              {job.errorCount > 0 && <span className="text-red-400 ml-1">({job.errorCount} errors)</span>}
                            </span>
                          </div>
                        )}
                      </div>
                      {job.errorReport && job.errorReport.length > 0 && (
                        <Button variant="outline" size="sm" onClick={() => downloadErrorReport(job)}>
                          <Download className="w-3.5 h-3.5" />
                          Error Report
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Documentation */}
        <Card>
          <CardHeader>
            <CardTitle>SAP BDC Integration Reference</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {SAP_TRANSACTIONS.map(t => (
                <div key={t.value} className="p-4 rounded-xl bg-[hsl(222_30%_12%)] border border-[hsl(222_30%_18%)]">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-mono text-xs font-bold text-[hsl(185_84%_55%)]">{t.value}</span>
                  </div>
                  <p className="text-xs text-slate-400 mb-2">{t.label.split("—")[1]}</p>
                  <div className="space-y-0.5">
                    {SAMPLE_FIELDS[t.value].map(f => (
                      <p key={f} className="text-[10px] font-mono text-slate-500">• {f}</p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/15">
              <p className="text-xs text-yellow-400">
                ⚠️ <strong>ABAP BDC Boundary:</strong> All batch operations in this interface are simulated. For production SAP execution, coordinate with your SAP BASIS team to configure the authorized ABAP BDC adapter. Never execute arbitrary ABAP from LLM output.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
