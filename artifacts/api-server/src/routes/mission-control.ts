import { and, asc, desc, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  AdvanceArenaBody,
  AdvanceArenaResponse,
  AttachAgentCapabilityBody,
  AttachAgentCapabilityParams,
  AttachAgentCapabilityResponse,
  CreateAgentBody,
  CreateAgentResponse,
  CreateProjectBody,
  CreateProjectResponse,
  CreateSkillBody,
  CreateSkillResponse,
  CreateTaskBody,
  CreateTaskResponse,
  DetachAgentCapabilityParams,
  GetArenaResponse,
  GetDashboardResponse,
  ListAgentCapabilitiesParams,
  ListAgentCapabilitiesResponse,
  ListAgentsResponse,
  ListApprovalsResponse,
  ListProjectsResponse,
  ListSkillsResponse,
  ListTasksResponse,
  UpdateAgentBody,
  UpdateAgentParams,
  UpdateAgentResponse,
  UpdateApprovalBody,
  UpdateApprovalParams,
  UpdateApprovalResponse,
  UpdateProjectBody,
  UpdateProjectParams,
  UpdateProjectResponse,
  UpdateTaskBody,
  UpdateTaskParams,
  UpdateTaskResponse,
} from "@workspace/api-zod";
import {
  agentSkillsTable,
  agentsTable,
  approvalsTable,
  arenaTable,
  db,
  projectsTable,
  skillsTable,
  tasksTable,
} from "@workspace/db";

const router: IRouter = Router();

let seedPromise: Promise<void> | undefined;
let featureSeedPromise: Promise<void> | undefined;

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
            provider: "OpenClaw",
            status: "working",
            projectId: lumen.id,
            skillCount: 7,
            currentTask: "Ship the invite flow",
            room: "Launch Lab",
            computerStatus: "deploying",
            businessIdea: "A referral engine for creator communities",
            phase: "first_100",
            nextMove: "Publish the first invite landing page",
            arenaScore: 82,
            arenaIncomeCents: 42000,
            scaleRevenueCents: 8400,
          },
          {
            name: "MICA",
            role: "Revenue systems",
            provider: "Hermes",
            status: "reviewing",
            projectId: kite.id,
            skillCount: 5,
            currentTask: "Audit creator payouts",
            room: "Revenue Suite",
            computerStatus: "researching",
            businessIdea: "Automated payout audits for independent creators",
            phase: "first_100",
            nextMove: "Ask for approval to contact five design partners",
            arenaScore: 74,
            arenaIncomeCents: 31000,
            scaleRevenueCents: 5200,
          },
          {
            name: "ORBIT",
            role: "Infrastructure",
            provider: "OpenClaw",
            status: "working",
            projectId: relay.id,
            skillCount: 6,
            currentTask: "Release webhook retries",
            room: "Signal Den",
            computerStatus: "building",
            businessIdea: "Webhook reliability reports for small SaaS teams",
            phase: "idea",
            nextMove: "Ship a clickable demo before the next round",
            arenaScore: 61,
            arenaIncomeCents: 18000,
            scaleRevenueCents: 1800,
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
        winConditionCents: 10000,
      });
    })();
  }

  await seedPromise;
  await ensureFeatureRecords();
}

async function ensureFeatureRecords(): Promise<void> {
  if (!featureSeedPromise) {
    featureSeedPromise = (async () => {
      const [agents, skills, projects, capabilities, approvals] = await Promise.all([
        db.select().from(agentsTable).orderBy(asc(agentsTable.id)),
        db.select().from(skillsTable).orderBy(asc(skillsTable.id)),
        db.select().from(projectsTable).orderBy(asc(projectsTable.id)),
        db.select({ id: agentSkillsTable.id }).from(agentSkillsTable).limit(1),
        db.select({ id: approvalsTable.id }).from(approvalsTable).limit(1),
      ]);

      const worldDefaults = {
        NOVA: {
          provider: "OpenClaw",
          room: "Launch Lab",
          computerStatus: "deploying",
          businessIdea: "A referral engine for creator communities",
          phase: "first_100",
          nextMove: "Publish the first invite landing page",
          scaleRevenueCents: 8400,
        },
        MICA: {
          provider: "Hermes",
          room: "Revenue Suite",
          computerStatus: "researching",
          businessIdea: "Automated payout audits for independent creators",
          phase: "first_100",
          nextMove: "Ask for approval to contact five design partners",
          scaleRevenueCents: 5200,
        },
        ORBIT: {
          provider: "OpenClaw",
          room: "Signal Den",
          computerStatus: "building",
          businessIdea: "Webhook reliability reports for small SaaS teams",
          phase: "idea",
          nextMove: "Ship a clickable demo before the next round",
          scaleRevenueCents: 1800,
        },
      } as const;

      await Promise.all(
        agents
          .filter((agent) => agent.businessIdea === null && agent.room === "studio")
          .map((agent) => {
            const defaults = worldDefaults[agent.name as keyof typeof worldDefaults];
            return defaults
              ? db.update(agentsTable).set(defaults).where(eq(agentsTable.id, agent.id))
              : Promise.resolve();
          }),
      );

      const [arena] = await db.select().from(arenaTable).limit(1);
      if (arena?.winConditionCents === 50000) {
        await db
          .update(arenaTable)
          .set({ winConditionCents: 10000 })
          .where(eq(arenaTable.id, arena.id));
      }

      if (capabilities.length === 0 && agents.length > 0 && skills.length > 0) {
        await db.insert(agentSkillsTable).values(
          agents.flatMap((agent, agentIndex) =>
            skills.slice(0, Math.min(2 + agentIndex, skills.length)).map((skill) => ({
              agentId: agent.id,
              skillId: skill.id,
            })),
          ),
        );
        await Promise.all(
          agents.map((agent, index) =>
            db
              .update(agentsTable)
              .set({ skillCount: Math.min(2 + index, skills.length) })
              .where(eq(agentsTable.id, agent.id)),
          ),
        );
      }

      if (approvals.length === 0 && agents.length > 0 && projects.length > 0) {
        const projectForAgent = (agentIndex: number) => projects[agentIndex] ?? projects[0];
        await db.insert(approvalsTable).values([
          {
            projectId: projectForAgent(0).id,
            agentId: agents[0].id,
            title: "Publish the Lumen invite landing page",
            action: "Approve public launch",
            details: "NOVA has prepared a launch page and email capture flow. Review the public copy before it goes live.",
            risk: "medium",
          },
          {
            projectId: projectForAgent(1).id,
            agentId: agents[1] ? agents[1].id : agents[0].id,
            title: "Contact five payout-audit design partners",
            action: "Approve outbound outreach",
            details: "MICA wants to send a first research message to five prospective creator businesses.",
            risk: "high",
          },
          {
            projectId: projectForAgent(2).id,
            agentId: agents[2] ? agents[2].id : agents[0].id,
            title: "Choose the first pricing experiment",
            action: "Select a price test",
            details: "ORBIT needs a human decision between a free trial and a paid pilot for the webhook report.",
            risk: "low",
          },
        ]);
      }
    })();
  }
  await featureSeedPromise;
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

async function getAgentCapabilities(agentId: number) {
  return db
    .select({
      id: agentSkillsTable.id,
      agentId: agentSkillsTable.agentId,
      skillId: agentSkillsTable.skillId,
      name: skillsTable.name,
      description: skillsTable.description,
      category: skillsTable.category,
      attachedAt: agentSkillsTable.attachedAt,
    })
    .from(agentSkillsTable)
    .innerJoin(skillsTable, eq(agentSkillsTable.skillId, skillsTable.id))
    .where(eq(agentSkillsTable.agentId, agentId))
    .orderBy(asc(skillsTable.name));
}

router.get("/agents/:agentId/capabilities", async (req, res): Promise<void> => {
  await ensureSeeded();
  const params = ListAgentCapabilitiesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Agent identifier is invalid." });
    return;
  }
  res.json(ListAgentCapabilitiesResponse.parse(await getAgentCapabilities(params.data.agentId)));
});

router.post("/agents/:agentId/capabilities", async (req, res): Promise<void> => {
  await ensureSeeded();
  const params = AttachAgentCapabilityParams.safeParse(req.params);
  const body = AttachAgentCapabilityBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Capability assignment is incomplete or invalid." });
    return;
  }

  const [[agent], [skill]] = await Promise.all([
    db.select().from(agentsTable).where(eq(agentsTable.id, params.data.agentId)),
    db.select().from(skillsTable).where(eq(skillsTable.id, body.data.skillId)),
  ]);
  if (!agent || !skill) {
    res.status(404).json({ error: "Agent or capability not found." });
    return;
  }

  const [existing] = await db
    .select()
    .from(agentSkillsTable)
    .where(and(eq(agentSkillsTable.agentId, agent.id), eq(agentSkillsTable.skillId, skill.id)));
  if (existing) {
    const [capability] = await getAgentCapabilities(agent.id).then((items) => items.filter((item) => item.skillId === skill.id));
    res.status(201).json(AttachAgentCapabilityResponse.parse(capability));
    return;
  }

  await db.insert(agentSkillsTable).values({ agentId: agent.id, skillId: skill.id });
  const capabilities = await getAgentCapabilities(agent.id);
  await db.update(agentsTable).set({ skillCount: capabilities.length }).where(eq(agentsTable.id, agent.id));
  const capability = capabilities.find((item) => item.skillId === skill.id);
  res.status(201).json(AttachAgentCapabilityResponse.parse(capability));
});

router.delete("/agents/:agentId/capabilities/:skillId", async (req, res): Promise<void> => {
  await ensureSeeded();
  const params = DetachAgentCapabilityParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Capability assignment is invalid." });
    return;
  }
  const [removed] = await db
    .delete(agentSkillsTable)
    .where(and(eq(agentSkillsTable.agentId, params.data.agentId), eq(agentSkillsTable.skillId, params.data.skillId)))
    .returning();
  if (!removed) {
    res.status(404).json({ error: "Capability assignment not found." });
    return;
  }
  const capabilities = await getAgentCapabilities(params.data.agentId);
  await db
    .update(agentsTable)
    .set({ skillCount: capabilities.length })
    .where(eq(agentsTable.id, params.data.agentId));
  res.sendStatus(204);
});

router.get("/approvals", async (_req, res): Promise<void> => {
  await ensureSeeded();
  const approvals = await db.select().from(approvalsTable).orderBy(asc(approvalsTable.createdAt));
  res.json(ListApprovalsResponse.parse(approvals));
});

router.patch("/approvals/:approvalId", async (req, res): Promise<void> => {
  await ensureSeeded();
  const params = UpdateApprovalParams.safeParse(req.params);
  const body = UpdateApprovalBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Approval update is incomplete or invalid." });
    return;
  }
  const [approval] = await db
    .update(approvalsTable)
    .set({ status: body.data.status, resolvedAt: new Date() })
    .where(eq(approvalsTable.id, params.data.approvalId))
    .returning();
  if (!approval) {
    res.status(404).json({ error: "Approval request not found." });
    return;
  }
  res.json(UpdateApprovalResponse.parse(approval));
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
      businessIdea: agent.businessIdea ?? "A fresh business idea is being shaped.",
      room: agent.room,
      computerStatus: agent.computerStatus,
      phase: agent.phase,
      nextMove: agent.nextMove ?? "Choose the next experiment.",
      progressPercent: Math.min(100, Math.round((agent.arenaIncomeCents / 10000) * 100)),
      scaleRevenueCents: agent.scaleRevenueCents,
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
        {
          const scoreGain = 6 - index;
          const newRevenue = agent.arenaIncomeCents + scoreGain * 1200;
          return (
        db
          .update(agentsTable)
          .set({
            arenaScore: agent.arenaScore + scoreGain,
            arenaIncomeCents: newRevenue,
            scaleRevenueCents: agent.scaleRevenueCents + scoreGain * 450,
            phase: newRevenue >= arena.winConditionCents ? "scale" : "first_100",
            computerStatus: index === 0 ? "selling" : "building",
            nextMove: newRevenue >= arena.winConditionCents
              ? "Double down on the channel that reached the first $100."
              : "Run the next small experiment toward the first $100.",
          })
          .where(and(eq(agentsTable.id, agent.id)))
          );
        },
      ),
    );
  }

  res.json(AdvanceArenaResponse.parse(await getArenaState()));
});

export default router;