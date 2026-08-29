import type { RuntimeConnection } from "@workspace/db";
import { createDecipheriv, createHash, randomUUID } from "node:crypto";

export type RuntimeAction = "launch" | "pause" | "resume" | "stop";

export class RuntimeAdapterError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly retryable = false,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "RuntimeAdapterError";
  }
}

export type RuntimeHealthResult = {
  status: "healthy" | "degraded" | "unhealthy";
  capabilities: string[];
  latencyMs: number;
  errorCode: string | null;
  errorMessage: string | null;
};

export type RuntimeRunResult = {
  providerRunId: string | null;
  status: RuntimeRunStatus;
  supportsPause: boolean;
  supportsResume: boolean;
  supportsStop: boolean;
};

export type RuntimeRunStatus = "queued" | "running" | "paused" | "stopping" | "stopped" | "completed" | "failed";

export type RuntimeRunSnapshot = {
  status: RuntimeRunStatus;
  lastEvent: string | null;
  supportsPause: boolean;
  supportsResume: boolean;
  supportsStop: boolean;
};

export type RuntimeSkillInstallResult = {
  providerRequestId: string | null;
  message: string;
};

const DEFAULT_CAPABILITIES = ["launch", "stop"];
const REQUEST_TIMEOUT_MS = 8_000;
type GatewaySocket = {
  addEventListener: (type: string, listener: (event: { data?: unknown }) => void) => void;
  send: (data: string) => void;
  close: () => void;
};

function endpointFor(connection: RuntimeConnection, suffix: string): string {
  return `${connection.endpointUrl.replace(/\/+$/, "")}/${suffix.replace(/^\/+/, "")}`;
}

function tokenFor(connection: RuntimeConnection): string | undefined {
  return connection.encryptedToken ? decryptToken(connection.encryptedToken) : undefined;
}

function decryptToken(value: string): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new RuntimeAdapterError("server_secret_missing", "The server secret is not configured.", false);
  const [ivText, tagText, encrypted] = value.split(".");
  if (!ivText || !tagText || !encrypted) throw new RuntimeAdapterError("credential_unreadable", "The saved runtime credential cannot be read.", false);
  try {
    const key = createHash("sha256").update(secret).digest();
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivText, "base64url"));
    decipher.setAuthTag(Buffer.from(tagText, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(encrypted, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    throw new RuntimeAdapterError("credential_unreadable", "The saved runtime credential cannot be read.", false);
  }
}

async function requestJson(
  connection: RuntimeConnection,
  path: string,
  init: RequestInit = {},
): Promise<{ data: Record<string, unknown>; latencyMs: number }> {
  const headers = new Headers(init.headers);
  headers.set("accept", "application/json");
  if (init.body) headers.set("content-type", "application/json");
  const token = tokenFor(connection);
  if (token) headers.set("authorization", `Bearer ${token}`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const startedAt = Date.now();
  let response: Response;
  try {
    response = await fetch(endpointFor(connection, path), { ...init, headers, signal: controller.signal });
  } catch (error) {
    const message = error instanceof Error && error.name === "AbortError"
      ? "The runtime did not respond before the health-check timeout."
      : "The runtime could not be reached from the API server.";
    throw new RuntimeAdapterError(error instanceof Error && error.name === "AbortError" ? "runtime_timeout" : "runtime_unreachable", message, true);
  } finally {
    clearTimeout(timeout);
  }

  let data: Record<string, unknown> = {};
  try {
    const parsed: unknown = await response.json();
    if (parsed && typeof parsed === "object") data = parsed as Record<string, unknown>;
  } catch {
    // A healthy runtime may return an empty body for control requests.
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new RuntimeAdapterError("authentication_required", "The runtime rejected the saved credential. Update the connection and try again.", false, response.status);
    }
    if (response.status === 404) {
      throw new RuntimeAdapterError("function_unavailable", "This runtime does not expose the requested function.", false, response.status);
    }
    throw new RuntimeAdapterError(
      response.status >= 500 ? "provider_outage" : "runtime_request_failed",
      response.status >= 500 ? "The runtime reported an outage while handling the request." : "The runtime rejected the request.",
      response.status >= 500,
      response.status,
    );
  }
  return { data, latencyMs: Date.now() - startedAt };
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function capabilitiesFrom(data: Record<string, unknown>, defaults = DEFAULT_CAPABILITIES): string[] {
  const candidate = data.capabilities;
  if (!Array.isArray(candidate)) return defaults;
  return candidate.filter((item): item is string => typeof item === "string");
}

function hermesCapabilities(data: Record<string, unknown>, defaults = DEFAULT_CAPABILITIES): string[] {
  const explicit = capabilitiesFrom(data, []);
  if (explicit.length > 0) {
    const aliases: Record<string, string> = {
      run_submission: "launch",
      run_status: "status",
      run_events_sse: "events",
      run_stop: "stop",
      run_pause: "pause",
      run_resume: "resume",
    };
    return [...new Set(explicit.map((capability) => aliases[capability] ?? capability))];
  }
  const features = data.features as Record<string, unknown> | undefined;
  if (!features || typeof features !== "object") return defaults;
  const capabilities: string[] = [];
  if (features.run_submission === true) capabilities.push("launch");
  if (features.run_status === true) capabilities.push("status");
  if (features.run_stop === true) capabilities.push("stop");
  if (features.run_pause === true) capabilities.push("pause");
  if (features.run_resume === true) capabilities.push("resume");
  return capabilities.length > 0 ? capabilities : defaults;
}

function providerRunId(data: Record<string, unknown>): string | null {
  return stringValue(data.runId) ?? stringValue(data.run_id) ?? stringValue(data.id) ?? stringValue(data.sessionId) ?? stringValue(data.session_id) ?? null;
}

function restPaths(provider: RuntimeConnection["provider"]) {
  return provider === "hermes"
    ? { health: "v1/health", capabilities: "v1/capabilities", launch: "v1/runs", status: "v1/runs/{id}", pause: "v1/runs/{id}/pause", resume: "v1/runs/{id}/resume", stop: "v1/runs/{id}/stop" }
    : { health: "health", capabilities: "gateway/capabilities", launch: "rpc", pause: "rpc", resume: "rpc", stop: "rpc" };
}

function openClawBody(method: string, params: Record<string, unknown>) {
  return JSON.stringify({ jsonrpc: "2.0", id: randomUUID(), method, params });
}

async function openClawRequest(connection: RuntimeConnection, method?: string, params: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
  const WebSocketConstructor = (globalThis as unknown as { WebSocket?: new (url: string) => GatewaySocket }).WebSocket;
  if (!WebSocketConstructor) throw new RuntimeAdapterError("gateway_client_unavailable", "This server cannot open the OpenClaw gateway protocol.", false);
  const gatewayUrl = connection.endpointUrl.replace(/^http/, "ws").replace(/\/+$/, "");
  const token = tokenFor(connection);
  return new Promise((resolve, reject) => {
    const socket = new WebSocketConstructor(gatewayUrl);
    const connectId = randomUUID();
    const requestId = randomUUID();
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      socket.close();
      reject(new RuntimeAdapterError("runtime_timeout", "The OpenClaw gateway did not complete its protocol handshake in time.", true));
    }, REQUEST_TIMEOUT_MS);
    const finish = (error?: RuntimeAdapterError, value?: Record<string, unknown>) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      socket.close();
      error ? reject(error) : resolve(value ?? {});
    };
    socket.addEventListener("open", () => {
      socket.send(JSON.stringify({
        type: "req",
        id: connectId,
        method: "connect",
        params: {
          minProtocol: 4,
          maxProtocol: 4,
          client: { id: "mission-control", version: "1.0.0", platform: "server", mode: "backend" },
          role: "operator",
          scopes: ["operator.read", "operator.write"],
          ...(token ? { auth: { token } } : {}),
        },
      }));
    });
    socket.addEventListener("message", (event) => {
      let frame: Record<string, unknown>;
      try {
        frame = JSON.parse(String(event.data)) as Record<string, unknown>;
      } catch {
        return;
      }
      if (frame.type !== "res") return;
      const id = String(frame.id ?? "");
      if (id === connectId) {
        if (frame.ok !== true) {
          finish(new RuntimeAdapterError(
            token ? "authentication_required" : "gateway_auth_required",
            token ? "The OpenClaw gateway rejected the saved credential." : "The OpenClaw gateway requires a saved credential.",
            false,
          ));
          return;
        }
        if (!method) {
          finish(undefined, (frame.payload as Record<string, unknown>) ?? {});
          return;
        }
        socket.send(JSON.stringify({ type: "req", id: requestId, method, params }));
        return;
      }
      if (id !== requestId) return;
      if (frame.ok !== true) {
        const error = frame.error as Record<string, unknown> | undefined;
        const errorCode = stringValue(error?.code);
        const errorMessage = stringValue(error?.message);
        finish(new RuntimeAdapterError(
          errorCode === "FORBIDDEN" || errorCode === "UNAUTHORIZED" ? "authentication_required" : "runtime_request_failed",
          errorCode === "FORBIDDEN" || errorCode === "UNAUTHORIZED"
            ? "The OpenClaw gateway rejected the saved credential or operator scope."
            : errorMessage && !/token|secret|authorization|credential/i.test(errorMessage)
              ? `The OpenClaw gateway rejected the request: ${errorMessage}`
              : "The OpenClaw gateway rejected the control request.",
          false,
        ));
        return;
      }
      finish(undefined, (frame.payload as Record<string, unknown>) ?? {});
    });
    socket.addEventListener("error", () => finish(new RuntimeAdapterError("runtime_unreachable", "The OpenClaw gateway could not be reached from the API server.", true)));
    socket.addEventListener("close", () => {
      if (!settled) finish(new RuntimeAdapterError("runtime_unreachable", "The OpenClaw gateway closed the control connection unexpectedly.", true));
    });
  });
}

function gatewayCapabilities(hello: Record<string, unknown>): string[] {
  const features = hello.features as Record<string, unknown> | undefined;
  const methods = Array.isArray(features?.methods) ? features.methods.filter((item): item is string => typeof item === "string") : [];
  return [
    ...(methods.includes("chat.send") || methods.includes("sessions.send") ? ["launch"] : []),
    ...(methods.includes("chat.abort") ? ["stop"] : []),
  ];
}

export async function checkRuntime(connection: RuntimeConnection): Promise<RuntimeHealthResult> {
  const paths = restPaths(connection.provider);
  if (connection.provider === "openclaw") {
    const startedAt = Date.now();
    const hello = await openClawRequest(connection);
    const capabilities = gatewayCapabilities(hello);
    return {
      status: capabilities.includes("launch") ? "healthy" : "degraded",
      capabilities,
      latencyMs: Date.now() - startedAt,
      errorCode: capabilities.includes("launch") ? null : "function_unavailable",
      errorMessage: capabilities.includes("launch") ? null : "The gateway is reachable, but no agent launch method was advertised.",
    };
  }
  const health = await requestJson(connection, paths.health);
  let capabilities = capabilitiesFrom(health.data);
  let status: RuntimeHealthResult["status"] = "healthy";
  let errorCode: string | null = null;
  let errorMessage: string | null = null;

  try {
    const capabilityResponse = await requestJson(connection, paths.capabilities);
    capabilities = hermesCapabilities(capabilityResponse.data, capabilities);
  } catch (error) {
    if (error instanceof RuntimeAdapterError && error.code === "function_unavailable") {
      status = "degraded";
      errorCode = error.code;
      errorMessage = "The runtime is reachable, but capability discovery is unavailable. Launch and stop remain available.";
    } else {
      throw error;
    }
  }
  return { status, capabilities, latencyMs: health.latencyMs, errorCode, errorMessage };
}

export async function launchRuntimeRun(connection: RuntimeConnection, task: string, agentId: number, allowedTools: string[]): Promise<RuntimeRunResult> {
  const paths = restPaths(connection.provider);
  const response = connection.provider === "openclaw"
    ? { data: await openClawRequest(connection, "chat.send", { sessionKey: `mission-control:${agentId}`, message: task, idempotencyKey: `mission-control-${randomUUID()}` }) }
    : await requestJson(connection, paths.launch, { method: "POST", body: JSON.stringify({ input: task, session_id: `mission-control:${agentId}` }) });
  const capabilities = connection.provider === "hermes" ? hermesCapabilities(response.data) : capabilitiesFrom(response.data, ["launch", "stop"]);
  return {
    providerRunId: providerRunId(response.data),
    status: normalizeRunStatus(response.data.status ?? response.data.state),
    supportsPause: capabilities.includes("pause"),
    supportsResume: capabilities.includes("resume"),
    supportsStop: capabilities.includes("stop") && Boolean(providerRunId(response.data)),
  };
}

function normalizeRunStatus(value: unknown): RuntimeRunStatus {
  switch (String(value ?? "").toLowerCase()) {
    case "queued":
    case "pending":
    case "created":
      return "queued";
    case "paused":
      return "paused";
    case "stopping":
    case "cancelling":
    case "canceling":
      return "stopping";
    case "stopped":
    case "cancelled":
    case "canceled":
      return "stopped";
    case "completed":
    case "complete":
    case "succeeded":
    case "success":
    case "done":
      return "completed";
    case "failed":
    case "failure":
    case "error":
      return "failed";
    default:
      return "running";
  }
}

export async function getRuntimeRun(connection: RuntimeConnection, providerRunId: string): Promise<RuntimeRunSnapshot> {
  if (connection.provider === "openclaw") {
    const response = await openClawRequest(connection, "agent.wait", { runId: providerRunId, timeoutMs: 250 });
    const waitStatus = String(response.status ?? "").toLowerCase();
    const status = waitStatus === "timeout"
      ? "running"
      : waitStatus === "error"
        ? "failed"
        : waitStatus === "ok"
          ? "completed"
            : normalizeRunStatus(response.status ?? response.state);
    const errorMessage = stringValue(response.error);
    return {
      status,
      lastEvent: errorMessage ?? (status === "completed" ? "OpenClaw completed the run." : status === "failed" ? "OpenClaw reported that the run failed." : "OpenClaw run is still active."),
      supportsPause: false,
      supportsResume: false,
      supportsStop: true,
    };
  }
  const response = await requestJson(connection, `v1/runs/${encodeURIComponent(providerRunId)}`);
  const status = normalizeRunStatus(response.data.status ?? response.data.state);
  const message = stringValue(response.data.lastEvent)
    ?? stringValue(response.data.message)
    ?? (status === "completed" ? "Runtime completed the run." : status === "failed" ? "Runtime reported that the run failed." : `Runtime reports the run is ${status}.`);
  const capabilities = hermesCapabilities(response.data);
  return {
    status,
    lastEvent: message,
    supportsPause: capabilities.includes("pause"),
    supportsResume: capabilities.includes("resume"),
    supportsStop: capabilities.includes("stop"),
  };
}

export async function installRuntimeSkill(
  connection: RuntimeConnection,
  skill: { externalId: string | null; sourceUrl: string | null; name: string },
): Promise<RuntimeSkillInstallResult> {
  const payload = {
    skillId: skill.externalId ?? skill.name,
    name: skill.name,
    sourceUrl: skill.sourceUrl,
  };
  const response = connection.provider === "openclaw"
    ? { data: await openClawRequest(connection, "skills.install", payload) }
    : await requestJson(connection, "v1/skills/install", { method: "POST", body: JSON.stringify(payload) });
  return {
    providerRequestId: providerRunId(response.data),
    message: stringValue(response.data.message) ?? "The runtime accepted the skill installation request.",
  };
}

export async function controlRuntimeRun(
  connection: RuntimeConnection,
  action: Exclude<RuntimeAction, "launch">,
  providerRunId: string,
): Promise<{ status?: RuntimeRunStatus }> {
  const paths = restPaths(connection.provider);
  if (connection.provider === "openclaw") {
    if (action !== "stop") throw new RuntimeAdapterError("function_unavailable", `OpenClaw does not advertise ${action} for live runs.`, false);
    await openClawRequest(connection, "chat.abort", { runId: providerRunId });
    return { status: "stopped" };
  }
  const response = await requestJson(connection, paths[action].replace("{id}", encodeURIComponent(providerRunId)), {
    method: "POST",
    body: action === "stop" ? undefined : JSON.stringify({ run_id: providerRunId }),
  });
  return { status: response.data.status ? normalizeRunStatus(response.data.status) : undefined };
}

export function adapterError(error: unknown): RuntimeAdapterError {
  if (error instanceof RuntimeAdapterError) return error;
  return new RuntimeAdapterError("runtime_request_failed", "The runtime request could not be completed.", true);
}