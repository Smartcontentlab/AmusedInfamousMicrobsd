/**
 * A stand-in Hermes that speaks exactly what Mission Control's adapter expects.
 *
 * Two jobs:
 *  1. It is the contract. Whatever your real Hermes is, it has to answer these
 *     six requests this way or the dashboard cannot drive it.
 *  2. It lets the adapter be proven end to end without a real agent running, so
 *     when the real one fails you know the fault is on its side, not the app's.
 *
 *   pnpm --filter @workspace/scripts run mock-runtime
 *   pnpm --filter @workspace/scripts run mock-runtime -- --port 7077 --token secret
 */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";

type Run = { id: string; status: string; input: string; sessionId: string | null };

function send(res: ServerResponse, status: number, body: unknown) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { "content-type": "application/json", "content-length": Buffer.byteLength(payload) });
  res.end(payload);
}

async function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export type MockHermes = { url: string; port: number; close: () => Promise<void> };

/** Starts the stand-in. Port 0 picks a free one, which is what the verifier uses. */
export function startMockHermes(options: { port?: number; token?: string | null; quiet?: boolean } = {}): Promise<MockHermes> {
  const requiredToken = options.token ?? null;
  const log = (message: string) => {
    if (!options.quiet) console.log(message);
  };
  const runs = new Map<string, Run>();

  const server: Server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const path = url.pathname.replace(/^\/+|\/+$/g, "");
    const method = req.method ?? "GET";

    if (requiredToken && req.headers.authorization !== `Bearer ${requiredToken}`) {
      send(res, 401, { error: "unauthorized" });
      return;
    }

    // GET v1/health — the reachability probe. Any 2xx counts as reachable.
    if (method === "GET" && path === "v1/health") {
      send(res, 200, { status: "ok" });
      return;
    }

    // GET v1/capabilities — what this runtime can be asked to do. The adapter reads
    // `features`, and falls back to a plain `capabilities` array.
    if (method === "GET" && path === "v1/capabilities") {
      send(res, 200, {
        features: { run_submission: true, run_status: true, run_stop: true, run_pause: true, run_resume: true },
      });
      return;
    }

    // POST v1/runs — start work. Must return an id the dashboard can poll.
    if (method === "POST" && path === "v1/runs") {
      const body = await readBody(req);
      const run: Run = {
        id: randomUUID(),
        status: "queued",
        input: String(body.input ?? ""),
        sessionId: typeof body.session_id === "string" ? body.session_id : null,
      };
      runs.set(run.id, run);
      log(`[mock-hermes] run ${run.id} queued: ${run.input.slice(0, 60)}`);
      send(res, 201, { runId: run.id, status: run.status });
      return;
    }

    const runMatch = /^v1\/runs\/([^/]+)(?:\/(pause|resume|stop))?$/.exec(path);
    if (runMatch) {
      const run = runs.get(runMatch[1]);
      if (!run) {
        send(res, 404, { error: "no such run" });
        return;
      }
      const action = runMatch[2];
      if (method === "GET" && !action) {
        // A queued run becomes running on first poll, so transitions are observable.
        if (run.status === "queued") run.status = "running";
        send(res, 200, { runId: run.id, status: run.status });
        return;
      }
      if (method === "POST" && action) {
        run.status = action === "pause" ? "paused" : action === "resume" ? "running" : "stopped";
        log(`[mock-hermes] run ${run.id} -> ${run.status}`);
        send(res, 200, { runId: run.id, status: run.status });
        return;
      }
    }

    send(res, 404, { error: `no route for ${method} /${path}` });
  });

  return new Promise((resolve) => {
    server.listen(options.port ?? 7077, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : Number(options.port);
      log(`[mock-hermes] listening on http://127.0.0.1:${port}`);
      log(`[mock-hermes] auth: ${requiredToken ? "Bearer token required" : "none"}`);
      resolve({
        url: `http://127.0.0.1:${port}`,
        port,
        close: () => new Promise<void>((done) => server.close(() => done())),
      });
    });
  });
}

// Run directly for a long-lived stand-in you can point the dashboard at by hand.
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/").split("/").pop() ?? "")) {
  const args = process.argv.slice(2);
  const argValue = (name: string) => {
    const index = args.indexOf(`--${name}`);
    return index >= 0 ? args[index + 1] : undefined;
  };
  void startMockHermes({
    port: Number(argValue("port") ?? 7077),
    token: argValue("token") ?? process.env.MOCK_RUNTIME_TOKEN ?? null,
  });
}
