import type { AgentExecution } from "@/lib/agent-planner";

export function ExecutionTrace({ execution }: { execution?: AgentExecution }) {
  if (!execution) return null;
  return (
    <details className="my-3 rounded-lg border border-slate-700 bg-slate-900/50 p-3 text-xs" open>
      <summary className="cursor-pointer font-medium text-slate-200">
        Plan & execution · {execution.plan.source === "groq" ? "AI planner" : "Local planner"} · {execution.steps.length} steps
      </summary>
      {execution.plan.model && <p className="mt-2 text-slate-400">Planner model: {execution.plan.model}</p>}
      {execution.plan.fallbackReason && <p role="status" className="mt-2 text-amber-300">AI planning unavailable ({execution.plan.fallbackReason}). Local routing was used.</p>}
      {!execution.steps.length && <p className="mt-2 text-slate-400">No analysis tools were called. More detail is needed to select a supported analysis.</p>}
      <ol className="mt-2 space-y-3">
        {execution.steps.map((step, index) => (
          <li key={step.tool}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-slate-200">{index + 1}. {step.label}</span>
              <span className={step.status === "failed" ? "text-red-300" : "text-emerald-300"}>{step.status}</span>
              <span className="text-slate-500">{(step.durationMs / 1000).toFixed(2)}s</span>
            </div>
            <p className="mt-1 text-slate-400">{step.reason}</p>
            <p className="text-slate-400">{step.summary}</p>
            {step.toolsUsed.length > 0 && <p className="mt-1 break-words font-mono text-[10px] text-slate-500">Operations attempted: {step.toolsUsed.join(", ")}</p>}
          </li>
        ))}
      </ol>
      <p className="mt-3 text-slate-500">Read-only analysis. No approval requests or business changes were created by this chat.</p>
    </details>
  );
}
