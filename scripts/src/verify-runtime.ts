/**
 * Proves the whole runtime path works on this machine before you point it at a real agent.
 *
 * It starts a stand-in Hermes, registers it through the real API, then drives the real
 * adapter through health check, launch, status, pause, resume and stop. Every step is
 * asserted, so a pass means the dashboard's side of the wiring is sound and any failure
 * against your actual Hermes is on the agent's side.
 *
 *   pnpm --filter @workspace/scripts run verify-runtime
 *   pnpm --filter @workspace/scripts run verify-runtime -- --api http://127.0.0.1:5000 --agent 2
 *
 * Needs the API server running and an agent whose provider is "hermes".
 */
import assert from "node:assert/strict";
import { startMockHermes } from "./mock-runtime.js";

const args = process.argv.slice(2);
const argValue = (name: string) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : undefined;
};

const api = (argValue("api") ?? "http://127.0.0.1:5000").replace(/\/+$/, "");

async function call(path: string, init: RequestInit = {}): Promise<{ status: number; body: any }> {
  const response = await fetch(`${api}/api${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
  });
  let body: any = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  return { status: response.status, body };
}

function step(label: string, detail = "") {
  console.log(`  ok  ${label}${detail ? ` — ${detail}` : ""}`);
}

async function main() {
  const mock = await startMockHermes({ port: 0, quiet: true });
  console.log(`\nVerifying the runtime path against ${api}`);
  console.log(`Stand-in Hermes on ${mock.url}\n`);

  try {
    const reachable = await call("/runtime-connections");
    assert.equal(reachable.status, 200, `the API server is not answering at ${api}. Start it first.`);
    step("API server reachable");

    const created = await call("/runtime-connections", {
      method: "POST",
      body: JSON.stringify({ name: `verify-${Date.now()}`, provider: "hermes", endpointUrl: mock.url }),
    });
    assert.equal(created.status, 201, `could not register the connection: ${JSON.stringify(created.body)}`);
    const connectionId = created.body.id;
    step("connection registered", `id ${connectionId}`);

    const checked = await call(`/runtime-connections/${connectionId}/check`, { method: "POST" });
    assert.equal(checked.status, 200, `health check failed: ${JSON.stringify(checked.body)}`);
    assert.equal(checked.body.status, "healthy", `expected healthy, got ${checked.body.status}: ${checked.body.errorMessage}`);
    for (const capability of ["launch", "stop", "pause", "resume"]) {
      assert.ok(checked.body.capabilities.includes(capability), `capability "${capability}" was not discovered`);
    }
    step("health check", `healthy, ${checked.body.capabilities.join("/")}, ${checked.body.latencyMs}ms`);

    // Pick an agent that uses Hermes, or use the one named on the command line.
    const agents = await call("/agents");
    const chosen = argValue("agent")
      ? agents.body.find((agent: any) => String(agent.id) === argValue("agent"))
      : agents.body.find((agent: any) => String(agent.provider).toLowerCase() === "hermes");
    assert.ok(chosen, "no agent with provider \"hermes\" exists. Set one in the dashboard, or pass --agent <id>.");
    step("agent selected", `${chosen.name} (id ${chosen.id})`);

    // Clear any run left over from an earlier attempt so the launch is not rejected.
    await call(`/agents/${chosen.id}/run/stop`, { method: "POST" });

    const launched = await call(`/agents/${chosen.id}/run`, {
      method: "POST",
      body: JSON.stringify({ task: "verify-runtime: prove the control path", runtimeConnectionId: connectionId }),
    });
    assert.equal(launched.status, 201, `launch failed: ${JSON.stringify(launched.body)}`);
    assert.ok(launched.body.providerRunId, "the runtime did not return a run id, so nothing can be controlled");
    // Regression guard: these were silently false whenever the launch reply omitted
    // capabilities, which quietly removed the pause and resume controls.
    assert.equal(launched.body.supportsPause, true, "pause was lost between the health check and the launch");
    assert.equal(launched.body.supportsResume, true, "resume was lost between the health check and the launch");
    step("run launched", `${launched.body.providerRunId.slice(0, 8)}, pause/resume/stop offered`);

    const polled = await call(`/agents/${chosen.id}/run`);
    assert.equal(polled.status, 200, "status poll failed");
    assert.equal(polled.body.status, "running", `expected running after the poll, got ${polled.body.status}`);
    assert.equal(polled.body.supportsPause, true, "pause was lost during the status poll");
    step("status polled", `${polled.body.status}`);

    for (const [action, expected] of [["pause", "paused"], ["resume", "running"], ["stop", "stopped"]] as const) {
      const result = await call(`/agents/${chosen.id}/run/${action}`, { method: "POST" });
      assert.equal(result.status, 200, `${action} failed: ${JSON.stringify(result.body)}`);
      assert.equal(result.body.status, expected, `${action} left the run as ${result.body.status}`);
      step(`run ${action}`, expected);
    }

    console.log("\nPASS — the dashboard can discover, launch and control a Hermes runtime.");
    console.log("Point a connection at your real Hermes next; anything that fails now is on its side.\n");
  } finally {
    await mock.close();
  }
}

main().catch((error) => {
  console.error(`\nFAIL — ${error instanceof Error ? error.message : error}\n`);
  process.exit(1);
});
