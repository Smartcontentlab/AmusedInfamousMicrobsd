# Handoff: Mission Control fixes (branch `claude/mission-control-fixes`)

Date: 2026-11-11. Base: `main` at `d453a02`.

## What changed

**Invented data removed**
- The demo seeder and the `SEED_DEMO_DATA` flag are gone. No fake staff (NOVA/MICA/ORBIT), projects, revenue, evidence or approvals can be created.
- The two hardcoded "bootstrap" skills are gone. An empty library tells you to press Refresh.
- No placeholder text anywhere: unknown values are `null` in the API and "—" or "None yet" on screen. That covers business idea, next move, runway, velocity, the recommendation, activity, "Calculating…" and the 4:00 timer that never counted down.
- "Advance round" no longer rewrites every contestant's phase, next move and room.
- Idea Lab says it creates a starter template. It no longer claims an agent shaped the idea, and the lead is no longer called "SCOUT".
- Weather shows "unavailable" instead of quietly showing Los Angeles.
- The top bar shows real runtime link status instead of a permanent "LIVE LINK".

**Game Show Arena**
- The tool list tells the truth: only page reading, plus web search with a Tavily key, is available to contestants. Everything else reads "Not wired into the engine yet". Hermes/OpenClaw runs keep only the Game Master's grant/revoke check, since those runtimes bring their own tools.
- A research answer with no pages read is stored with "UNVERIFIED: no pages were read for this answer."
- Manual revenue is labelled "Manual entry (not Stripe-verified)" and needs a reference. It is refused when a Stripe key is set.
- A server restart no longer leaves a level stuck at "already running".
- The same level cannot start twice at once.
- Contestants with no model are skipped and do not burn the daily turn budget.
- Start, pause and advance only work from valid states.
- The win condition is $100 everywhere.
- The page-reading tool blocks local and private addresses, including the IPv6 tricks.
- The page and the race bar rank contestants the same way.

**Everything else**
- Errors come back as JSON with no stack traces or SQL. Out-of-range ids and empty updates get 400.
- An approval can only be decided once (409 on a second click), so a skill install cannot fire twice.
- "Unassigned" in the Staff page works (it used to send nothing).
- Pages refresh each other after changes (approvals, inbox, dashboard, projects, staff).
- `verify-runtime` finds the API port from `.env` and cleans up its test links.

## Get it onto the Mac

In Terminal:

```
cd ~/AmusedInfamousMicrobsd
git fetch origin
git checkout claude/mission-control-fixes
pnpm install
DATABASE_URL="postgresql://$(whoami)@localhost:5432/mission_control" pnpm --filter @workspace/db run push
```

Remove the old demo rows. First see what would go:

```
DATABASE_URL="postgresql://$(whoami)@localhost:5432/mission_control" pnpm --filter @workspace/scripts run purge-demo-data
```

If the list is only demo rows, delete them:

```
DATABASE_URL="postgresql://$(whoami)@localhost:5432/mission_control" pnpm --filter @workspace/scripts run purge-demo-data -- --apply
```

Delete the `SEED_DEMO_DATA` line from `.env`; it no longer does anything. Then restart:

```
pnpm --filter @workspace/api-server run build && pnpm --filter @workspace/api-server run start
```

In a second tab, run `pnpm --filter @workspace/mission-control run dev` and open http://localhost:5173.

Prove the runtime path works: `pnpm --filter @workspace/scripts run verify-runtime`. It needs one staff member with provider `hermes` and one with `openclaw`.

## Checked

- Typecheck and build pass for every package.
- Check scripts pass: `contestant-tools`, `nim`, `stripe-revenue`, `arena-engine`.
- `verify-runtime` passes for both Hermes and OpenClaw (stand-ins).
- Every main API route returns 200 on an empty database. The dashboard returns nulls, not invented numbers.

## Not checked

- No page was opened in a real browser. UI changes were checked by code reading, typecheck and build. Click through Arena, Staff, Dashboard, Idea Lab and Skills first.
- No real NVIDIA, Tavily or Stripe calls: there are no keys in the test workspace.
- Your real Hermes and OpenClaw were not tested; only the stand-ins.

## Still open

- **Stripe scoring (WP3 in `docs/FIX-PLAN.md`):** refunds are not subtracted, only the newest 100 payments are read, currency is ignored, and a slow Stripe call blocks the race bar. It needs a Stripe test key to prove.
- **Runtime audit:** the full Staff page / Hermes / OpenClaw audit never finished. `verify-runtime` passes, but edge cases are unchecked: a runtime dying mid-run, a wrong token, deleting a link with live runs.
- **Small items:** an invalid `dueDate` on inbox messages or to-dos returns 500. "ALL CLEAR" on Projects can show while a query has failed. New agents default to provider "OpenClaw" in the database schema.
- **Archetypes:** `lib/archetypes.ts` holds 16 hardcoded contestant presets. They are design presets, not data shown as real; review if you want them gone.

Never commit `.env`. Your keys live there and in `~/.hermes/.env`.
