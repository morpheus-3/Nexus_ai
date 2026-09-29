"use client";
import React, { useState, useRef, useEffect } from "react";
import { TopBar } from "@/components/layout/TopBar";
import { AgentRunButton } from "@/components/agents/AgentRunButton";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bot, Send, Package, ShieldAlert, FileCode2, Zap, Clock, ChevronDown, ChevronUp, Cpu } from "lucide-react";
import { formatDate, cn } from "@/lib/utils";
import { v4 as uuidv4 } from "uuid";

interface Message {
  role: "user" | "assistant";
  content: string;
  agent?: string;
  agentsInvoked?: string[];
  toolsUsed?: string[];
  executionMode?: string;
  responseSource?: string;
  responseModel?: string;
  fallbackReason?: string;
  diagnostic?: string;
  durationMs?: number;
  timestamp?: Date;
}

const SUGGESTED_PROMPTS = [
  { text: "Check inventory levels and flag anything below safety stock", agent: "supply_chain", icon: Package },
  { text: "Analyze recent invoices for fraud indicators and duplicates", agent: "fraud", icon: ShieldAlert },
  { text: "What is the status of recent BDC batch jobs?", agent: "bdc", icon: FileCode2 },
  { text: "Run a full supply chain and compliance review", agent: "multi_agent", icon: Cpu },
  { text: "Detect products below safety stock and draft replenishment requests", agent: "supply_chain", icon: Package },
  { text: "Identify suspicious vendor bank account changes", agent: "fraud", icon: ShieldAlert },
];

const agentColors: Record<string, string> = {
  supply_chain: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  fraud: "text-orange-400 bg-orange-400/10 border-orange-400/20",
  bdc: "text-violet-400 bg-violet-400/10 border-violet-400/20",
  multi_agent: "text-[hsl(185_84%_55%)] bg-[hsl(185_84%_45%)/10%] border-[hsl(185_84%_45%)/20%]",
};

const agentLabels: Record<string, string> = {
  supply_chain: "Supply Chain Agent",
  fraud: "Fraud & Compliance Agent",
  bdc: "BDC Automation Agent",
  multi_agent: "Multi-Agent Workflow",
};

function ToolsBadge({ tools, expanded, onToggle }: { tools: string[]; expanded: boolean; onToggle: () => void }) {
  return (
    <div className="mt-2">
      <button
        onClick={onToggle}
        className="flex items-center gap-1.5 text-[10px] text-slate-500 hover:text-slate-400 transition-colors"
      >
        {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        {tools.length} tool{tools.length !== 1 ? "s" : ""} invoked
      </button>
      {expanded && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {tools.map(t => (
            <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-[hsl(222_30%_14%)] border border-[hsl(222_30%_22%)] text-slate-400 font-mono">
              {t}()
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function MessageBubble({ msg }: { msg: Message }) {
  const [toolsExpanded, setToolsExpanded] = useState(false);

  if (msg.role === "user") {
    return (
      <div className="flex justify-end mb-4 animate-fadeIn">
        <div className="max-w-[80%] bg-[hsl(185_84%_45%)/15%] border border-[hsl(185_84%_45%)/20%] rounded-xl rounded-tr-sm px-4 py-3">
          <p className="text-sm text-slate-200">{msg.content}</p>
          {msg.timestamp && <p className="text-[10px] text-slate-500 mt-1 text-right">{formatDate(msg.timestamp, "relative")}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3 mb-4 animate-fadeIn">
      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[hsl(185_84%_45%)] to-[hsl(200_84%_35%)] flex items-center justify-center flex-shrink-0 mt-0.5">
        <Bot className="w-4 h-4 text-[hsl(222_47%_8%)]" />
      </div>
      <div className="flex-1 min-w-0">
        {/* Agent metadata */}
        {msg.agent && (
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border", agentColors[msg.agent] || "text-slate-400 bg-slate-400/10 border-slate-400/20")}>
              {agentLabels[msg.agent] || msg.agent}
            </span>
            {msg.executionMode && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 font-medium">
                🔵 {msg.executionMode.toUpperCase()}
              </span>
            )}
            {msg.responseSource && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300 font-medium">
                {msg.responseSource === "groq" ? `GROQ${msg.responseModel ? ` · ${msg.responseModel}` : ""}` : msg.responseSource === "mixed" ? "MIXED SOURCES" : msg.responseSource === "deterministic_fallback" ? `DETERMINISTIC FALLBACK${msg.fallbackReason ? ` · ${msg.fallbackReason}` : ""}` : "DETERMINISTIC AGENT"}
              </span>
            )}
            {msg.diagnostic && <span role="status" className="text-[10px] text-amber-300">{msg.diagnostic}</span>}
            {msg.durationMs && (
              <span className="text-[10px] text-slate-500 flex items-center gap-0.5">
                <Clock className="w-3 h-3" /> {(msg.durationMs / 1000).toFixed(2)}s
              </span>
            )}
          </div>
        )}

        {/* Message content */}
        <div className="rounded-xl rounded-tl-sm border border-[hsl(222_30%_18%)] bg-[hsl(222_40%_10%)] px-4 py-3">
          <div className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed prose-sm max-w-none"
            dangerouslySetInnerHTML={{
              __html: msg.content
                .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
                .replace(/\*\*([^*]+)\*\*/g, '<strong class="text-slate-100">$1</strong>')
                .replace(/^### (.+)$/gm, '<h3 class="text-sm font-semibold text-slate-200 mt-3 mb-1">$1</h3>')
                .replace(/^## (.+)$/gm, '<h2 class="text-base font-bold text-white mt-3 mb-2 gradient-text">$1</h2>')
                .replace(/^- (.+)$/gm, '<div class="flex gap-2 my-0.5"><span class="text-[hsl(185_84%_55%)] mt-0.5">•</span><span>$1</span></div>')
                .replace(/^(\d+)\. (.+)$/gm, '<div class="flex gap-2 my-0.5"><span class="text-[hsl(185_84%_55%)] font-semibold min-w-[1rem]">$1.</span><span>$2</span></div>')
                .replace(/^> (.+)$/gm, '<blockquote class="border-l-2 border-yellow-500/50 pl-3 text-yellow-300/80 italic text-xs my-2">$1</blockquote>')
                .replace(/\n\n/g, '<div class="my-2"></div>')
                .replace(/\n/g, '<br />')
            }}
          />
        </div>

        {/* Tools */}
        {msg.toolsUsed && msg.toolsUsed.length > 0 && (
          <ToolsBadge tools={msg.toolsUsed} expanded={toolsExpanded} onToggle={() => setToolsExpanded(!toolsExpanded)} />
        )}
        {msg.timestamp && <p className="text-[10px] text-slate-600 mt-1">{formatDate(msg.timestamp, "relative")}</p>}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex gap-3 mb-4 animate-fadeIn">
      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[hsl(185_84%_45%)] to-[hsl(200_84%_35%)] flex items-center justify-center flex-shrink-0">
        <Bot className="w-4 h-4 text-[hsl(222_47%_8%)]" />
      </div>
      <div className="rounded-xl rounded-tl-sm border border-[hsl(222_30%_18%)] bg-[hsl(222_40%_10%)] px-4 py-3 flex items-center gap-1">
        {[0, 1, 2].map(i => (
          <div key={i} className="typing-dot w-1.5 h-1.5 rounded-full bg-[hsl(185_84%_45%)]" style={{ animationDelay: `${i * 0.2}s` }} />
        ))}
      </div>
    </div>
  );
}

export default function CommandPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "## Welcome to SAP Nexus AI Command Center\n\nI'm your enterprise AI supervisor. I can route your requests to specialized agents:\n\n- **📦 Supply Chain Agent** — Inventory, purchase orders, replenishment\n- **🔍 Fraud & Compliance Agent** — Invoice analysis, risk scoring, vendor checks\n- **🤖 BDC Automation Agent** — Batch data communication, file processing\n\nI'll automatically determine which agent(s) to invoke based on your request. Try one of the suggested prompts below or type your own question.",
      agent: "multi_agent",
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    const handle = window.requestAnimationFrame(() => setSessionId(uuidv4()));
    return () => window.cancelAnimationFrame(handle);
  }, []);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading || !sessionId) return;
    const userMsg: Message = { role: "user", content: text.trim(), timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text.trim(), sessionId }),
      });
      const data = await res.json();
      if (res.ok) {
        const assistantMsg: Message = {
          role: "assistant",
          content: data.response,
          agent: data.agent,
          agentsInvoked: data.agentsInvoked,
          toolsUsed: data.toolsUsed,
          executionMode: data.executionMode,
          responseSource: data.responseSource,
          responseModel: data.responseModel,
          fallbackReason: data.fallbackReason,
          diagnostic: data.diagnostic,
          durationMs: data.durationMs,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, assistantMsg]);
      } else {
        setMessages(prev => [...prev, {
          role: "assistant",
          content: data.response || `Error: ${data.error || "Agent failed to respond"}`,
          diagnostic: data.diagnostic,
          responseSource: data.responseSource,
          responseModel: data.responseModel,
          fallbackReason: data.fallbackReason,
          timestamp: new Date(),
        }]);
      }
    } catch {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "Network error. Please check your connection and try again.",
        timestamp: new Date(),
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <div className="flex flex-col h-full animate-fadeIn">
      <TopBar
        title="AI Command Center"
        subtitle="Multi-agent supervisor · LangGraph orchestration"
        actions={<div className="flex items-center gap-2"><AgentRunButton agent="supply_chain"/><AgentRunButton agent="fraud"/><div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="text-[10px] font-semibold text-emerald-400">AGENTS READY</span>
          </div></div>}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Main chat */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-0">
            {messages.map((msg, i) => (
              <MessageBubble key={i} msg={msg} />
            ))}
            {loading && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </div>

          {/* Suggested prompts */}
          {messages.length <= 1 && !loading && (
            <div className="px-4 pb-3">
              <p className="text-xs text-slate-500 mb-2 font-medium">Suggested prompts:</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {SUGGESTED_PROMPTS.map(p => {
                  const Icon = p.icon;
                  return (
                    <button
                      key={p.text}
                      onClick={() => sendMessage(p.text)}
                      className="text-left p-3 rounded-xl border border-[hsl(222_30%_18%)] bg-[hsl(222_40%_10%)] hover:border-[hsl(185_84%_45%)/30%] hover:bg-[hsl(222_30%_14%)] transition-all group"
                    >
                      <div className="flex items-start gap-2">
                        <Icon className="w-3.5 h-3.5 text-[hsl(185_84%_55%)] mt-0.5 flex-shrink-0" />
                        <span className="text-xs text-slate-400 group-hover:text-slate-300">{p.text}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Input */}
          <div className="border-t border-[hsl(222_30%_18%)] p-4">
            <div className="flex gap-2 items-end">
              <div className="flex-1 relative">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about inventory, invoices, fraud, BDC automation..."
                  rows={1}
                  disabled={loading}
                  className="w-full px-4 py-2.5 pr-12 rounded-xl border border-[hsl(222_30%_22%)] bg-[hsl(222_30%_14%)] text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-[hsl(185_84%_45%)] focus:border-[hsl(185_84%_45%)] resize-none disabled:opacity-50 transition-colors"
                  style={{ minHeight: "44px", maxHeight: "120px" }}
                  onInput={e => {
                    const t = e.target as HTMLTextAreaElement;
                    t.style.height = "auto";
                    t.style.height = Math.min(t.scrollHeight, 120) + "px";
                  }}
                />
              </div>
              <Button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || loading}
                size="icon"
                className="h-11 w-11 rounded-xl"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-[10px] text-slate-600 mt-1.5 px-1">
              Press Enter to send · Shift+Enter for new line · All operations are simulated
            </p>
          </div>
        </div>

        {/* Sidebar: Agent status */}
        <div className="hidden xl:flex flex-col w-64 border-l border-[hsl(222_30%_18%)] bg-[hsl(222_47%_8%)] p-4 gap-4">
          <div>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Agent Status</h3>
            <div className="space-y-2">
              {[
                { name: "Supervisor", color: "text-[hsl(185_84%_55%)]", status: "ready" },
                { name: "Supply Chain", color: "text-emerald-400", status: "ready" },
                { name: "Fraud & Compliance", color: "text-orange-400", status: "ready" },
                { name: "BDC Automation", color: "text-violet-400", status: "ready" },
              ].map(agent => (
                <div key={agent.name} className="flex items-center justify-between p-2.5 rounded-lg bg-[hsl(222_40%_10%)] border border-[hsl(222_30%_18%)]">
                  <div className="flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full ${loading ? "animate-pulse bg-yellow-400" : "bg-emerald-400"}`} />
                    <span className="text-xs text-slate-300">{agent.name}</span>
                  </div>
                  <span className="text-[10px] text-slate-500">{loading ? "running" : agent.status}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Session Info</h3>
            <div className="space-y-2 text-xs text-slate-500">
              <div className="flex justify-between">
                <span>Messages</span>
                <span className="text-slate-300">{messages.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Session ID</span>
                <span className="text-slate-300 font-mono">{sessionId ? `${sessionId.slice(0, 8)}…` : "Initializing…"}</span>
              </div>
              <div className="flex justify-between">
                <span>Mode</span>
                <span className="text-sky-400">Simulated</span>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Demo Scenarios</h3>
            <div className="space-y-1.5">
              {[
                "Safety stock check",
                "Invoice fraud scan",
                "Full Q4 review",
                "Vendor risk analysis",
              ].map(s => (
                <button
                  key={s}
                  onClick={() => sendMessage(s === "Safety stock check" ? "Check all materials below safety stock and draft replenishment requests" : s === "Invoice fraud scan" ? "Analyze recent invoices for fraud indicators and duplicates" : s === "Full Q4 review" ? "Run a comprehensive supply chain and fraud compliance review for Q4" : "Check vendor risk scores and identify watchlist vendors")}
                  className="w-full text-left text-xs px-2.5 py-2 rounded-lg border border-[hsl(222_30%_18%)] text-slate-400 hover:text-slate-200 hover:bg-[hsl(222_30%_14%)] transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
