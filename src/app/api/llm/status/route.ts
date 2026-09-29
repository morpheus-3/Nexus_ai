import { NextResponse } from "next/server";
import { getGroqModel, isGroqConfigured } from "@/lib/groq";
import { generateWithGroq } from "@/lib/groq";

export async function GET() {
  return NextResponse.json({
    provider: "groq",
    model: getGroqModel(),
    apiKeyConfigured: isGroqConfigured(),
    fallback: "deterministic",
  });
}

export async function POST() {
  const result = await generateWithGroq(
    "Return the exact text GROQ_CONNECTION_OK and nothing else.",
    JSON.stringify({ check: "provider_connectivity" }),
  );
  return NextResponse.json({
    provider: "groq",
    model: result.model,
    apiKeyConfigured: isGroqConfigured(),
    liveRequestSucceeded: result.source === "groq",
    responseSource: result.source,
    fallbackReason: result.fallbackReason,
    diagnostic: result.diagnostic,
  }, { status: result.source === "groq" ? 200 : 502 });
}
