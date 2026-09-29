"use client";
import React, { useState, useEffect } from "react";
import { TopBar } from "@/components/layout/TopBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { Shield, Cpu, Database, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Settings {
  llm_provider?: string;
  llm_model?: string;
  safety_stock_threshold_pct?: number;
  fraud_risk_score_threshold?: number;
  sap_base_url?: string;
  sap_client?: string;
  bdc_batch_size?: number;
  simulation_mode?: boolean;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [llmStatus, setLlmStatus] = useState<{provider:string;model:string;apiKeyConfigured:boolean;fallback:string} | null>(null);
  const [llmTest, setLlmTest] = useState<{liveRequestSucceeded:boolean;fallbackReason?:string;diagnostic?:string} | null>(null);
  const [testingLlm, setTestingLlm] = useState(false);

  const load = async () => {
    try {
      const res = await fetch("/api/settings");
      const d = await res.json();
      setSettings(d.settings || {});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); fetch("/api/llm/status").then(r => r.json()).then(setLlmStatus).catch(() => setLlmStatus(null)); }, []);

  const saveSetting = async (key: string, value: unknown) => {
    setSaving(key);
    try {
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value }),
      });
      setSaved(key);
      setTimeout(() => setSaved(null), 2000);
    } finally {
      setSaving(null);
    }
  };

  const testGroq = async () => {
    setTestingLlm(true);
    try {
      const response = await fetch("/api/llm/status", { method: "POST" });
      setLlmTest(await response.json());
    } catch {
      setLlmTest({ liveRequestSucceeded: false, fallbackReason: "network_error", diagnostic: "Could not reach the application server." });
    } finally {
      setTestingLlm(false);
    }
  };


  if (loading) {
    return (
      <div>
        <TopBar title="Settings" />
        <div className="p-6 space-y-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-32 rounded-xl shimmer-bg" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fadeIn">
      <TopBar
        title="Settings & Configuration"
        subtitle="LLM provider, thresholds & integrations"
      />

      <div className="p-6 space-y-6">

        {/* AI / LLM Config */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Cpu className="w-4 h-4 text-[hsl(185_84%_55%)]" />AI Agent Configuration</CardTitle>
            <p className="text-xs text-slate-500">All LLM generated agent narratives use Groq. Deterministic analysis remains available as fallback.</p>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-300">
            <p>Provider: <strong>Groq</strong></p>
            <p>Model: <code className="font-mono">{llmStatus?.model || "qwen/qwen3.8-27b"}</code></p>
            <p>API key: <strong className={llmStatus?.apiKeyConfigured ? "text-emerald-400" : "text-amber-400"}>{llmStatus ? (llmStatus.apiKeyConfigured ? "configured" : "not configured; deterministic fallback active") : "status unavailable"}</strong></p>
            <p>Live provider request: <strong className={llmTest?.liveRequestSucceeded ? "text-emerald-400" : llmTest ? "text-amber-400" : "text-slate-400"}>{llmTest ? (llmTest.liveRequestSucceeded ? "succeeded" : `failed (${llmTest.fallbackReason})`) : "not tested this session"}</strong></p>
            {llmTest?.diagnostic && <p role="status" className="text-xs text-amber-300">{llmTest.diagnostic}</p>}
            <Button size="sm" variant="outline" onClick={testGroq} disabled={testingLlm}>{testingLlm ? "Testing Groq…" : "Test Groq connection"}</Button>
            <p className="text-xs text-slate-500">Configure GROQ_API_KEY and GROQ_MODEL in the server environment. Secrets are never displayed. Agent findings are computed locally; only aggregate counts are sent to Groq for narrative summaries.</p>
          </CardContent>
        </Card>
        {/* Thresholds */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-[hsl(185_84%_55%)]" />
              Business Thresholds
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-400 mb-1.5">Safety Stock Alert Threshold (%)</p>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    value={settings.safety_stock_threshold_pct || 20}
                    onChange={e => setSettings(prev => ({ ...prev, safety_stock_threshold_pct: Number(e.target.value) }))}
                    min={0} max={100}
                  />
                  <Button size="sm" onClick={() => saveSetting("safety_stock_threshold_pct", settings.safety_stock_threshold_pct)} disabled={saving === "safety_stock_threshold_pct"}>
                    {saved === "safety_stock_threshold_pct" ? <CheckCircle className="w-4 h-4" /> : "Save"}
                  </Button>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">Alert when stock is below this % of safety level</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1.5">Fraud Risk Score Threshold</p>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    value={settings.fraud_risk_score_threshold || 65}
                    onChange={e => setSettings(prev => ({ ...prev, fraud_risk_score_threshold: Number(e.target.value) }))}
                    min={0} max={100}
                  />
                  <Button size="sm" onClick={() => saveSetting("fraud_risk_score_threshold", settings.fraud_risk_score_threshold)} disabled={saving === "fraud_risk_score_threshold"}>
                    {saved === "fraud_risk_score_threshold" ? <CheckCircle className="w-4 h-4" /> : "Save"}
                  </Button>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">Invoices above this score are flagged high-risk</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1.5">BDC Batch Size</p>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    value={settings.bdc_batch_size || 50}
                    onChange={e => setSettings(prev => ({ ...prev, bdc_batch_size: Number(e.target.value) }))}
                    min={1} max={500}
                  />
                  <Button size="sm" onClick={() => saveSetting("bdc_batch_size", settings.bdc_batch_size)} disabled={saving === "bdc_batch_size"}>
                    {saved === "bdc_batch_size" ? <CheckCircle className="w-4 h-4" /> : "Save"}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* SAP Integration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-4 h-4 text-[hsl(185_84%_55%)]" />
              SAP Integration
            </CardTitle>
            <p className="text-xs text-slate-500">Currently in mock/simulation mode. Configure real SAP credentials to connect.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-3 rounded-lg bg-sky-500/5 border border-sky-500/20 text-xs text-sky-300">
              🔵 <strong>Simulation Mode Active</strong> — All SAP operations are mocked. No data is written to a real SAP system.
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-400 mb-1.5">SAP OData Base URL</p>
                <Input
                  value={settings.sap_base_url || ""}
                  onChange={e => setSettings(prev => ({ ...prev, sap_base_url: e.target.value }))}
                  placeholder="https://your-sap-server:8000/sap/opu/odata/..."
                />
                <p className="text-[10px] text-slate-500 mt-1">Leave empty for mock mode</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1.5">SAP Client</p>
                <Input
                  value={settings.sap_client || "100"}
                  onChange={e => setSettings(prev => ({ ...prev, sap_client: e.target.value }))}
                  placeholder="100"
                />
              </div>
            </div>
            <Button onClick={() => { saveSetting("sap_base_url", settings.sap_base_url); saveSetting("sap_client", settings.sap_client); }}>
              Save SAP Configuration
            </Button>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
