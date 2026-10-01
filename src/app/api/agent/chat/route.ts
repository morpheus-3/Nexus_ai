import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { agentRuns, chatMessages, auditLog } from "@/db/schema";
import { runSupervisor } from "@/lib/agents";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";

const schema = z.object({
  message: z.string().trim().min(1).max(2000),
  sessionId: z.string().min(1).max(100).optional(),
  aiPlanning: z.boolean().default(false),
});

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, sessionId: rawSessionId, aiPlanning } = schema.parse(body);
    const sessionId = rawSessionId || uuidv4();

    const result = await runSupervisor(message, undefined, aiPlanning);
    const agentRun = await db.transaction(async tx => {
      // Save user message
      await tx.insert(chatMessages).values({
        sessionId,
        role: "user",
        content: message,
      });

      // Save agent run
      const [agentRun] = await tx.insert(agentRuns).values({
        runId: uuidv4(),
        sessionId,
        userMessage: message,
        supervisorDecision: result.agent,
        agentsInvoked: result.agentsInvoked,
        toolsUsed: result.toolsUsed,
        response: result.response,
        structuredOutput: result.structuredOutput,
        status: result.status,
        executionMode: result.executionMode,
        durationMs: result.durationMs,
        completedAt: new Date(),
      }).returning();

      // Save assistant message
      await tx.insert(chatMessages).values({
        sessionId,
        role: "assistant",
        content: result.response,
        agentRunId: agentRun.id,
        metadata: { execution: result.execution, responseSource: result.responseSource, responseModel: result.responseModel },
      });

      // Audit log
      await tx.insert(auditLog).values({
        action: result.status === "completed" ? "agent_run_completed" : "agent_run_failed",
        resourceType: "agent_run",
        resourceId: String(agentRun.id),
        description: `Agent run ${result.status}: ${result.agent} (${result.durationMs}ms)`,
        severity: result.status === "failed" ? "error" : "info",
        metadata: {
          responseSource: result.responseSource,
          responseModel: result.responseModel,
          fallbackReason: result.fallbackReason,
          toolsUsed: result.toolsUsed,
          plannerSource: result.execution?.plan.source,
          plannerFallbackReason: result.execution?.plan.fallbackReason,
        },
      });
      return agentRun;
    });

    return NextResponse.json({
      sessionId,
      agentRunId: agentRun.id,
      agent: result.agent,
      agentsInvoked: result.agentsInvoked,
      toolsUsed: result.toolsUsed,
      response: result.response,
      executionMode: result.executionMode,
      responseSource: result.responseSource,
      responseModel: result.responseModel,
      fallbackReason: result.fallbackReason,
      diagnostic: result.diagnostic,
      status: result.status,
      durationMs: result.durationMs,
      execution: result.execution,
    }, { status: result.status === "failed" ? 502 : 200 });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    if (e instanceof SyntaxError) return NextResponse.json({ error: "Request body must contain valid JSON" }, { status: 400 });
    console.error("Agent chat failed", { errorType: e instanceof Error ? e.name : "unknown" });
    return NextResponse.json({ error: "Agent failed" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("sessionId");

  if (!sessionId) {
    // Return recent sessions
    const runs = await db.select().from(agentRuns).orderBy(desc(agentRuns.createdAt)).limit(20);
    return NextResponse.json({ runs });
  }

  const messages = await db.select().from(chatMessages)
    .where(eq(chatMessages.sessionId, sessionId))
    .orderBy(chatMessages.createdAt);

  return NextResponse.json({ messages });
}
