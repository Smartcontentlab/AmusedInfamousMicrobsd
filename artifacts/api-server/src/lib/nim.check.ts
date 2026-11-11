/**
 * Self-check for how NVIDIA responses are read. Run it with:
 *   scripts/node_modules/.bin/tsx artifacts/api-server/src/lib/nim.check.ts
 */
import assert from "node:assert/strict";

process.env.NVIDIA_API_KEY = "test-key";
const { NimError, chatStep } = await import("./nim.ts");
const options = { maxTokens: 10, timeoutMs: 2000 };
const realFetch = globalThis.fetch;

// A 200 that is not JSON is a bad response, not an outage.
globalThis.fetch = (async () => new Response("<html>gateway notice</html>", { status: 200, headers: { "content-type": "text/html" } })) as typeof fetch;
await assert.rejects(chatStep("m/x", [{ role: "user", content: "hi" }], options), (error) => {
  assert.ok(error instanceof NimError);
  assert.equal(error.outage, false, "non-JSON 200 must not look like an outage");
  assert.match(error.message, /not valid JSON/);
  return true;
});

// An unreachable host is still an outage.
globalThis.fetch = (async () => { throw new TypeError("fetch failed"); }) as typeof fetch;
await assert.rejects(chatStep("m/x", [{ role: "user", content: "hi" }], options), (error) => error instanceof NimError && error.outage === true);

// Tool arguments that arrive as an object, or not at all, become strings.
globalThis.fetch = (async () =>
  Response.json({
    choices: [{ finish_reason: "tool_calls", message: { content: null, tool_calls: [
      { id: "a", type: "function", function: { name: "read_page", arguments: { url: "https://example.com" } } },
      { id: "b", type: "function", function: { name: "read_page" } },
      { id: "c", type: "function", function: { name: "read_page", arguments: '{"url":"https://x.test"}' } },
    ] } }],
  })) as typeof fetch;
const step = await chatStep("m/x", [{ role: "user", content: "hi" }], options);
assert.deepEqual(step.toolCalls.map((call) => call.function.arguments), ['{"url":"https://example.com"}', "", '{"url":"https://x.test"}']);

globalThis.fetch = realFetch;
console.log("nim: response handling holds.");
