import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { agentRuns, chatMessages, auditLog } from "@/db/schema";
import { runSupervisor } from "@/lib/agents";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";

const schema = z.object({
  message: z.string().min(1).max(2000),
  sessionId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, sessionId: rawSessionId } = schema.parse(body);
    const sessionId = rawSessionId || uuidv4();

    // Save user message
    await db.insert(chatMessages).values({
      sessionId,
      role: "user",
      content: message,
    });

    // Run supervisor
    const result = await runSupervisor(message);

    // Save agent run
    const [agentRun] = await db.insert(agentRuns).values({
      runId: uuidv4(),
      sessionId,
      userMessage: message,
      supervisorDecision: result.agent,
      agentsInvoked: JSON.stringify(result.agentsInvoked),
      toolsUsed: JSON.stringify(result.toolsUsed),
      response: result.response,
      structuredOutput: result.structuredOutput ? JSON.stringify(result.structuredOutput) : undefined,
      status: result.status,
      executionMode: result.executionMode,
      durationMs: result.durationMs,
      completedAt: new Date(),
    }).returning();

    // Save assistant message
    await db.insert(chatMessages).values({
      sessionId,
      role: "assistant",
      content: result.response,
      agentRunId: agentRun.id,
    });

    // Audit log
    await db.insert(auditLog).values({
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
      },
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
    }, { status: result.status === "failed" ? 502 : 200 });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    console.error("Agent chat failed", { errorType: e instanceof Error ? e.name : "unknown" });
    return NextResponse.json({ error: "Agent failed" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("sessionId");

  if (!sessionId) {
    // Return recent sessions
    const runs = await db.select().from(agentRuns).orderBy(agentRuns.createdAt).limit(20);
    return NextResponse.json({ runs });
  }

  const messages = await db.select().from(chatMessages)
    .where(eq(chatMessages.sessionId, sessionId))
    .orderBy(chatMessages.createdAt);

  return NextResponse.json({ messages });
}
