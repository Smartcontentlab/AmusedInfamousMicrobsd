/**
 * Self-check for the research loop and turn bookkeeping, with NVIDIA and the web stubbed out.
 * It writes (and removes) its own contestants, so run it against a scratch database only:
 *   DATABASE_URL=postgresql://... scripts/node_modules/.bin/tsx artifacts/api-server/src/lib/arena-engine.check.ts
 */
import assert from "node:assert/strict";

process.env.NVIDIA_API_KEY = "test-key";
delete process.env.TAVILY_API_KEY;
const { agentToolUnlocksTable, agentsTable, arenaTurnStepsTable, arenaTurnsTable, db } = await import("@workspace/db");
const { UNVERIFIED_NOTICE, recoverInterruptedTurns, startLevel } = await import("./arena-engine.ts");
const { eq, inArray } = await import("drizzle-orm");

assert.equal((await db.select().from(agentsTable)).length, 0, "run this on an empty scratch database");

const realFetch = globalThis.fetch;
type Seen = { tools: boolean }[];
let seen: Seen = [];
let modelBehavior: (body: { tools?: unknown[] }, call: number) => Response = () => new Response("nope", { status: 500 });
let calls = 0;
globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const url = String(input instanceof Request ? input.url : input);
  if (url.includes("/chat/completions")) {
    const body = JSON.parse(String(init?.body));
    seen.push({ tools: Boolean(body.tools?.length) });
    return modelBehavior(body, calls++);
  }
  return new Response("<title>Pricing</title><p>Plans start at $9 a month.</p>", { status: 200, headers: { "content-type": "text/html" } });
}) as typeof fetch;

const toolCall = (url: string) =>
  Response.json({ choices: [{ finish_reason: "tool_calls", message: { content: null, tool_calls: [{ id: "t1", type: "function", function: { name: "read_page", arguments: { url } } }] } }] });
const answer = (text: string) => Response.json({ choices: [{ finish_reason: "stop", message: { content: text } }] });

async function play(setup?: (agentId: number) => Promise<void>) {
  seen = [];
  calls = 0;
  const [agent] = await db.insert(agentsTable).values({ name: "check-contestant", role: "tester", model: "check/model" }).returning();
  await setup?.(agent.id);
  assert.deepEqual(await startLevel(1), { started: 1 });
  for (let i = 0; i < 100; i += 1) {
    const [turn] = await db.select().from(arenaTurnsTable).where(eq(arenaTurnsTable.agentId, agent.id));
    if (turn.status !== "queued" && turn.status !== "running") {
      const steps = await db.select().from(arenaTurnStepsTable).where(eq(arenaTurnStepsTable.turnId, turn.id));
      await db.delete(arenaTurnStepsTable).where(eq(arenaTurnStepsTable.turnId, turn.id));
      await db.delete(arenaTurnsTable).where(eq(arenaTurnsTable.agentId, agent.id));
      await db.delete(agentToolUnlocksTable).where(eq(agentToolUnlocksTable.agentId, agent.id));
      await db.delete(agentsTable).where(eq(agentsTable.id, agent.id));
      return { turn, steps, agent };
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("turn never finished");
}

try {
  // The model answers without touching a tool: stored, but flagged.
  modelBehavior = () => answer("Idea: sell widgets.");
  let result = await play();
  assert.equal(result.turn.status, "completed");
  assert.equal(result.turn.output, `${UNVERIFIED_NOTICE}\nIdea: sell widgets.`);

  // The same blocked call three times answers from notes instead of failing the turn.
  modelBehavior = (body) => (body.tools ? toolCall("http://127.0.0.1/admin") : answer("Best guess without sources."));
  result = await play();
  assert.equal(result.turn.status, "completed", `repeat loop must not fail the turn: ${result.turn.error}`);
  assert.ok(result.turn.output?.startsWith(UNVERIFIED_NOTICE));
  assert.equal(result.steps.filter((step) => step.tool === "read_page" && step.ok === 0).length, 2);
  assert.ok(result.steps.some((step) => step.tool === "note"));

  // A page that really loads means no flag, and the fetched URL is in the steps.
  modelBehavior = (body, call) => (body.tools && call === 0 ? toolCall("http://93.184.216.34/pricing") : answer("Idea: $9 plan, per the pricing page."));
  result = await play();
  assert.equal(result.turn.status, "completed");
  assert.ok(!result.turn.output?.startsWith("UNVERIFIED"));
  assert.ok(result.steps.some((step) => step.tool === "read_page" && step.ok === 1 && step.input.includes("93.184.216.34")));

  // Web research revoked: no tools are offered at all, and the answer is flagged.
  modelBehavior = () => answer("From memory.");
  result = await play((agentId) =>
    db.insert(agentToolUnlocksTable).values({ agentId, toolKey: "web_research", action: "revoke", reason: "check", actor: "check", round: 1 }).then(() => undefined),
  );
  assert.deepEqual(seen, [{ tools: false }], "a revoked tool must not be offered");
  assert.ok(result.turn.output?.startsWith(UNVERIFIED_NOTICE));

  // A non-JSON 200 fails the turn plainly: no stand-in, and the model is not written off.
  modelBehavior = () => new Response("<html>oops</html>", { status: 200, headers: { "content-type": "text/html" } });
  result = await play();
  assert.equal(result.turn.status, "failed");
  assert.match(result.turn.error ?? "", /not valid JSON/);
  assert.equal(result.turn.standInFor, null);

  // Boot recovery frees stuck turns and the contestants working on them.
  const [stuck] = await db.insert(agentsTable).values({ name: "check-stuck", role: "tester", status: "working", computerStatus: "researching" }).returning();
  await db.insert(arenaTurnsTable).values({ agentId: stuck.id, level: 1, status: "running", prompt: "p" });
  assert.deepEqual(await recoverInterruptedTurns(), { turns: 1, agents: 1 });
  const [after] = await db.select().from(arenaTurnsTable).where(eq(arenaTurnsTable.agentId, stuck.id));
  assert.equal(after.status, "failed");
  assert.match(after.error ?? "", /Server restarted/);
  assert.equal((await db.select().from(agentsTable).where(inArray(agentsTable.id, [stuck.id])))[0].status, "waiting");
  await db.delete(arenaTurnsTable).where(eq(arenaTurnsTable.agentId, stuck.id));
  await db.delete(agentsTable).where(eq(agentsTable.id, stuck.id));

  // Nobody has a model: 409, and no rows are created.
  const [modelless] = await db.insert(agentsTable).values({ name: "check-modelless", role: "tester" }).returning();
  await assert.rejects(startLevel(1), (error: { status?: number }) => error.status === 409);
  assert.equal((await db.select().from(arenaTurnsTable)).length, 0);
  await db.delete(agentsTable).where(eq(agentsTable.id, modelless.id));

  console.log("arena-engine: research loop and turn bookkeeping hold.");
} finally {
  globalThis.fetch = realFetch;
  process.exit(process.exitCode ?? 0);
}
