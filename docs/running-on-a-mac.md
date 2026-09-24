# Running Mission Control on a Mac

Everything runs on the one machine: the dashboard, Postgres, Hermes and OpenClaw.
Nothing crosses the network, so there are no LAN addresses, firewall rules or
cross-machine token problems to solve.

## 1. Install what the repo needs

```bash
brew install git node pnpm postgresql@16
brew services start postgresql@16
```

## 2. Get the code and its packages

```bash
git clone https://github.com/Smartcontentlab/<repo>.git
cd <repo>
pnpm install
pnpm approve-builds --all   # pnpm blocks esbuild's native build script by default
```

## 3. Create the database

```bash
createdb mission_control
```

## 4. Write the environment file

```bash
cp .env.example .env
```

Then fill in `.env`:

- `DATABASE_URL` — `postgresql://$(whoami)@localhost:5432/mission_control`.
  Homebrew's Postgres uses your macOS username with no password, unlike the
  `postgres:postgres` default in the example file.
- `SESSION_SECRET` — a long random string, **different from the one on Windows**.
  It encrypts saved runtime tokens, so a shared value is not portable and a
  changed value makes previously saved tokens unreadable. You re-add runtime
  connections on each machine regardless.
- `NVIDIA_API_KEY` and `TAVILY_API_KEY` — copy from the Windows `.env`; these
  are plain API keys and travel fine.
- `STRIPE_API_KEY` — the test-mode key, if you have created one yet.

## 5. Create the tables

```bash
pnpm --filter @workspace/db run push
```

## 6. Start the two servers

```bash
pnpm --filter @workspace/api-server run build
pnpm --filter @workspace/api-server run start      # API on :5000
pnpm --filter @workspace/mission-control run dev    # UI on :5173
```

The dev server proxies `/api` to the API server, so the UI just works at
<http://localhost:5173>.

## 7. Prove the runtime wiring before touching real agents

```bash
pnpm --filter @workspace/scripts run verify-runtime
```

This starts stand-in Hermes and OpenClaw servers and drives the real adapter
through discovery, launch, status, pause, resume and stop. If it passes, the
dashboard's side is sound, and anything that fails against your real agents is
on their side.

## 8. Connect the real agents

Add a runtime connection in the dashboard for each one.

**Hermes** must answer these over HTTP, with `Authorization: Bearer <token>` if
you set one:

| Request | Returns |
|---|---|
| `GET /v1/health` | any 2xx |
| `GET /v1/capabilities` | `{"features":{"run_submission":true,"run_status":true,"run_stop":true,"run_pause":true,"run_resume":true}}` |
| `POST /v1/runs` | `{"runId":"...","status":"queued"}` — body is `{"input":"...","session_id":"mission-control:<agentId>"}` |
| `GET /v1/runs/{id}` | `{"runId":"...","status":"running"}` |
| `POST /v1/runs/{id}/pause` | `{"status":"paused"}` |
| `POST /v1/runs/{id}/resume` | `{"status":"running"}` |
| `POST /v1/runs/{id}/stop` | `{"status":"stopped"}` |

`scripts/src/mock-runtime.ts` is the exact working version of this contract.

**OpenClaw** must speak WebSocket JSON-RPC at the same URL with `http://`
swapped for `ws://`. It has to accept a `connect` request advertising
`features.methods` including `chat.send` and `chat.abort`, then serve
`chat.send`, `agent.wait` and `chat.abort`. See
`scripts/src/mock-openclaw.ts` for the working version.

Only `stop` is available for OpenClaw runs; pause and resume are not part of
the gateway protocol.

## What does not need setting up

Obsidian. Hermes and OpenClaw already read the vault as their shared memory
layer, so Mission Control reaches your notes through the agents and needs no
vault path, plugin or API key of its own.

## Windows-specific notes that do not apply here

The `PATH` juggling, `winget` installs and the drizzle backslash fix in the
project notes are Windows-only. The Replit `PORT`/`BASE_PATH` requirement was
removed, so no environment variables are needed just to build.
