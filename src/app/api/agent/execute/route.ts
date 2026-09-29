import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { agentRuns, approvalRequests, auditLog } from "@/db/schema";
import { runFraudAgent, runSupplyChainAgent } from "@/lib/agents";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";

const schema = z.object({ agent: z.enum(["supply_chain", "fraud"]) });

export async function POST(req: NextRequest) {
  try {
    const { agent } = schema.parse(await req.json());
    const prompt = agent === "fraud"
      ? "Review imported invoices and vendors for fraud, duplicates, and risk"
      : "Analyze imported inventory and purchase orders for low stock and delayed delivery";
    const result = agent === "fraud" ? await runFraudAgent(prompt) : await runSupplyChainAgent(prompt);
    const output = result.structuredOutput || {};
    const data = output as Record<string, unknown>;
    const approvalIds: number[] = [];

    const [run] = await db.transaction(async tx => {
      const [agentRun] = await tx.insert(agentRuns).values({
        runId: uuidv4(),
        userMessage: prompt,
        supervisorDecision: agent,
        agentsInvoked: result.agentsInvoked,
        toolsUsed: result.toolsUsed,
        response: result.response,
        structuredOutput: output,
        status: result.status,
        executionMode: result.executionMode,
        durationMs: result.durationMs,
        completedAt: new Date(),
      }).returning();

      const approvals: Array<{ title: string; type: "purchase_requisition" | "payment_block"; payload: Record<string, unknown> }> = [];
      if (result.status === "completed" && agent === "fraud") {
        const invoiceIds = Array.isArray(data.recommendedBlockInvoiceIds)
          ? data.recommendedBlockInvoiceIds.filter((id): id is number => Number.isInteger(id))
          : [];
        if (invoiceIds.length > 0) approvals.push({
          title: `Review payment block recommendations from run ${agentRun.id}`,
          type: "payment_block",
          payload: { agentRunId: agentRun.id, agent, invoiceIds },
        });
      }
      if (result.status === "completed" && agent === "supply_chain") {
        const recommendations = data.requisitionRecommendations as { reviewExisting?: Array<{ prNumber?: unknown }> } | undefined;
        const prNumbers = [...new Set((recommendations?.reviewExisting || [])
          .map(item => item.prNumber)
          .filter((prNumber): prNumber is string => typeof prNumber === "string"))];
        for (const prNumber of prNumbers) approvals.push({
          title: `Review existing purchase requisition ${prNumber}`,
          type: "purchase_requisition",
          payload: { agentRunId: agentRun.id, agent, prNumber },
        });
      }

      for (const request of approvals) {
        const [approval] = await tx.insert(approvalRequests).values({
          requestId: uuidv4(),
          type: request.type,
          title: request.title,
          description: `Agent run ${agentRun.id} recommends human review. This is a simulated workflow; no SAP transaction was executed.`,
          requestedByName: "Agent",
          status: "pending",
          priority: "high",
          payload: request.payload,
        }).returning({ id: approvalRequests.id });
        approvalIds.push(approval.id);
      }

      await tx.insert(auditLog).values({
        action: "agent_execution",
        resourceType: "agent_run",
        resourceId: String(agentRun.id),
        description: `${agent} agent ${result.status} in ${result.executionMode} mode; ${result.toolsUsed.length} tools called.${approvalIds.length ? ` ${approvalIds.length} approval request(s) created.` : ""}`,
        severity: result.status === "failed" ? "error" : "info",
        metadata: {
          toolsUsed: result.toolsUsed,
          approvalIds,
          responseSource: result.responseSource,
          responseModel: result.responseModel,
          fallbackReason: result.fallbackReason,
        },
      });
      return [agentRun];
    });

    return NextResponse.json({
      agentRunId: run.id,
      agent,
      status: result.status,
      executionMode: result.executionMode,
      responseSource: result.responseSource,
      responseModel: result.responseModel,
      fallbackReason: result.fallbackReason,
      diagnostic: result.diagnostic,
      toolsUsed: result.toolsUsed,
      response: result.response,
      structuredOutput: result.structuredOutput,
      approvalIds,
      approvalId: approvalIds[0],
    }, { status: result.status === "failed" ? 502 : 200 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid agent" }, { status: 400 });
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Request body must contain valid JSON" }, { status: 400 });
    console.error("Agent execute failed", { errorType: error instanceof Error ? error.name : "unknown" });
    return NextResponse.json({ error: "Agent execution could not be persisted. Check the database and server logs." }, { status: 500 });
  }
}
