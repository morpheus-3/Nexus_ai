export const DEFAULT_GROQ_MODEL = "qwen/qwen3.8-27b";
const GROQ_CHAT_COMPLETIONS_URL = "https://api.groq.com/openai/v1/chat/completions";

export type GenerationSource = "groq" | "deterministic_fallback" | "deterministic_agent";
export type FallbackReason = "missing_api_key" | "invalid_api_key" | "rate_limited" | "timeout" | "network_error" | "invalid_model" | "malformed_response" | "provider_error";

export interface GroqGeneration {
  source: "groq" | "deterministic_fallback";
  model: string;
  content?: string;
  fallbackReason?: FallbackReason;
  diagnostic?: string;
}

export function getGroqModel(): string {
  return process.env.GROQ_MODEL?.trim() || DEFAULT_GROQ_MODEL;
}

export function isGroqConfigured(): boolean {
  return Boolean(process.env.GROQ_API_KEY?.trim());
}

export async function generateWithGroq(
  systemPrompt: string,
  userPrompt: string,
  fetcher: typeof fetch = fetch,
): Promise<GroqGeneration> {
  const model = getGroqModel();
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) return { source: "deterministic_fallback", model, fallbackReason: "missing_api_key", diagnostic: "Set GROQ_API_KEY on the application server to enable Groq narratives." };

  try {
    const response = await fetcher(GROQ_CHAT_COMPLETIONS_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.2,
        max_tokens: 700,
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      const failure = categorizeHttpFailure(response.status, await readProviderError(response));
      console.error("Groq request failed", { status: response.status, model, reason: failure.fallbackReason });
      return { source: "deterministic_fallback", model, ...failure };
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      console.error("Groq returned malformed JSON", { model });
      return { source: "deterministic_fallback", model, fallbackReason: "malformed_response", diagnostic: "Groq returned a response that was not valid JSON." };
    }
    const content = readCompletionContent(body);
    if (!content) {
      console.error("Groq returned no usable completion", { model });
      return { source: "deterministic_fallback", model, fallbackReason: "malformed_response", diagnostic: "Groq returned JSON without a usable completion." };
    }
    return { source: "groq", model, content };
  } catch (error) {
    const timeout = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    const reason: FallbackReason = timeout ? "timeout" : "network_error";
    console.error("Groq request unavailable", { model, reason });
    return { source: "deterministic_fallback", model, fallbackReason: reason, diagnostic: timeout ? "The Groq request timed out. Retry the request or check provider availability." : "Could not reach Groq. Check server network access and retry." };
  }
}

function categorizeHttpFailure(status: number, providerCode?: string): Pick<GroqGeneration, "fallbackReason" | "diagnostic"> {
  if (status === 401 || status === 403) return { fallbackReason: "invalid_api_key", diagnostic: "Groq rejected the API key. Verify GROQ_API_KEY and its account access." };
  if (status === 429) return { fallbackReason: "rate_limited", diagnostic: "Groq rate limit or quota was reached. Wait or check the Groq account limits." };
  if (status === 408 || status === 504) return { fallbackReason: "timeout", diagnostic: "Groq timed out. Retry the request or check provider availability." };
  if ((status === 400 || status === 404) && (!providerCode || providerCode.toLowerCase().includes("model") || providerCode.toLowerCase().includes("not_found"))) return { fallbackReason: "invalid_model", diagnostic: "Groq could not find GROQ_MODEL for this account. Choose an active Groq model and verify its account access." };
  if (status === 400) return { fallbackReason: "provider_error", diagnostic: "Groq rejected the request. Check the configured model and request compatibility." };
  return { fallbackReason: "provider_error", diagnostic: `Groq returned HTTP ${status}. Check provider status and account limits.` };
}

async function readProviderError(response: Response): Promise<string | undefined> {
  try {
    const body: unknown = await response.json();
    if (body && typeof body === "object" && "error" in body) {
      const error = (body as { error?: unknown }).error;
      if (error && typeof error === "object" && "code" in error && typeof (error as { code?: unknown }).code === "string") return (error as { code: string }).code;
    }
  } catch {
    // The HTTP status still gives a safe classification when an error body is malformed.
  }
  return undefined;
}

function readCompletionContent(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  const choices = (value as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || !choices[0] || typeof choices[0] !== "object") return undefined;
  const message = (choices[0] as { message?: unknown }).message;
  if (!message || typeof message !== "object") return undefined;
  const content = (message as { content?: unknown }).content;
  return typeof content === "string" && content.trim() ? content.trim() : undefined;
}
