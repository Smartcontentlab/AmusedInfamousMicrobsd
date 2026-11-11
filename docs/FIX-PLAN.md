# Mission Control fix plan

Written 2026-11-10. Status 2026-11-11: WP1, WP2, WP4 and the dashboard pass are done on branch `claude/mission-control-fixes`. WP3 (Stripe) and a full runtime audit are still open. See HANDOFF.md.

## Ground rules (owner's instructions)

- No invented data anywhere. If something is not wired or not known, show nothing or say "not set up". No demo rows, no placeholder sentences, no fake timers.
- Planning and final review: the lead model. Code changes: cheaper subagents, one work package each, run one after another (parallel runs hit the usage limit in minutes).
- Work on branch `claude/mission-control-fixes`. Never commit `.env`. Nothing destructive on the owner's Mac without asking.
- Every fix gets a check that fails before and passes after. `pnpm run typecheck` and `pnpm -r --if-present run build` must stay green.

## Running it in a scratch workspace

```
createdb mission_control
printf 'DATABASE_URL=postgresql://postgres@localhost:5432/mission_control\nSESSION_SECRET=<long random>\nPORT=5050\n' > .env
DATABASE_URL=postgresql://postgres@localhost:5432/mission_control pnpm --filter @workspace/db run push
pnpm --filter @workspace/api-server run build && pnpm --filter @workspace/api-server run start
```

Baseline at commit d453a02: install, typecheck and build all pass. The bugs are in behavior.

## Audit status

| Area | Status |
|---|---|
| A. Game Show Arena (engine, race, Stripe, tools, arena pages) | Done. Findings below. |
| B. Hermes / OpenClaw runtime links and run control, Staff page, `verify-runtime` | Not finished (usage limit). Redo. |
| C. Dashboard, projects, approvals, inbox, skills, todos, app shell, Vite dev setup | Not finished (usage limit). Redo. |

## Work packages

Each package owns its files. Do them in this order; do not run two that share a file at once.

### WP1 — Remove invented data (owner's top priority)

Files: `artifacts/api-server/src/routes/mission-control.ts`, `lib/skill-catalog.ts`, `app.ts`, `lib/db/src/schema/arena.ts`, `.env.example`, `SETUP.md`, `docs/running-on-a-mac.md`, `lib/api-spec/openapi.yaml` (+ codegen) if a field becomes nullable.

1. Delete the demo seeding outright: `demoDataEnabled`, the `SEED_DEMO_DATA` flag, the demo projects, staff, approvals, evidence and the "round 3" bump in `ensureSeeded` / `ensureFeatureRecords`. Keep `ensureArenaRow`. Remove the flag from `.env.example` and the docs.
2. Delete `BOOTSTRAP_CATALOG`. An empty skill library shows an empty state that says to press Refresh. Check Refresh never wipes an existing catalog when the remote is unreachable.
3. `GET /arena`: stop returning "A fresh business idea is being shaped." and "Choose the next experiment." Return null and let the UI show nothing.
4. `POST /arena/advance`: stop overwriting every agent's `phase`, `nextMove` and `computerStatus`. Only recompute score and income from evidence. `reset` clears arena-scoped scores, income and evidence labels it created.
5. Manual revenue: with a Stripe key set, reject manual `revenue_cents` (409). Without one, require `evidenceRef` and store `verifiedBy` as "Manual entry (not Stripe-verified)". Never write "Game Master" on a manual row. Bound `value` to int4.
6. Win condition: one source of truth, `arena.winConditionCents`. Fix the hardcoded `/10000`, the 50000 schema default, and move the repair out of the demo branch.
7. Gate arena transitions: `start` from ready/paused, `advance` from live, nothing after complete except reset.
8. `seedPromise` / `featureSeedPromise`: clear on rejection so one DB blip does not 500 every route until restart.
9. `app.ts`: JSON error handler (no HTML stack traces, no SQL in responses); 400 for ids outside int4 and for malformed JSON.
10. Provide `scripts/src/purge-demo-data.ts`: lists, then with `--apply` deletes, rows the old seeder created (agents NOVA/MICA/ORBIT, projects Lumen Invite Flow / Kite Payout Audit / Relay Webhooks, evidence with source "Game Master demo telemetry", the three seeded approvals, the two bootstrap skills). Dry run by default. The owner's Mac database still holds these.

### WP2 — Arena engine honesty and safety

Files: `lib/arena-engine.ts`, `lib/contestant-tools.ts`, `lib/tool-unlocks.ts`, `lib/nim.ts`, `lib/model-catalog.ts`, `routes/arena-engine.ts`, `routes/models.ts`, `index.ts`.

1. Tool list tells the truth: only `read_page` and (with a Tavily key) `web_search` are real. `code_execution`, `local_files`, `payments` and the rest are reported as "not wired yet", never `available: true`.
2. On boot, mark `queued`/`running` turns as failed ("Server restarted") and reset agents left `working`. Add `.catch` to `void runTurn(...)`.
3. Serialize `startLevel` (in-process mutex or advisory lock) so a level cannot start twice.
4. Skip agents with no model; 409 if none can play. Failed and skipped turns do not count against the 150/day budget.
5. A research turn with zero successful `read_page`/`web_search` steps is stored with a visible "no research performed, unverified" flag. Expose which cited URLs were actually fetched.
6. `read_page` SSRF: unwrap IPv4-mapped IPv6 (`::ffff:7f00:1`), block `fe80::/10`, `64:ff9b::/96`, `2002::/16`; cap the body while streaming.
7. Model PATCH: validate against the loaded catalog; drop arbitrary `modelProvider`.
8. Third identical tool call answers from notes instead of failing the turn. Non-JSON 200 from NVIDIA is not an "outage". Guard non-string tool `arguments`.

### WP3 — Stripe scoring

Files: `lib/stripe-revenue.ts`, `lib/stripe-scoring.ts`, `lib/stripe-revenue.check.ts`, `routes/arena-race.ts`.

Subtract refunds, page past 100 intents, filter currency, back off after a failed sync, do not block `GET /arena/race` on the sync, compare against `agents.arena_income_cents`. Needs a Stripe test key to prove end to end; unit-check the scoring with fixtures.

### WP4 — Arena pages

Files: `pages/arena.tsx`, `pages/contestant-builder.tsx`, `components/arena-show-control.tsx`, `components/arena-race.tsx`, `components/model-picker.tsx`, `components/house/*`.

Remove the countdown that never counts. LEADER badge only when top score > 0; rank the page and the race bar the same way. Show null idea/next move as blank. Error states for levels/turns/models queries. Reset builder draft when the contestant id changes. Invalidate race and levels queries after advance, evidence, create and move-in. Blank model option reads "No model (cannot play)". Fix "Assign agents to the Arena project" copy.

### WP5 — Finish audits B and C, then fix what they confirm

Same brief as audit A: confirmed repro, file:line, root cause, minimal fix. Extra attention in C to any hardcoded stats on the home and dashboard pages.

### WP6 — Wrap up

`CLAUDE.md` with a repo map and the commands above (saves every future session from re-exploring). Replace the template `replit.md`. `HANDOFF.md` with ports, env keys, what changed and how to pull it onto the Mac. Lead model reviews the full diff against this plan before push.

## Audit A findings (reference)

High: manual evidence crowns a winner with no verification (`mission-control.ts:1317-1389`); tools advertised that the engine never offers (`tool-unlocks.ts:4-68`); `advance` invents phase / next move / computer status for every agent (`mission-control.ts:1420-1437`); turns stuck after restart block a level forever (`arena-engine.ts:280-352`); SSRF guard misses IPv4-mapped IPv6 (`contestant-tools.ts:14-33`).

Medium: level can start concurrently; answers stored "completed" with no research; timer fixed at 4:00; win condition 50000 vs 10000; Stripe ignores refunds, paging, currency and blocks the race poll; no-model agents burn the daily budget; pause/complete not enforced.

Low: placeholder idea/next-move text and LEADER at zero; any string accepted as a model; HTML/SQL in 500s and int4 overflow; cached rejected seed promise; assorted frontend states (`contestant-builder.tsx:85-90`, `arena-show-control.tsx:90-190`).

Checked and fine: empty-DB responses, bad level ids, no-key and no-model failures are honest, evidence validation, trait budget, tool-loop limits, live Stripe keys refused, no demo rows created with the flag off.
