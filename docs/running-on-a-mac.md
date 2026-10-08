# Running Mission Control on a Mac

Everything runs on the one machine: the dashboard, Postgres, Hermes and OpenClaw.
No LAN addresses, no firewall rules, no cross-machine token problems.

Run every command from a normal Terminal window. Where a step says to check
something, check it — the later steps assume the earlier ones worked.

---

## Step 0 — On the WINDOWS machine, push the code

Nothing below works until this is done. Run this in the project folder on Windows:

```bash
git push origin main
```

If it asks for credentials, use your GitHub username and a personal access token
(not your password). Confirm it worked:

```bash
git status -sb
```

You want to see `## main...origin/main` with no `[ahead N]`.

---

## Step 1 — Install Homebrew (skip if you have it)

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

The installer prints two `echo` commands at the end to add Homebrew to your PATH.
Run them. Then check:

```bash
brew --version
```

## Step 2 — Install the tools

```bash
brew install git node pnpm postgresql@16
```

Start the database server and have it come back after a reboot:

```bash
brew services start postgresql@16
```

Postgres command-line tools are not on your PATH by default. Add them:

```bash
echo 'export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

On an Intel Mac the path is `/usr/local/opt/postgresql@16/bin` instead.

Check all four:

```bash
git --version && node --version && pnpm --version && psql --version
```

Node should be 22 or newer. pnpm should be 10 or newer.

## Step 3 — Get the code

```bash
cd ~
git clone https://github.com/Smartcontentlab/AmusedInfamousMicrobsd.git
cd AmusedInfamousMicrobsd
```

Confirm you got the current code — the newest commit should be
`Stop inventing data, and let runtime links be removed`:

```bash
git log --oneline -1
```

If it says something else, Step 0 did not work.

## Step 4 — Install packages

```bash
pnpm install
pnpm approve-builds --all
```

The second command is required. pnpm blocks esbuild's native build script by
default, and the build fails without it. Press `a` to select all, then `y`.

## Step 5 — Create the database

```bash
createdb mission_control
```

Check it exists:

```bash
psql -l | grep mission_control
```

## Step 6 — Write the environment file

```bash
cp .env.example .env
```

Generate a session secret and write the database URL in one go:

```bash
printf '\nDATABASE_URL=postgresql://%s@localhost:5432/mission_control\nSESSION_SECRET=%s\nPORT=5000\nSEED_DEMO_DATA=false\n' "$(whoami)" "$(openssl rand -base64 48 | tr -d '\n/+=')" >> .env
```

Homebrew's Postgres uses your macOS username with no password, which is why the
URL is not the `postgres:postgres` default in the example file.

Now open `.env` and fill in the two API keys:

```bash
open -e .env
```

Set `NVIDIA_API_KEY` and `TAVILY_API_KEY` to the same values as on Windows. To
read them there, run this on the Windows machine:

```bash
grep -E 'NVIDIA_API_KEY|TAVILY_API_KEY' .env
```

Delete any duplicate `DATABASE_URL`, `SESSION_SECRET` or `PORT` lines the copy
left behind — the last one in the file wins, and the appended ones are correct.

Leave `SEED_DEMO_DATA=false`. Turning it on plants demo projects, demo staff and
invented revenue, which is exactly what you do not want on the machine you are
using to judge whether something real works.

## Step 7 — Create the tables

```bash
DATABASE_URL="postgresql://$(whoami)@localhost:5432/mission_control" pnpm --filter @workspace/db run push
```

The `DATABASE_URL` prefix is required: this one script does not read `.env`.
You want `[✓] Changes applied`.

## Step 8 — Start it

Build and start the API server:

```bash
pnpm --filter @workspace/api-server run build
pnpm --filter @workspace/api-server run start
```

Leave that running. Open a **second** Terminal tab (Cmd+T), go back to the
project, and start the interface:

```bash
cd ~/AmusedInfamousMicrobsd
pnpm --filter @workspace/mission-control run dev
```

Open <http://localhost:5173>.

It will look empty — no projects, no staff. That is correct with
`SEED_DEMO_DATA=false`. You are starting from nothing on purpose.

## Step 9 — Load the skill library

The Skills page starts with only a handful of bootstrap entries. Open
<http://localhost:5173/skills> and press **Refresh** to pull the full catalog.

## Step 10 — Prove the wiring before touching your real agents

In a third tab:

```bash
cd ~/AmusedInfamousMicrobsd
pnpm --filter @workspace/scripts run verify-runtime
```

This needs at least one staff member to exist. If it says no agent with provider
"hermes" exists, go to the **Staff** tab, press **Spawn operative**, and create
one with provider `hermes`. Then run it again.

A pass looks like this:

```
  ok  health check — healthy, launch/status/stop/pause/resume
  ok  run launched — pause/resume/stop offered
  ok  run pause → paused    ok  run resume → running    ok  run stop → stopped
  Hermes path: PASS
  OpenClaw path: PASS
```

**This is the important step.** It starts stand-in Hermes and OpenClaw servers
and drives the real adapter through every control. If it passes, the dashboard's
side is sound — so anything that fails afterward is your actual agent's side,
not the app's.

---

## Step 11 — Connect your real Hermes and OpenClaw

Start them as you normally do, and note the port each one listens on.

In the dashboard, go to **Staff** → **Add link**, and add one connection each.
Press **Check link**. Healthy means you are done.

### What your Hermes has to answer

Over HTTP, with `Authorization: Bearer <token>` if you set one:

| Request | Must return |
|---|---|
| `GET /v1/health` | any 2xx |
| `GET /v1/capabilities` | `{"features":{"run_submission":true,"run_status":true,"run_stop":true,"run_pause":true,"run_resume":true}}` |
| `POST /v1/runs` | `{"runId":"...","status":"queued"}` — receives `{"input":"...","session_id":"mission-control:<agentId>"}` |
| `GET /v1/runs/{id}` | `{"runId":"...","status":"running"}` |
| `POST /v1/runs/{id}/pause` | `{"status":"paused"}` |
| `POST /v1/runs/{id}/resume` | `{"status":"running"}` |
| `POST /v1/runs/{id}/stop` | `{"status":"stopped"}` |

To see what yours actually does, before involving the dashboard at all:

```bash
curl -i http://127.0.0.1:<hermes-port>/v1/health
curl -i http://127.0.0.1:<hermes-port>/v1/capabilities
```

`scripts/src/mock-runtime.ts` is a working implementation of the whole contract.
When something mismatches, read that file and compare.

### What your OpenClaw has to answer

WebSocket JSON-RPC at the same URL with `http://` swapped for `ws://`. It must
accept a `connect` request advertising `features.methods` containing
`chat.send` and `chat.abort`, then serve `chat.send`, `agent.wait` and
`chat.abort`. `scripts/src/mock-openclaw.ts` is the working version.

Only `stop` works for OpenClaw runs. Pause and resume are not in the protocol.

---

## Step 12 — Give someone rules and a real task

On the **Staff** tab, open a staff member, expand **Rules & tasks**, and write
their standing brief in markdown:

```markdown
## Role
What this person owns.

## Rules
- Never spend money without approval
- Cite a source for every claim

## Current task
What they should be working on now.
```

Save. That text is sent ahead of every task this person is dispatched, so it is
the brief the agent is actually held to.

Then dispatch a run from the run panel and watch what comes back. That is the
moment you find out whether your systems hold up.

---

## If something breaks

**`pnpm install` fails on a native package** — you skipped
`pnpm approve-builds --all` in Step 4.

**`createdb: command not found`** — the PATH line in Step 2 did not take. Run
`source ~/.zshrc`, or open a new Terminal tab.

**`DATABASE_URL, ensure the database is provisioned`** — you ran the push
without the `DATABASE_URL=` prefix. See Step 7.

**The interface loads but every panel errors** — the API server in the first tab
is not running, or it crashed. Look at that tab.

**`verify-runtime` fails** — this is the app's own wiring, not your agents.
Copy the failing line; it names the exact step that broke.

**Your real Hermes shows unhealthy** — run the two `curl` commands in Step 11.
If `/v1/health` does not answer, the dashboard was never the problem.

## What you do not need to set up

Obsidian. Hermes and OpenClaw already read the vault as their shared memory
layer, so Mission Control reaches your notes through the agents and needs no
vault path, plugin or key of its own.
