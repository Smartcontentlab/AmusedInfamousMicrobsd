const NIM_BASE_URL = (process.env.NVIDIA_BASE_URL ?? "https://integrate.api.nvidia.com/v1").replace(/\/+$/, "");

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

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

/** NVIDIA's free tier throws occasional 5xx errors; one retry clears most of them. */
export async function chatCompletion(
  model: string,
  messages: ChatMessage[],
  options: { maxTokens: number; timeoutMs: number },
): Promise<ChatResult> {
  try {
    return await chatCompletionOnce(model, messages, options);
  } catch (error) {
    if (!(error instanceof TransientNimError)) throw error;
    await new Promise((resolve) => setTimeout(resolve, 3000));
    return chatCompletionOnce(model, messages, options);
  }
}

async function chatCompletionOnce(
  model: string,
  messages: ChatMessage[],
  options: { maxTokens: number; timeoutMs: number },
): Promise<ChatResult> {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) throw new NimError("NVIDIA_API_KEY is not set on the server.");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs);
  const startedAt = Date.now();

  try {
    const response = await fetch(`${NIM_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ model, messages, max_tokens: options.maxTokens, temperature: 0.8 }),
      signal: controller.signal,
    });

    if (!response.ok) {
      if (response.status === 404 || response.status === 410) throw new NimError(`The model ${model} is not available on this key right now.`);
      if (response.status === 429) throw new NimError("NVIDIA rate limit reached. Try again in a minute.");
      if (response.status >= 500) throw new TransientNimError(`NVIDIA had a server error (${response.status}) and the retry failed too.`);
      throw new NimError(`NVIDIA returned ${response.status}.`);
    }

    const payload = (await response.json()) as {
      choices?: { finish_reason?: string; message?: { content?: string | null } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const choice = payload.choices?.[0];
    const text = choice?.message?.content?.trim() ?? "";
    if (!text) {
      // Reasoning models think before answering; if thinking fills the budget, no answer arrives.
      throw new NimError(
        choice?.finish_reason === "length"
          ? "The model used its whole token budget thinking and never got to an answer."
          : "The model returned an empty answer.",
      );
    }

    return {
      text,
      promptTokens: payload.usage?.prompt_tokens ?? null,
      completionTokens: payload.usage?.completion_tokens ?? null,
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    if (error instanceof NimError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new NimError(`The model took longer than ${Math.round(options.timeoutMs / 1000)}s and was stopped.`);
    }
    throw new NimError("NVIDIA could not be reached.");
  } finally {
    clearTimeout(timer);
  }
}
