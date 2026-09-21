const NIM_BASE_URL = (process.env.NVIDIA_BASE_URL ?? "https://integrate.api.nvidia.com/v1").replace(/\/+$/, "");

export type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };

export type ChatMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

export type ToolDefinition = {
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
};

export type ChatStep = {
  content: string;
  toolCalls: ToolCall[];
  finishReason: string | null;
  promptTokens: number | null;
  completionTokens: number | null;
  durationMs: number;
};

export type ChatResult = {
  text: string;
  promptTokens: number | null;
  completionTokens: number | null;
  durationMs: number;
};

export class NimError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NimError";
  }
}

class TransientNimError extends NimError {}

type RequestOptions = { maxTokens: number; timeoutMs: number; tools?: ToolDefinition[]; toolChoice?: "auto" | "none" };

/** NVIDIA's free tier throws occasional 5xx errors; one retry clears most of them. */
export async function chatStep(model: string, messages: ChatMessage[], options: RequestOptions): Promise<ChatStep> {
  try {
    return await requestOnce(model, messages, options);
  } catch (error) {
    if (!(error instanceof TransientNimError)) throw error;
    await new Promise((resolve) => setTimeout(resolve, 3000));
    return requestOnce(model, messages, options);
  }
}

/** A single plain-text answer with no tools. */
export async function chatCompletion(model: string, messages: ChatMessage[], options: RequestOptions): Promise<ChatResult> {
  const step = await chatStep(model, messages, { ...options, tools: undefined });
  if (!step.content) throw new NimError(emptyAnswerMessage(step.finishReason));
  return { text: step.content, promptTokens: step.promptTokens, completionTokens: step.completionTokens, durationMs: step.durationMs };
}

export function emptyAnswerMessage(finishReason: string | null): string {
  // Reasoning models think before answering; if thinking fills the budget, no answer arrives.
  return finishReason === "length"
    ? "The model used its whole token budget thinking and never got to an answer."
    : "The model returned an empty answer.";
}

async function requestOnce(model: string, messages: ChatMessage[], options: RequestOptions): Promise<ChatStep> {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) throw new NimError("NVIDIA_API_KEY is not set on the server.");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs);
  const startedAt = Date.now();

  try {
    const response = await fetch(`${NIM_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: options.maxTokens,
        temperature: 0.8,
        ...(options.tools?.length ? { tools: options.tools, tool_choice: options.toolChoice ?? "auto" } : {}),
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      if (response.status === 404 || response.status === 410) throw new NimError(`The model ${model} is not available on this key right now.`);
      if (response.status === 429) throw new NimError("NVIDIA rate limit reached. Try again in a minute.");
      if (response.status >= 500) throw new TransientNimError(`NVIDIA had a server error (${response.status}) and the retry failed too.`);
      if (response.status === 400 && options.tools?.length) throw new NimError(`The model ${model} does not support tools.`);
      throw new NimError(`NVIDIA returned ${response.status}.`);
    }

    const payload = (await response.json()) as {
      choices?: { finish_reason?: string; message?: { content?: string | null; tool_calls?: ToolCall[] } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const choice = payload.choices?.[0];

    return {
      content: choice?.message?.content?.trim() ?? "",
      toolCalls: choice?.message?.tool_calls ?? [],
      finishReason: choice?.finish_reason ?? null,
      promptTokens: payload.usage?.prompt_tokens ?? null,
      completionTokens: payload.usage?.completion_tokens ?? null,
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    if (error instanceof NimError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      // Free-tier queues are sometimes just slow, so a timeout gets the same single retry as a 5xx.
      throw new TransientNimError(`The model took longer than ${Math.round(options.timeoutMs / 1000)}s twice and was stopped.`);
    }
    throw new NimError("NVIDIA could not be reached.");
  } finally {
    clearTimeout(timer);
  }
}
