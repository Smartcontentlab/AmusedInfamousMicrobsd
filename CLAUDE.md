# Mission Control

A dashboard for running AI agents ("staff") on Hermes and OpenClaw, with projects, tasks, approvals, an inbox, a skills library and a Game Show Arena where contestants compete on levels.

## Rules

- Nothing invented. No demo rows, placeholder sentences, hardcoded stats or timers that do not run. Unknown values are null in the API and an empty state in the UI.
- Never commit `.env`. Ask before anything destructive.
- Step-by-step instructions for the owner. Free and open-source tools first.

## Commands

```
pnpm install
pnpm run typecheck                                   # all packages
pnpm -r --if-present run build                       # all packages
pnpm --filter @workspace/api-server run build        # then: run start
pnpm --filter @workspace/mission-control run dev     # UI on :5173
DATABASE_URL=... pnpm --filter @workspace/db run push   # apply schema (does not read .env)
pnpm --filter @workspace/api-spec run codegen        # after editing openapi.yaml
pnpm --filter @workspace/scripts run verify-runtime  # Hermes + OpenClaw path, uses stand-ins
pnpm --filter @workspace/scripts run purge-demo-data # dry run; add `-- --apply` to delete
```

Check scripts (no test runner): `scripts/node_modules/.bin/tsx artifacts/api-server/src/lib/<name>.check.ts`. `arena-engine.check.ts` needs `DATABASE_URL` and an empty scratch database.

## Map

| Path | What |
|---|---|
| `artifacts/api-server/src/routes/mission-control.ts` | Dashboard, projects, agents, approvals, tasks, skills, arena state and evidence |
| `artifacts/api-server/src/routes/runtime.ts`, `lib/runtime-adapters.ts` | Hermes (HTTP `/v1`) and OpenClaw (WebSocket RPC) links and run control |
| `artifacts/api-server/src/lib/arena-engine.ts` | Runs arena levels: model calls via `nim.ts`, tools via `contestant-tools.ts` |
| `artifacts/api-server/src/lib/tool-unlocks.ts` | Tool list. `engine` scope = what the arena can really do; `runtime` scope = Game Master permissions for Hermes/OpenClaw runs |
| `artifacts/api-server/src/lib/stripe-*.ts`, `routes/arena-race.ts` | Race bar scored from Stripe test-mode payments |
| `artifacts/api-server/src/lib/skill-catalog.ts` | Skills Refresh importer |
| `artifacts/mission-control/src/pages` | One file per page; `arena.tsx`, `agents.tsx` (Staff), `dashboard.tsx` are the big ones |
| `lib/api-spec/openapi.yaml` | API contract. Generates `lib/api-zod` and `lib/api-client-react`; never edit generated files |
| `lib/db/src/schema` | Drizzle tables |
| `scripts/src` | `verify-runtime`, mock Hermes/OpenClaw, `purge-demo-data` |

## Gotchas

- OpenAPI numbers must be `type: number`, never `integer` (see `.agents/memory/openapi-zod-compatibility.md`).
- Routes parse their own responses with zod; a field the contract does not allow is a 500.
- Only `read_page` and (with `TAVILY_API_KEY`) `web_search` exist for arena contestants. Other tools in the list are catalog entries.
- The API reads `.env` at the repo root; the owner's Mac uses `PORT=5050`.
- Details and history: `docs/FIX-PLAN.md`, `HANDOFF.md`, `docs/running-on-a-mac.md`.
