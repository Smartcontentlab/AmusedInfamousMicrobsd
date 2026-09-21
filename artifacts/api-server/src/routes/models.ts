import { eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { ListModelsResponse, SetAgentModelBody, SetAgentModelResponse } from "@workspace/api-zod";
import { agentsTable, db } from "@workspace/db";
import { currentCatalog, displayNameFor, statusFor, toolSupportFor } from "../lib/model-catalog";

const router: IRouter = Router();

function catalogResponse(ids: string[], message: string | null) {
  const models = ids.map((id) => ({
    id,
    provider: "nvidia_nim",
    displayName: displayNameFor(id),
    status: statusFor(id),
    tools: toolSupportFor(id),
  }));
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
  const { ids, message } = await currentCatalog(apiKey);
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
