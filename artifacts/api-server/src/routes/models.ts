import { eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { ListModelsResponse, SetAgentModelBody, SetAgentModelResponse } from "@workspace/api-zod";
import { agentsTable, db } from "@workspace/db";

const router: IRouter = Router();

const NIM_BASE_URL = process.env.NVIDIA_BASE_URL ?? "https://integrate.api.nvidia.com/v1";
const CATALOG_TTL_MS = 10 * 60_000;
const AVAILABLE_TTL_MS = 6 * 60 * 60_000;
const UNAVAILABLE_TTL_MS = 30 * 60_000;
const PROBE_TIMEOUT_MS = 20_000;
const PROBE_CONCURRENCY = 4;

// The catalog also lists embedders, safety classifiers, reward models, parsers and
// translators. None of those can act as an agent, so they never reach the picker.
const NON_CHAT_MODEL = /embed|rerank|clip|retriev|parse|guard|safety|reward|detector|topic-control|translate/i;

type ModelStatus = "available" | "unavailable" | "checking";

let catalog: { at: number; ids: string[] } | null = null;
// NVIDIA lists many models that answer 404 or 410 on a given key, so being listed
// is not the same as being callable. Every model is probed before it is offered.
const probes = new Map<string, { status: Exclude<ModelStatus, "checking">; at: number }>();
let probing: Promise<void> | null = null;

function displayNameFor(id: string): string {
  const [vendor, name] = id.includes("/") ? id.split("/", 2) : ["", id];
  const pretty = (name ?? id).replace(/[-_]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  return vendor ? `${pretty} (${vendor})` : pretty;
}

function baseUrl(): string {
  return NIM_BASE_URL.replace(/\/+$/, "");
}

async function fetchCatalogIds(apiKey: string): Promise<string[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(`${baseUrl()}/models`, {
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

async function probeModel(apiKey: string, id: string): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const response = await fetch(`${baseUrl()}/chat/completions`, {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ model: id, messages: [{ role: "user", content: "Say ok." }], max_tokens: 4 }),
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

function statusFor(id: string): ModelStatus {
  const probe = probes.get(id);
  if (!probe) return "checking";
  const ttl = probe.status === "available" ? AVAILABLE_TTL_MS : UNAVAILABLE_TTL_MS;
  return Date.now() - probe.at < ttl ? probe.status : "checking";
}

function startProbing(apiKey: string, ids: string[]) {
  if (probing) return;
  const stale = ids.filter((id) => statusFor(id) === "checking");
  if (stale.length === 0) return;
  probing = (async () => {
    for (let index = 0; index < stale.length; index += PROBE_CONCURRENCY) {
      const batch = stale.slice(index, index + PROBE_CONCURRENCY);
      const results = await Promise.all(batch.map((id) => probeModel(apiKey, id)));
      batch.forEach((id, position) => probes.set(id, { status: results[position] ? "available" : "unavailable", at: Date.now() }));
    }
  })().finally(() => {
    probing = null;
  });
}

function catalogResponse(ids: string[], message: string | null) {
  const models = ids.map((id) => ({ id, provider: "nvidia_nim", displayName: displayNameFor(id), status: statusFor(id) }));
  const checking = models.some((model) => model.status === "checking");
  return ListModelsResponse.parse({
    provider: "nvidia_nim",
    configured: true,
    checking,
    message:
      message ??
      (checking && !models.some((model) => model.status === "available") ? "Checking which models respond on your key..." : null),
    models,
  });
}

router.get("/models", async (_req, res): Promise<void> => {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) {
    res.json(
      ListModelsResponse.parse({
        provider: "nvidia_nim",
        configured: false,
        checking: false,
        message: "Set NVIDIA_API_KEY in the server environment to load the NVIDIA NIM model catalog.",
        models: [],
      }),
    );
    return;
  }

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
  res.json(catalogResponse(ids, message));
});
router.patch("/agents/:agentId/model", async (req, res): Promise<void> => {
  const agentId = Number(req.params.agentId);
  if (!Number.isInteger(agentId)) {
    res.status(404).json({ error: "That agent does not exist." });
    return;
  }

  const parsed = SetAgentModelBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "That model selection is not valid." });
    return;
  }

  const [agent] = await db
    .update(agentsTable)
    .set({
      model: parsed.data.model?.trim() || null,
      ...(parsed.data.modelProvider ? { modelProvider: parsed.data.modelProvider } : {}),
    })
    .where(eq(agentsTable.id, agentId))
    .returning();

  if (!agent) {
    res.status(404).json({ error: "That agent does not exist." });
    return;
  }

  res.json(SetAgentModelResponse.parse({ model: agent.model, modelProvider: agent.modelProvider }));
});

export default router;
