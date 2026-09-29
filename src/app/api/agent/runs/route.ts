import { NextResponse } from "next/server";
import { db } from "@/db";
import { agentRuns } from "@/db/schema";
import { desc } from "drizzle-orm";

export async function GET() {
  try {
    const runs = await db.select().from(agentRuns).orderBy(desc(agentRuns.createdAt)).limit(30);

    // Drizzle already decodes jsonb columns. Only parse legacy string values.
    const enriched = runs.map(run => ({
      ...run,
      agentsInvoked: parseStringArray(run.agentsInvoked, "agentsInvoked"),
      toolsUsed: parseStringArray(run.toolsUsed, "toolsUsed"),
      structuredOutput: parseJsonColumn<unknown>(run.structuredOutput, null),
    }));

    return NextResponse.json({ runs: enriched });
  } catch (error) {
    console.error("Agent runs API failed", { errorType: error instanceof Error ? error.name : "unknown" });
    return NextResponse.json(
      { error: "Unable to load agent runs" },
      { status: 500 },
    );
  }
}

function parseJsonColumn<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value !== "string") return value as T;
  return JSON.parse(value) as T;
}

function parseStringArray(value: unknown, column: string): string[] {
  const parsed = parseJsonColumn<unknown>(value, []);
  if (!Array.isArray(parsed) || !parsed.every(item => typeof item === "string")) {
    throw new Error(`Invalid ${column} data in agent run`);
  }
  return parsed;
}
