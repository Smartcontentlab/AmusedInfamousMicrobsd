# Running Mission Control on another machine

Mission Control is local-first. It runs on your computer, talks to a Postgres database on
that same computer, and connects out to Hermes and OpenClaw wherever you have them running.
Nothing is hosted for you, so each machine needs its own copy of these steps.

Everything below is Windows (PowerShell). On macOS/Linux, swap `winget` for `brew` and the
paths work as-is.

---

## 1. Install the toolchain

```powershell
winget install --id Git.Git -e --source winget
winget install --id OpenJS.NodeJS -e --source winget
winget install --id pnpm.pnpm -e --source winget
winget install --id PostgreSQL.PostgreSQL.16 -e --source winget --override "--mode unattended --unattendedmodeui minimal --superpassword postgres --serverport 5432"
```

Let the Postgres installer finish completely — if it gets interrupted it leaves a broken
install with no `lib` folder. Verify before moving on:

```powershell
Test-Path "C:\Program Files\PostgreSQL\16\lib"
```

Then **open a new terminal** so the updated PATH is picked up.

## 2. Get the code

```powershell
git clone https://github.com/Smartcontentlab/AmusedInfamousMicrobsd.git
cd AmusedInfamousMicrobsd
pnpm approve-builds --all
pnpm install
```

`pnpm approve-builds --all` is required once per machine — pnpm blocks native build scripts
(esbuild) by default and the install fails without it.

## 3. Create the database

```powershell
$env:PGPASSWORD = "postgres"
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -h localhost -c "CREATE DATABASE mission_control;"
```

## 4. Configure environment

Copy `.env.example` to `.env` and fill it in:

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/mission_control
SESSION_SECRET=<long random string, unique per machine>
PORT=5000
NVIDIA_API_KEY=<your key from build.nvidia.com>
```

`.env` is gitignored and never leaves the machine.

Create the tables:

```powershell
pnpm --filter @workspace/db run push
```

## 5. Start it

Two terminals.

**API server:**
```powershell
$env:DATABASE_URL="postgresql://postgres:postgres@localhost:5432/mission_control"
$env:SESSION_SECRET="<same value as your .env>"
$env:PORT="5000"
pnpm --filter @workspace/api-server run build
pnpm --filter @workspace/api-server run start
```

**Dashboard:**
```powershell
$env:PORT="5173"; $env:BASE_PATH="/"; $env:API_PORT="5000"
cd artifacts/mission-control
pnpm run dev
```

Open http://localhost:5173.

---

## 6. Connect Atlas (Hermes) and OpenClaw

This is the part that makes the agents real rather than just records in a database.

**Start the runtimes first.** Mission Control does not launch them — it connects to them.

- Hermes needs its local **API server enabled**, and a provider configured (point it at
  NVIDIA NIM if that is what you are using). Note the port it binds to — commonly `8642`.
- OpenClaw needs its **gateway enabled**. Note its port — commonly `18789`.

Both should be running on the same machine as Mission Control, or reachable from it.

**Then add them in the dashboard:**

1. Go to **Projects → Staff + approvals** (`/agents`), find the **Runtime links** panel.
2. Click **Add link** and fill in:
   - **Name** — anything, e.g. `atlas-hermes`
   - **Provider** — `hermes` or `openclaw` (this picks the protocol, so it must be exact)
   - **Endpoint URL** — `http://127.0.0.1:8642` for Hermes, `http://127.0.0.1:18789` for OpenClaw
   - **Credential** — the API key / gateway token from that runtime
3. Click **Check link**.

What you should see:
- **Healthy** — connected, and capabilities were discovered. Agents assigned to this runtime
  can now actually launch, pause, stop and install skills.
- **"The runtime could not be reached"** — the runtime is not running, or the port is wrong.
- **"The runtime rejected the saved credential"** — wrong token.

The credential is encrypted with `SESSION_SECRET` before it is stored. Because that value
differs per machine, **you re-add runtime links on each machine** — they do not transfer,
by design.

### Protocol notes

The two runtimes speak different protocols, and Mission Control handles both:

- **Hermes** — REST. Calls `GET /v1/health`, `GET /v1/capabilities`, `POST /v1/runs`,
  and `POST /v1/runs/{id}/{pause,resume,stop}`.
- **OpenClaw** — WebSocket JSON-RPC. Opens the gateway socket, performs a `connect`
  handshake at protocol v4 with operator scopes, then issues `chat.send`, `chat.abort`,
  `agent.wait` and `skills.install`.

If a runtime reports healthy but refuses to launch work, check that its own approval
settings allow it. Mission Control holds risky actions for your approval, but it does not
bypass approval rules configured inside Hermes or OpenClaw.

## 7. Choosing models

With `NVIDIA_API_KEY` set, every agent gets a **Model** dropdown (expand a staff member on a
project page). It lists the live NVIDIA NIM catalog and saves your choice per agent, so a
researcher and a scripter can run on different models. Game-show contestants use the same
picker.

Without the key, the dropdown says so plainly and the rest of the app works normally.

---

## Troubleshooting

**`pnpm install` fails on a preinstall script** — you need Git's `sh.exe` on PATH:
`$env:PATH += ";C:\Program Files\Git\bin"`

**`drizzle-kit push` says "No schema files found"** — you are on an old checkout; the config
now normalizes Windows path separators. Pull latest.

**Dashboard loads but every panel is empty** — the API server is not running, or `API_PORT`
does not match the port it is on. The dashboard proxies `/api` to that port.

**Runtime link says unreachable but the runtime is definitely up** — check it is bound to
`127.0.0.1` and not a container-internal address, and that no firewall rule is blocking the port.
