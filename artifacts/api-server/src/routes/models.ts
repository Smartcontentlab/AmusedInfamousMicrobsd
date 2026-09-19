import { eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { ListModelsResponse, SetAgentModelBody, SetAgentModelResponse } from "@workspace/api-zod";
import { agentsTable, db } from "@workspace/db";

const router: IRouter = Router();

const NIM_BASE_URL = process.env.NVIDIA_BASE_URL ?? "https://integrate.api.nvidia.com/v1";
const CACHE_TTL_MS = 600_000;

let cache: { at: number; models: { id: string; provider: string; displayName: string | null }[] } | null = null;

function displayNameFor(id: string): string {
  const [vendor, name] = id.includes("/") ? id.split("/", 2) : ["", id];
  const pretty = (name ?? id).replace(/[-_]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  return vendor ? `${pretty} (${vendor})` : pretty;
}

async function fetchNimModels(apiKey: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(`${NIM_BASE_URL.replace(/\/+$/, "")}/models`, {
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
      .filter((id): id is string => typeof id === "string" && id.length > 0)
      .sort((a, b) => a.localeCompare(b))
      .map((id) => ({ id, provider: "nvidia_nim", displayName: displayNameFor(id) }));
  } finally {
    clearTimeout(timeout);
  }
}

router.get("/models", async (_req, res): Promise<void> => {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) {
    res.json(
      ListModelsResponse.parse({
        provider: "nvidia_nim",
        configured: false,
        message: "Set NVIDIA_API_KEY in the server environment to load the NVIDIA NIM model catalog.",
        models: [],
      }),
    );
    return;
  }

  if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
    res.json(ListModelsResponse.parse({ provider: "nvidia_nim", configured: true, message: null, models: cache.models }));
    return;
  }

  try {
    const models = await fetchNimModels(apiKey);
    cache = { at: Date.now(), models };
    res.json(ListModelsResponse.parse({ provider: "nvidia_nim", configured: true, message: null, models }));
  } catch (error) {
    res.json(
      ListModelsResponse.parse({
        provider: "nvidia_nim",
        configured: true,
        message: error instanceof Error ? error.message : "The NVIDIA model catalog could not be reached.",
        models: cache?.models ?? [],
      }),
    );
  }
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
