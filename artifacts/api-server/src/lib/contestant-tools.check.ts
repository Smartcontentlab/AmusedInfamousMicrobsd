/**
 * Self-check for the read_page address guard and the streaming size cap. Run it with:
 *   scripts/node_modules/.bin/tsx artifacts/api-server/src/lib/contestant-tools.check.ts
 */
import assert from "node:assert/strict";
import { ToolError, isPrivateAddress, readPage } from "./contestant-tools.ts";

const blocked = [
  "127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "224.0.0.1",
  "::1", "::", "::ffff:127.0.0.1", "::ffff:7f00:1", "::ffff:a9fe:a9fe", "::ffff:10.0.0.1", "0:0:0:0:0:ffff:7f00:1",
  "::127.0.0.1", "::7f00:1", "fe80::1", "febf::1", "fc00::1", "fd12:3456::1", "64:ff9b::7f00:1", "64:ff9b::8.8.8.8",
  "2002:7f00:1::1", "2002::", "ff02::1", "fe80::1%eth0",
];
const allowed = ["8.8.8.8", "93.184.216.34", "172.32.0.1", "100.63.0.1", "::ffff:8.8.8.8", "::ffff:808:808", "2606:4700:4700::1111", "2001:4860:4860::8888", "fec0::1".replace("fec0", "2a00")];

for (const address of blocked) assert.equal(isPrivateAddress(address), true, `${address} should be blocked`);
for (const address of allowed) assert.equal(isPrivateAddress(address), false, `${address} should be allowed`);

// A fetch stub streams 3 MB of text with no content-length: the cap must trip long before the end.
let pulled = 0;
const realFetch = globalThis.fetch;
globalThis.fetch = (async () => {
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      pulled += 100_000;
      controller.enqueue(new Uint8Array(100_000).fill(97));
      if (pulled >= 3_000_000) controller.close();
    },
  });
  return new Response(stream, { status: 200, headers: { "content-type": "text/plain" } });
}) as typeof fetch;
await assert.rejects(readPage("http://93.184.216.34/big"), (error) => error instanceof ToolError && /too large/.test(error.message));
assert.ok(pulled < 2_000_000, `stream should stop early, pulled ${pulled} bytes`);

globalThis.fetch = (async () => new Response("<title>Hi</title><p>hello</p>", { status: 200, headers: { "content-type": "text/html" } })) as typeof fetch;
assert.match(await readPage("http://93.184.216.34/"), /Title: Hi[\s\S]*hello/);
// An address literal that is private is refused before any request is made.
globalThis.fetch = (async () => { throw new Error("fetch must not be reached"); }) as typeof fetch;
await assert.rejects(readPage("http://[::ffff:7f00:1]/"), ToolError);
await assert.rejects(readPage("http://[::ffff:127.0.0.1]/"), ToolError);
globalThis.fetch = realFetch;

console.log("contestant-tools: address guard and size cap hold.");
