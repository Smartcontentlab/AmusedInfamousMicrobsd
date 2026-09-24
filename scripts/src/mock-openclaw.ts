/**
 * A stand-in OpenClaw gateway, speaking the WebSocket JSON-RPC the adapter expects.
 *
 * Same two jobs as the Hermes stand-in: it documents the contract a real gateway has
 * to meet, and it lets the adapter be proven without a live OpenClaw.
 *
 * The WebSocket server is hand-rolled because the workspace has no websocket
 * dependency and this only ever carries small JSON text frames. It is deliberately
 * minimal: no fragmentation, no compression, no binary frames.
 *
 *   pnpm --filter @workspace/scripts run mock-openclaw
 */
import { createServer, type Server } from "node:http";
import { createHash, randomUUID } from "node:crypto";
import type { Duplex } from "node:stream";

const WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

/** Encodes one unmasked text frame. Server frames are never masked. */
function encodeFrame(text: string): Buffer {
  const payload = Buffer.from(text, "utf8");
  if (payload.length < 126) {
    return Buffer.concat([Buffer.from([0x81, payload.length]), payload]);
  }
  if (payload.length < 65536) {
    const header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(payload.length, 2);
    return Buffer.concat([header, payload]);
  }
  const header = Buffer.alloc(10);
  header[0] = 0x81;
  header[1] = 127;
  header.writeBigUInt64BE(BigInt(payload.length), 2);
  return Buffer.concat([header, payload]);
}

/** Pulls complete text frames out of a buffer, returning them and whatever is left over. */
function decodeFrames(buffer: Buffer): { messages: string[]; rest: Buffer; closed: boolean } {
  const messages: string[] = [];
  let offset = 0;
  let closed = false;

  while (offset + 2 <= buffer.length) {
    const opcode = buffer[offset] & 0x0f;
    const masked = (buffer[offset + 1] & 0x80) !== 0;
    let length = buffer[offset + 1] & 0x7f;
    let cursor = offset + 2;

    if (length === 126) {
      if (cursor + 2 > buffer.length) break;
      length = buffer.readUInt16BE(cursor);
      cursor += 2;
    } else if (length === 127) {
      if (cursor + 8 > buffer.length) break;
      length = Number(buffer.readBigUInt64BE(cursor));
      cursor += 8;
    }

    let mask: Buffer | null = null;
    if (masked) {
      if (cursor + 4 > buffer.length) break;
      mask = buffer.subarray(cursor, cursor + 4);
      cursor += 4;
    }

    if (cursor + length > buffer.length) break;
    const payload = Buffer.from(buffer.subarray(cursor, cursor + length));
    if (mask) {
      for (let i = 0; i < payload.length; i += 1) payload[i] ^= mask[i % 4];
    }
    cursor += length;
    offset = cursor;

    if (opcode === 0x8) {
      closed = true;
      break;
    }
    if (opcode === 0x1) messages.push(payload.toString("utf8"));
  }

  return { messages, rest: buffer.subarray(offset), closed };
}

export type MockOpenClaw = { url: string; port: number; close: () => Promise<void> };

export function startMockOpenClaw(options: { port?: number; token?: string | null; quiet?: boolean } = {}): Promise<MockOpenClaw> {
  const requiredToken = options.token ?? null;
  const log = (message: string) => {
    if (!options.quiet) console.log(message);
  };
  const runs = new Map<string, { status: string }>();
  const sockets = new Set<Duplex>();

  const server: Server = createServer((_req, res) => {
    res.writeHead(426, { "content-type": "text/plain" });
    res.end("this gateway only speaks websocket");
  });

  server.on("upgrade", (req, socket: Duplex) => {
    const key = req.headers["sec-websocket-key"];
    if (typeof key !== "string") {
      socket.destroy();
      return;
    }
    const accept = createHash("sha1").update(key + WS_GUID).digest("base64");
    socket.write(
      "HTTP/1.1 101 Switching Protocols\r\n" +
        "Upgrade: websocket\r\n" +
        "Connection: Upgrade\r\n" +
        `Sec-WebSocket-Accept: ${accept}\r\n\r\n`,
    );
    sockets.add(socket);

    let pending: Buffer = Buffer.alloc(0);
    const reply = (frame: unknown) => socket.write(encodeFrame(JSON.stringify(frame)));

    socket.on("data", (chunk: Buffer) => {
      pending = Buffer.concat([pending, chunk]);
      const { messages, rest, closed } = decodeFrames(pending);
      pending = rest;

      for (const raw of messages) {
        let frame: Record<string, any>;
        try {
          frame = JSON.parse(raw);
        } catch {
          continue;
        }
        if (frame.type !== "req") continue;
        const { id, method, params = {} } = frame;

        if (method === "connect") {
          const supplied = params?.auth?.token ?? null;
          if (requiredToken && supplied !== requiredToken) {
            log("[mock-openclaw] connect rejected: bad token");
            reply({ type: "res", id, ok: false, error: { code: "UNAUTHORIZED", message: "bad token" } });
            continue;
          }
          log("[mock-openclaw] operator connected");
          // gatewayCapabilities reads features.methods to decide what is offered.
          reply({
            type: "res",
            id,
            ok: true,
            payload: { features: { methods: ["chat.send", "chat.abort", "agent.wait", "sessions.send"] } },
          });
          continue;
        }

        if (method === "chat.send") {
          const runId = randomUUID();
          runs.set(runId, { status: "running" });
          log(`[mock-openclaw] chat.send -> ${runId}: ${String(params.message ?? "").slice(0, 50)}`);
          reply({ type: "res", id, ok: true, payload: { runId, status: "running" } });
          continue;
        }

        if (method === "agent.wait") {
          const run = runs.get(String(params.runId));
          // "timeout" is the gateway saying the run is still going, which the adapter
          // maps to running rather than treating as a failure.
          reply({ type: "res", id, ok: true, payload: { status: run?.status === "stopped" ? "ok" : "timeout" } });
          continue;
        }

        if (method === "chat.abort") {
          const run = runs.get(String(params.runId));
          if (run) run.status = "stopped";
          log(`[mock-openclaw] chat.abort ${params.runId}`);
          reply({ type: "res", id, ok: true, payload: { status: "stopped" } });
          continue;
        }

        reply({ type: "res", id, ok: false, error: { code: "UNKNOWN_METHOD", message: `no method ${method}` } });
      }

      if (closed) socket.end();
    });

    socket.on("close", () => sockets.delete(socket));
    socket.on("error", () => sockets.delete(socket));
  });

  return new Promise((resolve) => {
    server.listen(options.port ?? 7078, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : Number(options.port);
      log(`[mock-openclaw] listening on ws://127.0.0.1:${port}`);
      resolve({
        url: `http://127.0.0.1:${port}`,
        port,
        close: () =>
          new Promise<void>((done) => {
            for (const socket of sockets) socket.destroy();
            server.close(() => done());
          }),
      });
    });
  });
}

if (process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("mock-openclaw.ts")) {
  void startMockOpenClaw({ port: Number(process.argv.includes("--port") ? process.argv[process.argv.indexOf("--port") + 1] : 7078) });
}
