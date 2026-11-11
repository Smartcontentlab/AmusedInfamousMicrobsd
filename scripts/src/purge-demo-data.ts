/**
 * Removes the demo rows that older versions of Mission Control planted in the database
 * when SEED_DEMO_DATA was on (and the two placeholder skills they always added).
 *
 *   DATABASE_URL=postgresql://... pnpm --filter @workspace/scripts run purge-demo-data
 *   DATABASE_URL=postgresql://... pnpm --filter @workspace/scripts run purge-demo-data -- --apply
 *
 * Dry run by default: it prints exactly what it would delete and changes nothing.
 * Nothing is deleted without --apply, and an --apply run is a single transaction that
 * rolls back if any count differs from what was planned.
 *
 * Matching is deliberately narrow. A row is only a demo row if it matches what the old
 * seeder wrote (exact names, descriptions, titles, sources). The tables have no database
 * foreign keys, so the references are followed here instead: a demo staff member or
 * project that anything real points at (a task you added, a run, a message, an
 * activity line, evidence from another source...) is left alone and reported as kept.
 */
import pg from "pg";

const apply = process.argv.includes("--apply");
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL must be set.");
  process.exit(1);
}

const DEMO_EVIDENCE_SOURCE = "Game Master demo telemetry";

const DEMO_PROJECTS = [
  { name: "Lumen Invite Flow", description: "Creator referral flow preparing for a controlled launch." },
  { name: "Kite Payout Audit", description: "Automated payout reconciliation for creator businesses." },
  { name: "Relay Webhooks", description: "Reliable delivery and observability for event workflows." },
];

const DEMO_AGENTS = [
  { name: "NOVA", role: "Lead orchestration", provider: "OpenClaw", project: "Lumen Invite Flow" },
  { name: "MICA", role: "Revenue systems", provider: "Hermes", project: "Kite Payout Audit" },
  { name: "ORBIT", role: "Infrastructure", provider: "OpenClaw", project: "Relay Webhooks" },
];

const DEMO_TASKS = [
  { title: "Map onboarding friction", project: "Lumen Invite Flow" },
  { title: "Ship the invite flow", project: "Lumen Invite Flow" },
  { title: "Audit creator payouts", project: "Kite Payout Audit" },
  { title: "Release webhook retries", project: "Relay Webhooks" },
];

const DEMO_APPROVALS = [
  { title: "Publish the Lumen invite landing page", project: "Lumen Invite Flow" },
  { title: "Contact five payout-audit design partners", project: "Kite Payout Audit" },
  { title: "Choose the first pricing experiment", project: "Relay Webhooks" },
];

const DEMO_SKILLS = [
  { name: "Revenue Analyst", description: "Turns messy billing data into a clear opportunity list.", category: "Revenue", externalId: null },
  { name: "Product QA", description: "Finds friction, edge cases, and launch blockers before users do.", category: "Quality", externalId: null },
  { name: "Webhook Surgeon", description: "Diagnoses event delivery failures and proposes resilient fixes.", category: "Infrastructure", externalId: null },
  {
    name: "Skill Creator",
    description: "Guide for creating effective skills for AI coding agents.",
    category: "Core",
    externalId: "voltagent:anthropics/skill-creator",
  },
  {
    name: "Research Briefing",
    description: "Turns a question into a sourced, decision-ready brief with explicit uncertainty.",
    category: "Research",
    externalId: "skilldb:bootstrap/research",
  },
];

type Row = Record<string, any>;
type Db = pg.PoolClient;

async function rows(db: Db, text: string, values: unknown[] = []): Promise<Row[]> {
  return (await db.query(text, values)).rows;
}

const ids = (list: Row[]) => list.map((row) => row.id as number);
const describe = (label: string, list: Row[], format: (row: Row) => string) => {
  console.log(`\n${label}: ${list.length}`);
  for (const row of list) console.log(`  #${row.id}  ${format(row)}`);
};

async function run(db: Db): Promise<{ deletes: Array<{ table: string; ids: number[] }>; arenaReset: boolean }> {
  // ---- Candidates: rows that look exactly like what the seeder wrote. ----
  const projects = await rows(
    db,
    `select id, name from projects where (name, description) in (${DEMO_PROJECTS.map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2})`).join(",")})`,
    DEMO_PROJECTS.flatMap((p) => [p.name, p.description]),
  );
  const projectIdByName = new Map(projects.map((p) => [p.name as string, p.id as number]));

  const agents: Row[] = [];
  for (const demo of DEMO_AGENTS) {
    const projectId = projectIdByName.get(demo.project);
    if (projectId === undefined) continue;
    agents.push(
      ...(await rows(
        db,
        "select id, name, role, provider, project_id from agents where name = $1 and role = $2 and provider = $3 and project_id = $4",
        [demo.name, demo.role, demo.provider, projectId],
      )),
    );
  }

  const tasks: Row[] = [];
  for (const demo of DEMO_TASKS) {
    const projectId = projectIdByName.get(demo.project);
    if (projectId === undefined) continue;
    tasks.push(...(await rows(db, "select id, title, project_id, agent_id from tasks where title = $1 and project_id = $2", [demo.title, projectId])));
  }

  const approvals: Row[] = [];
  for (const demo of DEMO_APPROVALS) {
    const projectId = projectIdByName.get(demo.project);
    if (projectId === undefined) continue;
    approvals.push(...(await rows(db, "select id, title, project_id, agent_id from approvals where title = $1 and project_id = $2", [demo.title, projectId])));
  }

  const skills: Row[] = [];
  for (const demo of DEMO_SKILLS) {
    skills.push(
      ...(await rows(
        db,
        `select id, name from skills where name = $1 and description = $2 and category = $3 and external_id is not distinct from $4`,
        [demo.name, demo.description, demo.category, demo.externalId],
      )),
    );
  }

  const evidence = await rows(db, "select id, agent_id, metric, value from arena_evidence where source = $1", [DEMO_EVIDENCE_SOURCE]);

  // ---- Keep anything real that points at a demo project, staff member or skill. ----
  // Seeded tasks, approvals and evidence are only ever pointed at by their own demo
  // staff, so they can always go. Staff, projects and skills are purged only when no
  // row the seeder did not write refers to them.
  const keptReasons = new Map<string, string[]>();
  const keep = (key: string, reason: string) => keptReasons.set(key, [...(keptReasons.get(key) ?? []), reason]);
  const count = async (blockers: string[], label: string, text: string, values: unknown[]) => {
    const [{ n }] = await rows(db, text, values);
    if (n > 0) blockers.push(`${n} ${label}`);
  };

  const candidateAgentIds = ids(agents);
  const candidateSkillIds = ids(skills);
  const taskIds = ids(tasks);
  const approvalIds = ids(approvals);
  const evidenceIds = ids(evidence);

  for (const agent of [...agents]) {
    const blockers: string[] = [];
    await count(blockers, "task(s) not from the seeder", "select count(*)::int n from tasks where agent_id = $1 and not (id = any($2))", [agent.id, taskIds]);
    await count(blockers, "approval(s) not from the seeder", "select count(*)::int n from approvals where agent_id = $1 and not (id = any($2))", [agent.id, approvalIds]);
    await count(blockers, "evidence row(s) from another source", "select count(*)::int n from arena_evidence where agent_id = $1 and not (id = any($2))", [agent.id, evidenceIds]);
    await count(blockers, "activity line(s)", "select count(*)::int n from activity where agent_id = $1", [agent.id]);
    await count(blockers, "tool unlock(s)", "select count(*)::int n from agent_tool_unlocks where agent_id = $1", [agent.id]);
    await count(blockers, "skill installation(s)", "select count(*)::int n from skill_installations where agent_id = $1", [agent.id]);
    await count(blockers, "arena turn(s)", "select count(*)::int n from arena_turns where agent_id = $1", [agent.id]);
    await count(blockers, "direct message(s)", "select count(*)::int n from direct_messages where agent_id = $1", [agent.id]);
    await count(blockers, "live run(s)", "select count(*)::int n from live_runs where agent_id = $1", [agent.id]);
    await count(blockers, "loop(s)", "select count(*)::int n from agent_loops where agent_id = $1", [agent.id]);
    await count(blockers, "skill assignment(s) beyond the demo skills", "select count(*)::int n from agent_skills where agent_id = $1 and not (skill_id = any($2))", [agent.id, candidateSkillIds]);
    if (blockers.length > 0) {
      agents.splice(agents.indexOf(agent), 1);
      keep(`staff #${agent.id} ${agent.name}`, blockers.join(", "));
    }
  }

  for (const skill of [...skills]) {
    const blockers: string[] = [];
    await count(blockers, "assignment(s) to staff that are not demo staff", "select count(*)::int n from agent_skills where skill_id = $1 and not (agent_id = any($2))", [skill.id, candidateAgentIds]);
    await count(blockers, "installation record(s)", "select count(*)::int n from skill_installations where skill_id = $1", [skill.id]);
    if (blockers.length > 0) {
      skills.splice(skills.indexOf(skill), 1);
      keep(`skill #${skill.id} ${skill.name}`, blockers.join(", "));
    }
  }

  const purgedAgentIds = ids(agents);
  for (const project of [...projects]) {
    const blockers: string[] = [];
    await count(blockers, "staff member(s) that are not being purged", "select count(*)::int n from agents where project_id = $1 and not (id = any($2))", [project.id, purgedAgentIds]);
    await count(blockers, "task(s) not from the seeder", "select count(*)::int n from tasks where project_id = $1 and not (id = any($2))", [project.id, taskIds]);
    await count(blockers, "approval(s) not from the seeder", "select count(*)::int n from approvals where project_id = $1 and not (id = any($2))", [project.id, approvalIds]);
    await count(blockers, "activity line(s)", "select count(*)::int n from activity where project_id = $1", [project.id]);
    await count(blockers, "direct message(s)", "select count(*)::int n from direct_messages where project_id = $1", [project.id]);
    if (blockers.length > 0) {
      projects.splice(projects.indexOf(project), 1);
      keep(`project #${project.id} ${project.name}`, blockers.join(", "));
    }
  }

  // Assignments the seeder made: demo staff to demo skills. They go when either end goes.
  const agentIds = ids(agents);
  const skillIds = ids(skills);
  const agentSkills = await rows(
    db,
    "select id, agent_id, skill_id from agent_skills where agent_id = any($1) and skill_id = any($2) and (agent_id = any($3) or skill_id = any($4))",
    [candidateAgentIds, candidateSkillIds, agentIds, skillIds],
  );

  describe("Projects", projects, (r) => r.name);
  describe("Staff", agents, (r) => `${r.name} (${r.role}, ${r.provider})`);
  describe("Tasks", tasks, (r) => r.title);
  describe("Approvals", approvals, (r) => r.title);
  describe("Arena evidence from the demo seeder", evidence, (r) => `agent #${r.agent_id} ${r.metric}=${r.value}`);
  describe("Skills", skills, (r) => r.name);
  describe("Skill assignments", agentSkills, (r) => `agent #${r.agent_id} -> skill #${r.skill_id}`);

  if (keptReasons.size > 0) {
    console.log("\nLooked like demo rows but kept, because something else references them:");
    for (const [key, reasons] of keptReasons) console.log(`  ${key}: ${reasons.join("; ")}`);
  }

  // The seeder also bumped a fresh arena from round 1 to round 3. Undo that only if the
  // arena is still exactly in that untouched state.
  const [arena] = await rows(db, "select id, round, status, seconds_remaining, winner_agent_id from arena order by id limit 1");
  const arenaReset = Boolean(arena && arena.round === 3 && arena.status === "ready" && arena.seconds_remaining === 240 && arena.winner_agent_id === null);
  console.log(`\nArena round bumped to 3 by the seeder: ${arenaReset ? "yes, would reset to round 1" : "no change needed"}`);

  const deletes = [
    { table: "agent_skills", ids: ids(agentSkills) },
    { table: "arena_evidence", ids: ids(evidence) },
    { table: "approvals", ids: ids(approvals) },
    { table: "tasks", ids: ids(tasks) },
    { table: "agents", ids: agentIds },
    { table: "projects", ids: ids(projects) },
    { table: "skills", ids: skillIds },
  ];
  return { deletes, arenaReset };
}

const pool = new pg.Pool({ connectionString });
const db = await pool.connect();
try {
  console.log(apply ? "APPLY: deleting the rows listed below in one transaction." : "DRY RUN: nothing will be changed. Re-run with --apply to delete.");
  await db.query("begin");
  const { deletes, arenaReset } = await run(db);
  const total = deletes.reduce((sum, d) => sum + d.ids.length, 0);

  if (!apply) {
    await db.query("rollback");
    console.log(`\nWould delete ${total} row(s)${arenaReset ? " and reset the arena round" : ""}. Nothing was changed.`);
  } else {
    // Dependents first, then the rows they point at.
    for (const { table, ids: toDelete } of deletes) {
      if (toDelete.length === 0) continue;
      const result = await db.query(`delete from ${table} where id = any($1)`, [toDelete]);
      if (result.rowCount !== toDelete.length) {
        throw new Error(`Expected to delete ${toDelete.length} from ${table} but deleted ${result.rowCount}. Rolled back.`);
      }
    }
    if (arenaReset) await db.query("update arena set round = 1 where round = 3 and status = 'ready'");
    await db.query("commit");
    console.log(`\nDeleted ${total} row(s)${arenaReset ? " and reset the arena round to 1" : ""}.`);
  }
} catch (error) {
  await db.query("rollback").catch(() => undefined);
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  db.release();
  await pool.end();
}
