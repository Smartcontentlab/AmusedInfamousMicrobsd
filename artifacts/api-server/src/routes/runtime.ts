import { and, desc, eq } from "drizzle-orm";
import { Router, type IRouter, type Response } from "express";
import {
  ActivityEvent,
  AgentRun,
  AgentRunInput,
  CheckRuntimeConnectionParams,
  CreateRuntimeConnectionBody,
  CreateRuntimeConnectionResponse,
  GetAgentRunParams,
  GetAgentRunResponse,
  LaunchAgentRunBody,
  LaunchAgentRunParams,
  LaunchAgentRunResponse,
  ListAgentActivityParams,
  ListAgentActivityResponse,
  ListRuntimeConnectionsResponse,
  ListRuntimeHealthResponse,
  PauseAgentRunParams,
  PauseAgentRunResponse,
  ResumeAgentRunParams,
  ResumeAgentRunResponse,
  StopAgentRunParams,
  StopAgentRunResponse,
} from "@workspace/api-zod";
import {
  activityTable,
  agentsTable,
  db,
  liveRunsTable,
  runtimeConnectionsTable,
  type RuntimeConnection,
} from "@workspace/db";
import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { adapterError, checkRuntime, controlRuntimeRun, launchRuntimeRun, type RuntimeHealthResult } from "../lib/runtime-adapters";
import { getAgentToolAccess, getUnavailableTools } from "../lib/tool-unlocks";
import { ensureSeeded } from "./mission-control";

const router: IRouter = Router();
let envConnectionPromise: Promise<void> | undefined;

function encryptToken(token: string): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is required to save runtime credentials.");
  const key = createHash("sha256").update(secret).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return `${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${encrypted.toString("base64url")}`;
}

function validateEndpoint(endpoint: string): string {
  let parsed: URL;
  try {
    parsed = new URL(endpoint);
  } catch {
    throw new Error("Enter a valid runtime URL.");
  }
  if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Runtime URL must use HTTP or HTTPS.");
  return parsed.toString().replace(/\/+$/, "");
}

function safeConnection(connection: RuntimeConnection) {
  return {
    id: connection.id,
    name: connection.name,
    provider: connection.provider,
    status: connection.status,
    capabilities: connection.capabilities ?? [],
    hasCredentials: Boolean(connection.encryptedToken),
    lastCheckedAt: connection.lastCheckedAt,
    errorCode: connection.lastErrorCode,
    errorMessage: connection.lastErrorMessage,
  };
}

function nextAction(status: string, errorCode: string | null): string {
  if (status === "healthy") return "Ready for live runs.";
  if (status === "degraded") return "Review unavailable capabilities before launching.";
  if (errorCode === "authentication_required") return "Update the saved credential, then check this connection again.";
  if (errorCode === "runtime_unreachable" || errorCode === "runtime_timeout") return "Confirm the runtime is reachable from this server, then retry.";
  if (status === "unknown") return "Run a health check before launching work.";
  return "Check the runtime configuration and retry the health check.";
}

function safeHealth(connection: RuntimeConnection, extra: Partial<RuntimeHealthResult> = {}) {
  const status = extra.status ?? connection.status;
  const errorCode = extra.errorCode === undefined ? connection.lastErrorCode : extra.errorCode;
  const errorMessage = extra.errorMessage === undefined ? connection.lastErrorMessage : extra.errorMessage;
  return {
    ...safeConnection({ ...connection, status, capabilities: extra.capabilities ?? connection.capabilities, lastErrorCode: errorCode, lastErrorMessage: errorMessage }),
    nextAction: nextAction(status, errorCode),
    latencyMs: extra.latencyMs ?? null,
  };
}

async function ensureEnvironmentConnections(): Promise<void> {
  if (!envConnectionPromise) {
    envConnectionPromise = (async () => {
      const configured = [
        { provider: "hermes", name: "Hermes (server config)", url: process.env.RUNTIME_HERMES_URL ?? process.env.HERMES_API_URL, token: process.env.RUNTIME_HERMES_TOKEN ?? process.env.HERMES_API_TOKEN },
        { provider: "openclaw", name: "OpenClaw (server config)", url: process.env.RUNTIME_OPENCLAW_URL ?? process.env.OPENCLAW_GATEWAY_URL, token: process.env.RUNTIME_OPENCLAW_TOKEN ?? process.env.OPENCLAW_GATEWAY_TOKEN },
      ];
      for (const item of configured) {
        if (!item.url) continue;
        const existing = await db.select().from(runtimeConnectionsTable).where(eq(runtimeConnectionsTable.name, item.name)).limit(1);
        if (existing[0]) continue;
        await db.insert(runtimeConnectionsTable).values({
          name: item.name,
          provider: item.provider,
          endpointUrl: validateEndpoint(item.url),
          encryptedToken: item.token ? encryptToken(item.token) : null,
        });
      }
    })();
  }
  await envConnectionPromise;
}

async function recordActivity(agentId: number, runId: number | null, kind: string, message: string): Promise<void> {
  await db.insert(activityTable).values({ agentId, runId, kind, message });
}

async function getRunForAgent(agentId: number) {
  const runs = await db.select().from(liveRunsTable).where(eq(liveRunsTable.agentId, agentId)).orderBy(desc(liveRunsTable.createdAt)).limit(10);
  return runs.find((run) => ["queued", "running", "paused", "stopping"].includes(run.status)) ?? runs[0];
}

async function getConnectionForAgent(agentId: number, requestedConnectionId?: number) {
  const [agent] = await db.select().from(agentsTable).where(eq(agentsTable.id, agentId));
  if (!agent) return { agent: undefined, connection: undefined };
  if (requestedConnectionId || agent.runtimeConnectionId) {
    const [connection] = await db.select().from(runtimeConnectionsTable).where(eq(runtimeConnectionsTable.id, requestedConnectionId ?? agent.runtimeConnectionId!));
    return { agent, connection };
  }
  const connections = await db.select().from(runtimeConnectionsTable);
  const connection = connections.find((item) => item.provider.toLowerCase() === agent.provider.toLowerCase());
  return { agent, connection };
}

async function updateFailedConnection(connection: RuntimeConnection, error: ReturnType<typeof adapterError>) {
  const status = error.code === "function_unavailable" ? "degraded" : "unhealthy";
  await db.update(runtimeConnectionsTable).set({
    status,
    lastCheckedAt: new Date(),
    lastErrorCode: error.code,
    lastErrorMessage: error.message,
  }).where(eq(runtimeConnectionsTable.id, connection.id));
}

router.get("/runtime-connections", async (_req, res): Promise<void> => {
  await ensureSeeded();
  await ensureEnvironmentConnections();
  const connections = await db.select().from(runtimeConnectionsTable).orderBy(desc(runtimeConnectionsTable.updatedAt));
  res.json(ListRuntimeConnectionsResponse.parse(connections.map(safeConnection)));
});

router.post("/runtime-connections", async (req, res): Promise<void> => {
  await ensureSeeded();
  await ensureEnvironmentConnections();
  const parsed = CreateRuntimeConnectionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Connection name, provider, and endpoint URL are required." });
    return;
  }
  let endpointUrl: string;
  try {
    endpointUrl = validateEndpoint(parsed.data.endpointUrl);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Runtime URL is invalid." });
    return;
  }
  let encryptedToken: string | null = null;
  try {
    encryptedToken = parsed.data.token ? encryptToken(parsed.data.token) : null;
  } catch (error) {
    res.status(503).json({ error: error instanceof Error ? error.message : "Server credential storage is unavailable." });
    return;
  }
  const [connection] = await db.insert(runtimeConnectionsTable).values({
    name: parsed.data.name.trim(),
    provider: parsed.data.provider,
    endpointUrl,
    encryptedToken,
  }).returning();
  res.status(201).json(CreateRuntimeConnectionResponse.parse(safeConnection(connection)));
});

router.post("/runtime-connections/:connectionId/check", async (req, res): Promise<void> => {
  await ensureSeeded();
  await ensureEnvironmentConnections();
  const params = CheckRuntimeConnectionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Runtime connection identifier is invalid." });
    return;
  }
  const [connection] = await db.select().from(runtimeConnectionsTable).where(eq(runtimeConnectionsTable.id, params.data.connectionId));
  if (!connection) {
    res.status(404).json({ error: "Runtime connection not found." });
    return;
  }
  try {
    const result = await checkRuntime(connection);
    const [updated] = await db.update(runtimeConnectionsTable).set({
      status: result.status,
      capabilities: result.capabilities,
      lastCheckedAt: new Date(),
      lastErrorCode: result.errorCode,
      lastErrorMessage: result.errorMessage,
    }).where(eq(runtimeConnectionsTable.id, connection.id)).returning();
    res.json(ListRuntimeHealthResponse.element.parse(safeHealth(updated, result)));
  } catch (error) {
    const failure = adapterError(error);
    await updateFailedConnection(connection, failure);
    const [updated] = await db.select().from(runtimeConnectionsTable).where(eq(runtimeConnectionsTable.id, connection.id));
    res.status(failure.status === 401 || failure.status === 403 ? 401 : 502).json({
      error: failure.message,
      health: updated ? safeHealth(updated) : undefined,
    });
  }
});

router.get("/runtime-health", async (_req, res): Promise<void> => {
  await ensureSeeded();
  await ensureEnvironmentConnections();
  const connections = await db.select().from(runtimeConnectionsTable).orderBy(desc(runtimeConnectionsTable.updatedAt));
  res.json(ListRuntimeHealthResponse.parse(connections.map((connection) => safeHealth(connection))));
});

router.get("/agents/:agentId/run", async (req, res): Promise<void> => {
  await ensureSeeded();
  const params = GetAgentRunParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Agent identifier is invalid." });
    return;
  }
  const run = await getRunForAgent(params.data.agentId);
  if (!run) {
    res.status(204).send();
    return;
  }
  res.json(GetAgentRunResponse.parse(run));
});

router.post("/agents/:agentId/run", async (req, res): Promise<void> => {
  await ensureSeeded();
  const params = LaunchAgentRunParams.safeParse(req.params);
  const body = LaunchAgentRunBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "A non-empty task is required to launch a run." });
    return;
  }
  const { agent, connection } = await getConnectionForAgent(params.data.agentId, body.data.runtimeConnectionId);
  if (!agent) {
    res.status(404).json({ error: "Agent not found." });
    return;
  }
  const requestedTools = body.data.tools ?? [];
  const unavailableTools = await getUnavailableTools(agent.id, requestedTools);
  if (unavailableTools.length > 0) {
    const details = unavailableTools
      .map((tool) => `${tool.label}: ${tool.reason} ${tool.unlockCondition}`)
      .join(" ");
    res.status(409).json({
      error: `Run rejected because ${unavailableTools.length === 1 ? "a requested tool is" : "requested tools are"} unavailable. ${details}`,
      unavailableTools,
    });
    return;
  }
  const access = await getAgentToolAccess(agent.id);
  const allowedTools = requestedTools.length > 0
    ? [...new Set(requestedTools)]
    : access.tools.filter((tool) => tool.available).map((tool) => tool.key);
  if (!connection) {
    res.status(409).json({ error: `No ${agent.provider} runtime is linked to this staff member. Add a runtime link first.` });
    return;
  }
  const existing = await getRunForAgent(agent.id);
  if (existing && ["queued", "running", "paused", "stopping"].includes(existing.status)) {
    res.status(409).json({ error: "This staff member already has a live run. Stop it before launching another." });
    return;
  }
  try {
    const started = await launchRuntimeRun(connection, body.data.task.trim(), agent.id, allowedTools);
    const now = new Date();
    const [run] = await db.insert(liveRunsTable).values({
      agentId: agent.id,
      connectionId: connection.id,
      providerRunId: started.providerRunId,
      task: body.data.task.trim(),
      allowedTools,
      status: started.status,
      startedAt: now,
      lastEventAt: now,
      lastEvent: "Run accepted by runtime.",
      supportsPause: started.supportsPause,
      supportsResume: started.supportsResume,
      supportsStop: started.supportsStop,
    }).returning();
    await db.update(agentsTable).set({ runtimeConnectionId: connection.id, status: "working", currentTask: body.data.task.trim(), lastActivity: "Live run launched." }).where(eq(agentsTable.id, agent.id));
    await recordActivity(agent.id, run.id, "run_started", `Live run launched through ${connection.name}.`);
    res.status(201).json(LaunchAgentRunResponse.parse(run));
  } catch (error) {
    const failure = adapterError(error);
    await updateFailedConnection(connection, failure);
    await db.update(agentsTable).set({ status: "blocked", lastActivity: failure.message }).where(eq(agentsTable.id, agent.id));
    await recordActivity(agent.id, null, "run_error", failure.message);
    res.status(failure.status === 401 || failure.status === 403 ? 401 : 502).json({ error: failure.message });
  }
});

async function controlAgentRun(agentId: number, action: "pause" | "resume" | "stop", res: Response): Promise<void> {
  const run = await getRunForAgent(agentId);
  if (!run) {
    res.status(404).json({ error: "No live run exists for this staff member." });
    return;
  }
  const supported = action === "pause" ? run.supportsPause : action === "resume" ? run.supportsResume : run.supportsStop;
  if (!supported) {
    res.status(409).json({ error: `This runtime does not support ${action} for the current run.` });
    return;
  }
  const [connection] = await db.select().from(runtimeConnectionsTable).where(eq(runtimeConnectionsTable.id, run.connectionId));
  if (!connection || !run.providerRunId) {
    res.status(409).json({ error: "The runtime did not return a controllable run reference." });
    return;
  }
  try {
    await controlRuntimeRun(connection, action, run.providerRunId);
    const status = action === "pause" ? "paused" : action === "resume" ? "running" : "stopped";
    const endedAt = action === "stop" ? new Date() : null;
    const [updated] = await db.update(liveRunsTable).set({
      status,
      endedAt,
      lastEventAt: new Date(),
      lastEvent: action === "stop" ? "Run stopped by operator." : `Run ${action}d by operator.`,
    }).where(eq(liveRunsTable.id, run.id)).returning();
    await db.update(agentsTable).set({ status: action === "stop" ? "waiting" : action === "pause" ? "waiting" : "working", lastActivity: `Live run ${status}.` }).where(eq(agentsTable.id, agentId));
    await recordActivity(agentId, run.id, `run_${action}d`, `Live run ${status} by operator.`);
    res.json(updated);
  } catch (error) {
    const failure = adapterError(error);
    await updateFailedConnection(connection, failure);
    await db.update(liveRunsTable).set({ status: "failed", endedAt: new Date(), errorCode: failure.code, errorMessage: failure.message, lastEventAt: new Date(), lastEvent: "Runtime control failed." }).where(eq(liveRunsTable.id, run.id));
    await db.update(agentsTable).set({ status: "blocked", lastActivity: failure.message }).where(eq(agentsTable.id, agentId));
    await recordActivity(agentId, run.id, "run_error", failure.message);
    res.status(failure.status === 401 || failure.status === 403 ? 401 : 502).json({ error: failure.message });
  }
}

router.post("/agents/:agentId/run/pause", async (req, res): Promise<void> => {
  await ensureSeeded();
  const params = PauseAgentRunParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Agent identifier is invalid." }); return; }
  await controlAgentRun(params.data.agentId, "pause", res);
});

router.post("/agents/:agentId/run/resume", async (req, res): Promise<void> => {
  await ensureSeeded();
  const params = ResumeAgentRunParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Agent identifier is invalid." }); return; }
  await controlAgentRun(params.data.agentId, "resume", res);
});

router.post("/agents/:agentId/run/stop", async (req, res): Promise<void> => {
  await ensureSeeded();
  const params = StopAgentRunParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Agent identifier is invalid." }); return; }
  await controlAgentRun(params.data.agentId, "stop", res);
});

router.get("/agents/:agentId/activity", async (req, res): Promise<void> => {
  await ensureSeeded();
  const params = ListAgentActivityParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Agent identifier is invalid." }); return; }
  const events = await db.select().from(activityTable).where(eq(activityTable.agentId, params.data.agentId)).orderBy(desc(activityTable.createdAt)).limit(20);
  res.json(ListAgentActivityResponse.parse(events));
});

export default router;