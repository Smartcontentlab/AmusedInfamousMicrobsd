import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const NIM_BASE_URL = (process.env.NVIDIA_BASE_URL ?? "https://integrate.api.nvidia.com/v1").replace(/\/+$/, "");
const CATALOG_TTL_MS = 10 * 60_000;
const AVAILABLE_TTL_MS = 6 * 60 * 60_000;
const UNAVAILABLE_TTL_MS = 30 * 60_000;
const PROBE_TIMEOUT_MS = 20_000;
const TOOL_PROBE_TIMEOUT_MS = 45_000;
const PROBE_CONCURRENCY = 4;
// Probe results survive restarts so the picker is not empty for minutes after every reboot.
const CACHE_FILE = join(process.cwd(), ".cache", "model-probes.json");

// The catalog also lists embedders, safety classifiers, reward models, parsers and
// translators. None of those can act as an agent, so they never reach the picker.
const NON_CHAT_MODEL = /embed|rerank|clip|retriev|parse|guard|safety|reward|detector|topic-control|translate/i;

export type ModelStatus = "available" | "unavailable" | "checking";

type Probe = { status: Exclude<ModelStatus, "checking">; tools: boolean | null; at: number };

let catalog: { at: number; ids: string[] } | null = null;
// NVIDIA lists many models that answer 404 or 410 on a given key, so being listed
// is not the same as being callable. Every model is probed before it is offered.
const probes = new Map<string, Probe>(loadCache());
let probing: Promise<void> | null = null;

function loadCache(): [string, Probe][] {
  try {
    return Object.entries(JSON.parse(readFileSync(CACHE_FILE, "utf8")) as Record<string, Probe>);
  } catch {
    return [];
  }
}

function saveCache() {
  try {
    mkdirSync(dirname(CACHE_FILE), { recursive: true });
    writeFileSync(CACHE_FILE, JSON.stringify(Object.fromEntries(probes)));
  } catch {
    // A missing cache only costs a re-probe on the next start.
  }
}

export function displayNameFor(id: string): string {
  const [vendor, name] = id.includes("/") ? id.split("/", 2) : ["", id];
  const pretty = (name ?? id).replace(/[-_]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  return vendor ? `${pretty} (${vendor})` : pretty;
}

async function fetchCatalogIds(apiKey: string): Promise<string[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(`${NIM_BASE_URL}/models`, {
      headers: { authorization: `Bearer ${apiKey}`, accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(
        response.status === 401 || response.status === 403
          ? "NVIDIA rejected the API key."
          : `NVIDIA returned ${response.status} while listing models.`,
      );
    }
    const payload = (await response.json()) as { data?: { id?: string }[] };
    return (payload.data ?? [])
      .map((entry) => entry.id)
      .filter((id): id is string => typeof id === "string" && id.length > 0 && !NON_CHAT_MODEL.test(id))
      .sort((a, b) => a.localeCompare(b));
  } finally {
    clearTimeout(timeout);
  }
}

async function post(apiKey: string, body: unknown, timeoutMs: number): Promise<Response | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(`${NIM_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function probeModel(apiKey: string, id: string): Promise<Probe> {
  const ping = await post(apiKey, { model: id, messages: [{ role: "user", content: "Say ok." }], max_tokens: 4 }, PROBE_TIMEOUT_MS);
  if (!ping?.ok) return { status: "unavailable", tools: null, at: Date.now() };

  // A model only counts as tool-capable if it actually calls the tool, and in reasonable time.
  const toolCheck = await post(
    apiKey,
    {
      model: id,
      max_tokens: 1500,
      tool_choice: "auto",
      tools: [
        {
          type: "function",
          function: {
            name: "read_page",
            description: "Fetch a web page",
            parameters: { type: "object", properties: { url: { type: "string" } }, required: ["url"] },
          },
        },
      ],
      messages: [{ role: "user", content: "Read https://example.com using the read_page tool." }],
    },
    TOOL_PROBE_TIMEOUT_MS,
  );
  let tools = false;
  if (toolCheck?.ok) {
    const payload = (await toolCheck.json().catch(() => null)) as { choices?: { message?: { tool_calls?: unknown[] } }[] } | null;
    tools = (payload?.choices?.[0]?.message?.tool_calls?.length ?? 0) > 0;
  }
  return { status: "available", tools, at: Date.now() };
}

export function statusFor(id: string): ModelStatus {
  const probe = probes.get(id);
  if (!probe) return "checking";
  const ttl = probe.status === "available" ? AVAILABLE_TTL_MS : UNAVAILABLE_TTL_MS;
  return Date.now() - probe.at < ttl ? probe.status : "checking";
}

/** Models currently known to respond, for picking a stand-in when a contestant's model is down. */
export function respondingModels(): { id: string; tools: boolean | null }[] {
  return [...probes.keys()].filter((id) => statusFor(id) === "available").map((id) => ({ id, tools: toolSupportFor(id) }));
}

/** Records a live outage so the picker and stand-in choice stop offering a model that just failed. */
export function markUnavailable(id: string) {
  const probe = probes.get(id);
  probes.set(id, { status: "unavailable", tools: probe?.tools ?? null, at: Date.now() });
  saveCache();
}

/** Whether a model can use tools: true, false, or null when not yet known. */
export function toolSupportFor(id: string): boolean | null {
  return probes.get(id)?.tools ?? null;
}

function startProbing(apiKey: string, ids: string[]) {
  if (probing) return;
  const stale = ids.filter((id) => statusFor(id) === "checking");
  if (stale.length === 0) return;
  probing = (async () => {
    for (let index = 0; index < stale.length; index += PROBE_CONCURRENCY) {
      const batch = stale.slice(index, index + PROBE_CONCURRENCY);
      const results = await Promise.all(batch.map((id) => probeModel(apiKey, id)));
      batch.forEach((id, position) => probes.set(id, results[position]));
      saveCache();
    }
  })().finally(() => {
    probing = null;
  });
}

/** Refreshes the catalog if stale, kicks off background probing, and returns what is known now. */
export async function currentCatalog(apiKey: string): Promise<{ ids: string[]; message: string | null }> {
  let message: string | null = null;
  if (!catalog || Date.now() - catalog.at >= CATALOG_TTL_MS) {
    try {
      catalog = { at: Date.now(), ids: await fetchCatalogIds(apiKey) };
    } catch (error) {
      message = error instanceof Error ? error.message : "The NVIDIA model catalog could not be reached.";
    }
  }
  const ids = catalog?.ids ?? [];
  startProbing(apiKey, ids);
  return { ids, message };
}
