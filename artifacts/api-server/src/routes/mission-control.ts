import { and, asc, desc, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  AdvanceArenaBody,
  AdvanceArenaResponse,
  CreateAgentBody,
  CreateAgentResponse,
  CreateProjectBody,
  CreateProjectResponse,
  CreateSkillBody,
  CreateSkillResponse,
  CreateTaskBody,
  CreateTaskResponse,
  GetArenaResponse,
  GetDashboardResponse,
  ListAgentsResponse,
  ListProjectsResponse,
  ListSkillsResponse,
  ListTasksResponse,
  UpdateAgentBody,
  UpdateAgentParams,
  UpdateAgentResponse,
  UpdateProjectBody,
  UpdateProjectParams,
  UpdateProjectResponse,
  UpdateTaskBody,
  UpdateTaskParams,
  UpdateTaskResponse,
} from "@workspace/api-zod";
import {
  agentsTable,
  arenaTable,
  db,
  projectsTable,
  skillsTable,
  tasksTable,
} from "@workspace/db";

const router: IRouter = Router();

let seedPromise: Promise<void> | undefined;

async function ensureSeeded(): Promise<void> {
  if (!seedPromise) {
    seedPromise = (async () => {
      const existing = await db.select({ id: projectsTable.id }).from(projectsTable).limit(1);
      if (existing.length > 0) return;

      const projects = await db
        .insert(projectsTable)
        .values([
          {
            name: "Lumen Invite Flow",
            description: "Creator referral flow preparing for a controlled launch.",
            status: "building",
            incomeCents: 328000,
          },
          {
            name: "Kite Payout Audit",
            description: "Automated payout reconciliation for creator businesses.",
            status: "review",
            incomeCents: 187000,
          },
          {
            name: "Relay Webhooks",
            description: "Reliable delivery and observability for event workflows.",
            status: "live",
            incomeCents: 87000,
          },
        ])
        .returning();

      const lumen = projects.find((project) => project.name === "Lumen Invite Flow");
      const kite = projects.find((project) => project.name === "Kite Payout Audit");
      const relay = projects.find((project) => project.name === "Relay Webhooks");

      if (!lumen || !kite || !relay) return;

      const agents = await db
        .insert(agentsTable)
        .values([
          {
            name: "NOVA",
            role: "Lead orchestration",
            status: "working",
            projectId: lumen.id,
            skillCount: 7,
            currentTask: "Ship the invite flow",
            arenaScore: 82,
            arenaIncomeCents: 42000,
          },
          {
            name: "MICA",
            role: "Revenue systems",
            status: "reviewing",
            projectId: kite.id,
            skillCount: 5,
            currentTask: "Audit creator payouts",
            arenaScore: 74,
            arenaIncomeCents: 31000,
          },
          {
            name: "ORBIT",
            role: "Infrastructure",
            status: "working",
            projectId: relay.id,
            skillCount: 6,
            currentTask: "Release webhook retries",
            arenaScore: 61,
            arenaIncomeCents: 18000,
          },
        ])
        .returning();

      const nova = agents.find((agent) => agent.name === "NOVA");
      const mica = agents.find((agent) => agent.name === "MICA");
      const orbit = agents.find((agent) => agent.name === "ORBIT");

      await db.insert(tasksTable).values([
        { title: "Map onboarding friction", projectId: lumen.id, agentId: nova?.id, priority: "high" },
        { title: "Ship the invite flow", projectId: lumen.id, agentId: nova?.id, priority: "high", status: "active" },
        { title: "Audit creator payouts", projectId: kite.id, agentId: mica?.id, priority: "high", status: "review" },
        { title: "Release webhook retries", projectId: relay.id, agentId: orbit?.id, priority: "medium", status: "active" },
      ]);

      await db.insert(skillsTable).values([
        {
          name: "Revenue Analyst",
          description: "Turns messy billing data into a clear opportunity list.",
          category: "Revenue",
          enabled: true,
        },
        {
          name: "Product QA",
          description: "Finds friction, edge cases, and launch blockers before users do.",
          category: "Quality",
          enabled: true,
        },
        {
          name: "Webhook Surgeon",
          description: "Diagnoses event delivery failures and proposes resilient fixes.",
          category: "Infrastructure",
          enabled: true,
        },
      ]);

      await db.insert(arenaTable).values({
        round: 3,
        totalRounds: 5,
        status: "ready",
        secondsRemaining: 240,
        winConditionCents: 50000,
      });
    })();
  }

  await seedPromise;
}

router.get("/dashboard", async (_req, res): Promise<void> => {
  await ensureSeeded();
  const [projects, agents, tasks] = await Promise.all([
    db.select().from(projectsTable),
    db.select().from(agentsTable),
    db.select().from(tasksTable).orderBy(desc(tasksTable.createdAt)).limit(4),
  ]);

  const monthlyIncomeCents = projects.reduce((total, project) => total + project.incomeCents, 0);
  const activeAgentCount = agents.filter((agent) => agent.status === "working" || agent.status === "reviewing").length;
  const reviewTask = tasks.find((task) => task.status === "review");
  const data = GetDashboardResponse.parse({
    monthlyIncomeCents,
    runwayDays: 18.4,
    velocityPercent: 27,
    activeAgentCount,
    recommendation: reviewTask
      ? `Review “${reviewTask.title}” before moving more work into the queue.`
      : "Choose the next task you want your lead agent to prioritize.",
    recentActivity: [
      "NOVA moved the Lumen invite flow into active build.",
      "MICA is reviewing the Kite payout audit.",
      "ORBIT completed a webhook retry checkpoint.",
    ],
  });
  res.json(data);
});

router.get("/projects", async (_req, res): Promise<void> => {
  await ensureSeeded();
  const data = ListProjectsResponse.parse(await db.select().from(projectsTable).orderBy(desc(projectsTable.updatedAt)));
  res.json(data);
});

router.post("/projects", async (req, res): Promise<void> => {
  await ensureSeeded();
  const parsed = CreateProjectBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.message }, "Invalid project input");
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [project] = await db.insert(projectsTable).values(parsed.data).returning();
  res.status(201).json(CreateProjectResponse.parse(project));
});

router.patch("/projects/:projectId", async (req, res): Promise<void> => {
  await ensureSeeded();
  const params = UpdateProjectParams.safeParse(req.params);
  const body = UpdateProjectBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Project update is incomplete or invalid." });
    return;
  }
  const [project] = await db
    .update(projectsTable)
    .set(body.data)
    .where(eq(projectsTable.id, params.data.projectId))
    .returning();
  if (!project) {
    res.status(404).json({ error: "Project not found." });
    return;
  }
  res.json(UpdateProjectResponse.parse(project));
});

router.get("/agents", async (_req, res): Promise<void> => {
  await ensureSeeded();
  const data = ListAgentsResponse.parse(await db.select().from(agentsTable).orderBy(asc(agentsTable.name)));
  res.json(data);
});

router.post("/agents", async (req, res): Promise<void> => {
  await ensureSeeded();
  const parsed = CreateAgentBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.message }, "Invalid agent input");
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [agent] = await db.insert(agentsTable).values(parsed.data).returning();
  res.status(201).json(CreateAgentResponse.parse(agent));
});

router.patch("/agents/:agentId", async (req, res): Promise<void> => {
  await ensureSeeded();
  const params = UpdateAgentParams.safeParse(req.params);
  const body = UpdateAgentBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Agent update is incomplete or invalid." });
    return;
  }
  const [agent] = await db
    .update(agentsTable)
    .set(body.data)
    .where(eq(agentsTable.id, params.data.agentId))
    .returning();
  if (!agent) {
    res.status(404).json({ error: "Agent not found." });
    return;
  }
  res.json(UpdateAgentResponse.parse(agent));
});

router.get("/tasks", async (_req, res): Promise<void> => {
  await ensureSeeded();
  const data = ListTasksResponse.parse(await db.select().from(tasksTable).orderBy(desc(tasksTable.createdAt)));
  res.json(data);
});

router.post("/tasks", async (req, res): Promise<void> => {
  await ensureSeeded();
  const parsed = CreateTaskBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.message }, "Invalid task input");
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [task] = await db.insert(tasksTable).values(parsed.data).returning();
  res.status(201).json(CreateTaskResponse.parse(task));
});

router.patch("/tasks/:taskId", async (req, res): Promise<void> => {
  await ensureSeeded();
  const params = UpdateTaskParams.safeParse(req.params);
  const body = UpdateTaskBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Task update is incomplete or invalid." });
    return;
  }
  const [task] = await db
    .update(tasksTable)
    .set(body.data)
    .where(eq(tasksTable.id, params.data.taskId))
    .returning();
  if (!task) {
    res.status(404).json({ error: "Task not found." });
    return;
  }
  res.json(UpdateTaskResponse.parse(task));
});

router.get("/skills", async (_req, res): Promise<void> => {
  await ensureSeeded();
  const data = ListSkillsResponse.parse(await db.select().from(skillsTable).orderBy(asc(skillsTable.name)));
  res.json(data);
});

router.post("/skills", async (req, res): Promise<void> => {
  await ensureSeeded();
  const parsed = CreateSkillBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.message }, "Invalid skill input");
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [skill] = await db.insert(skillsTable).values(parsed.data).returning();
  res.status(201).json(CreateSkillResponse.parse(skill));
});

async function getArenaState() {
  await ensureSeeded();
  const [arena] = await db.select().from(arenaTable).limit(1);
  const agents = await db.select().from(agentsTable).orderBy(desc(agentsTable.arenaScore));
  return GetArenaResponse.parse({
    ...arena,
    scores: agents.map((agent) => ({
      agentId: agent.id,
      agentName: agent.name,
      score: agent.arenaScore,
      incomeCents: agent.arenaIncomeCents,
    })),
  });
}

router.get("/arena", async (_req, res): Promise<void> => {
  res.json(await getArenaState());
});

router.post("/arena/advance", async (req, res): Promise<void> => {
  const parsed = AdvanceArenaBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Choose a valid BuildOff control." });
    return;
  }
  await ensureSeeded();
  const [arena] = await db.select().from(arenaTable).limit(1);
  if (!arena) {
    res.status(404).json({ error: "BuildOff arena not found." });
    return;
  }

  if (parsed.data.action === "reset") {
    await db.update(arenaTable).set({ round: 1, status: "ready", secondsRemaining: 240 }).where(eq(arenaTable.id, arena.id));
  } else if (parsed.data.action === "start") {
    await db.update(arenaTable).set({ status: "live" }).where(eq(arenaTable.id, arena.id));
  } else if (parsed.data.action === "pause") {
    await db.update(arenaTable).set({ status: "paused" }).where(eq(arenaTable.id, arena.id));
  } else {
    const isFinalRound = arena.round >= arena.totalRounds;
    await db
      .update(arenaTable)
      .set({
        round: isFinalRound ? arena.totalRounds : arena.round + 1,
        status: isFinalRound ? "complete" : "live",
        secondsRemaining: isFinalRound ? 0 : 240,
      })
      .where(eq(arenaTable.id, arena.id));
    const agents = await db.select().from(agentsTable);
    await Promise.all(
      agents.map((agent, index) =>
        db
          .update(agentsTable)
          .set({
            arenaScore: agent.arenaScore + 6 - index,
            arenaIncomeCents: agent.arenaIncomeCents + (6 - index) * 1200,
          })
          .where(and(eq(agentsTable.id, agent.id))),
      ),
    );
  }

  res.json(AdvanceArenaResponse.parse(await getArenaState()));
});

export default router;