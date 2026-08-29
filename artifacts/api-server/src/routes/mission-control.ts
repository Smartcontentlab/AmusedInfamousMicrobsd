import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  AdvanceArenaBody,
  AdvanceArenaResponse,
  CreateArenaEvidenceBody,
  CreateArenaEvidenceResponse,
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
  GetAgentToolAccessParams,
  GetAgentToolAccessResponse,
  GetArenaResponse,
  GetDashboardResponse,
  ListAgentCapabilitiesParams,
  ListAgentCapabilitiesResponse,
  ListArenaEvidenceResponse,
  ListAgentsResponse,
  ListApprovalsResponse,
  ListProjectsResponse,
  ListSkillsResponse,
  EquipAgentSkillResponse,
  RefreshSkillCatalogResponse,
  ListTasksResponse,
  ListMissionPlansResponse,
  CreateMissionPlanBody,
  CreateMissionPlanResponse,
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
  UpdateAgentToolUnlockBody,
  UpdateAgentToolUnlockParams,
  UpdateAgentToolUnlockResponse,
} from "@workspace/api-zod";
import {
  agentToolUnlocksTable,
  agentSkillsTable,
  activityTable,
  agentsTable,
  approvalsTable,
  arenaTable,
  arenaEvidenceTable,
  db,
  projectsTable,
  skillsTable,
  tasksTable,
  skillInstallationsTable,
  runtimeConnectionsTable,
  missionItemsTable,
} from "@workspace/db";
import { BOOTSTRAP_CATALOG, APPROVED_CATALOG_SOURCES, importApprovedCatalogs, runtimeSupportsSkillInstall } from "../lib/skill-catalog";
import { adapterError, installRuntimeSkill } from "../lib/runtime-adapters";
import { findSeason0Tool, getAgentToolAccess } from "../lib/tool-unlocks";

const router: IRouter = Router();

let seedPromise: Promise<void> | undefined;
let featureSeedPromise: Promise<void> | undefined;

export async function ensureSeeded(): Promise<void> {
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
      const [agents, _skills, projects, capabilities, approvals] = await Promise.all([
        db.select().from(agentsTable).orderBy(asc(agentsTable.id)),
        db.select().from(skillsTable).orderBy(asc(skillsTable.id)),
        db.select().from(projectsTable).orderBy(asc(projectsTable.id)),
        db.select({ id: agentSkillsTable.id }).from(agentSkillsTable).limit(1),
        db.select({ id: approvalsTable.id, status: approvalsTable.status }).from(approvalsTable),
      ]);

      for (const entry of BOOTSTRAP_CATALOG) {
        const [existing] = await db.select({ id: skillsTable.id }).from(skillsTable).where(eq(skillsTable.externalId, entry.externalId));
        if (!existing) {
          await db.insert(skillsTable).values({
            ...entry,
            importState: "imported",
            importedAt: new Date(),
          });
        }
      }

      const catalogSkills = await db.select().from(skillsTable).orderBy(asc(skillsTable.id));

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

      const existingEvidence = await db.select({ id: arenaEvidenceTable.id }).from(arenaEvidenceTable).limit(1);
      if (existingEvidence.length === 0 && agents.length > 0) {
        await db.insert(arenaEvidenceTable).values(
          agents.flatMap((agent, index) => [
            {
              agentId: agent.id,
              round: Math.max(1, arena?.round ?? 1),
              metric: "website_exists",
              value: 1,
              source: "Game Master demo telemetry",
              note: "Seeded baseline evidence for the local Arena demo.",
            },
            {
              agentId: agent.id,
              round: Math.max(1, arena?.round ?? 1),
              metric: "website_works",
              value: Math.max(0, Math.min(5, 5 - index)),
              source: "Game Master demo telemetry",
              note: "Seeded baseline smoke-test result for the local Arena demo.",
            },
            {
              agentId: agent.id,
              round: Math.max(1, arena?.round ?? 1),
              metric: "revenue_cents",
              value: Math.max(0, agent.arenaIncomeCents),
              source: "Game Master demo telemetry",
              note: "Seeded baseline revenue result; replace with a connected provider receipt.",
            },
          ]),
        );
      }

      if (capabilities.length === 0 && agents.length > 0 && catalogSkills.length > 0) {
        await db.insert(agentSkillsTable).values(
          agents.flatMap((agent, agentIndex) =>
            catalogSkills.slice(0, Math.min(2 + agentIndex, catalogSkills.length)).map((skill) => ({
              agentId: agent.id,
              skillId: skill.id,
            })),
          ),
        );
        await Promise.all(
          agents.map((agent, index) =>
            db
              .update(agentsTable)
              .set({ skillCount: Math.min(2 + index, catalogSkills.length) })
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

      await Promise.all(
        approvals
          .filter((approval) => approval.status === "needs_review")
          .map((approval) => db.update(approvalsTable).set({ status: "pending" }).where(eq(approvalsTable.id, approval.id))),
      );
    })();
  }
  await featureSeedPromise;
}

type ArenaEvidenceMetric =
  | "website_exists"
  | "website_works"
  | "traffic"
  | "signups"
  | "revenue_cents"
  | "conversion_bps"
  | "cost_efficiency"
  | "first_customer_hours"
  | "adaptability";

const arenaEvidenceLabels: Record<ArenaEvidenceMetric, string> = {
  website_exists: "Website exists",
  website_works: "Website works",
  traffic: "Verified visitors",
  signups: "Verified signups",
  revenue_cents: "Revenue",
  conversion_bps: "Conversion rate",
  cost_efficiency: "Cost efficiency",
  first_customer_hours: "Time to first customer",
  adaptability: "Adaptability",
};

function pointsForArenaEvidence(metric: ArenaEvidenceMetric, value: number): number {
  switch (metric) {
    case "website_exists":
      return value > 0 ? 10 : 0;
    case "website_works":
      return Math.min(5, Math.max(0, value));
    case "traffic":
      return value > 0 ? Math.min(10, Math.floor(Math.log10(value) * 3) + 1) : 0;
    case "signups":
      return Math.min(10, Math.max(0, value * 2));
    case "revenue_cents":
      return Math.max(0, Math.floor(value / 1000));
    case "conversion_bps":
      return Math.min(15, Math.max(0, Math.floor(value / 100)));
    case "cost_efficiency":
      return Math.min(10, Math.max(0, value));
    case "first_customer_hours":
      return value <= 0 ? 0 : Math.max(0, Math.min(10, 10 - Math.floor(value / 24)));
    case "adaptability":
      return Math.min(10, Math.max(0, value));
  }
}

function getLatestArenaEvidence(evidence: Array<{ metric: string; value: number }>) {
  const latest = new Map<ArenaEvidenceMetric, { metric: ArenaEvidenceMetric; value: number }>();
  for (const item of evidence) {
    if (item.metric in arenaEvidenceLabels && !latest.has(item.metric as ArenaEvidenceMetric)) {
      latest.set(item.metric as ArenaEvidenceMetric, {
        metric: item.metric as ArenaEvidenceMetric,
        value: item.value,
      });
    }
  }
  return [...latest.values()];
}

function calculateArenaScore(evidence: Array<{ metric: string; value: number }>) {
  const latest = getLatestArenaEvidence(evidence);
  return {
    score: latest.reduce((total, item) => total + pointsForArenaEvidence(item.metric, item.value), 0),
    revenueCents: latest.find((item) => item.metric === "revenue_cents")?.value ?? 0,
    metrics: latest.map((item) => arenaEvidenceLabels[item.metric]),
  };
}

async function getArenaScorecards(agentIds: number[]) {
  const allEvidence = agentIds.length
    ? await db.select().from(arenaEvidenceTable).where(inArray(arenaEvidenceTable.agentId, agentIds)).orderBy(desc(arenaEvidenceTable.verifiedAt))
    : [];
  const grouped = new Map<number, typeof allEvidence>();
  for (const item of allEvidence) {
    grouped.set(item.agentId, [...(grouped.get(item.agentId) ?? []), item]);
  }
  return new Map(agentIds.map((agentId) => {
    const entries = grouped.get(agentId) ?? [];
    const score = calculateArenaScore(entries);
    return [agentId, { ...score, evidenceCount: entries.length, lastVerifiedAt: entries[0]?.verifiedAt ?? null }];
  }));
}

router.get("/dashboard", async (_req, res): Promise<void> => {
  await ensureSeeded();
  const [projects, agents, tasks, activity] = await Promise.all([
    db.select().from(projectsTable),
    db.select().from(agentsTable),
    db.select().from(tasksTable).orderBy(desc(tasksTable.createdAt)).limit(4),
    db.select().from(activityTable).orderBy(desc(activityTable.createdAt)).limit(6),
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
    recentActivity: activity.length
      ? activity.map((item) => {
          const agent = agents.find((candidate) => candidate.id === item.agentId);
          return `${agent?.name ?? "SYSTEM"}: ${item.message}`;
        })
      : ["No live runtime activity has been recorded yet."],
  });
  res.json(data);
});

function buildMissionPlanRecord(item: { id: number; data: Record<string, unknown>; createdAt: Date }) {
  return {
    id: item.id,
    brainDump: String(item.data.brainDump ?? ""),
    summary: String(item.data.summary ?? ""),
    projectId: Number(item.data.projectId),
    projectName: String(item.data.projectName ?? "Untitled project"),
    agentId: Number(item.data.agentId),
    agentName: String(item.data.agentName ?? "Lead operative"),
    agentRole: String(item.data.agentRole ?? "Project lead"),
    taskIds: Array.isArray(item.data.taskIds) ? item.data.taskIds.map(Number) : [],
    approvalId: Number(item.data.approvalId),
    checkpoint: String(item.data.checkpoint ?? "Review the plan before starting outside work."),
    createdAt: item.createdAt.toISOString(),
  };
}

router.get("/mission-plans", async (_req, res): Promise<void> => {
  await ensureSeeded();
  const items = await db
    .select()
    .from(missionItemsTable)
    .where(eq(missionItemsTable.kind, "idea_plan"))
    .orderBy(desc(missionItemsTable.createdAt));
  res.json(ListMissionPlansResponse.parse(items.map(buildMissionPlanRecord)));
});

router.post("/mission-plans", async (req, res): Promise<void> => {
  await ensureSeeded();
  const parsed = CreateMissionPlanBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.message }, "Invalid mission plan input");
    res.status(400).json({ error: "Add at least a sentence describing the idea you want to shape." });
    return;
  }

  const brainDump = parsed.data.brainDump.trim();
  if (brainDump.length < 12) {
    req.log.warn("Invalid mission plan input: brain dump is blank or too short after trimming");
    res.status(400).json({ error: "Add at least a sentence describing the idea you want to shape." });
    return;
  }
  const firstSentence = brainDump.split(/[.!?]/)[0]?.trim() || brainDump;
  const fallbackProjectName = firstSentence
    .replace(/^(i want to|we should|build|create|make)\s+/i, "")
    .split(/\s+/)
    .slice(0, 5)
    .join(" ")
    .replace(/[^a-z0-9 -]/gi, "")
    .trim();
  const projectName = parsed.data.projectName?.trim() || (fallbackProjectName ? `${fallbackProjectName} Lab` : "New venture lab");
  const leadName = parsed.data.leadName?.trim() || "SCOUT";
  const leadRole = parsed.data.leadRole?.trim() || "Idea lead";
  const provider = parsed.data.provider?.trim() || "OpenClaw";
  const summary = `Shape ${projectName} into a small, testable launch loop: clarify the user, prove demand, then review the first signal.`;
  const tasksToCreate = [
    `Clarify the user and smallest useful version for ${projectName}`,
    `Run one low-cost demand test for ${projectName}`,
    `Prepare a decision brief with the first signal`,
  ];

  const [project] = await db.insert(projectsTable).values({
    name: projectName,
    description: brainDump,
    status: "planning",
  }).returning();
  const [agent] = await db.insert(agentsTable).values({
    name: leadName,
    role: leadRole,
    provider,
    status: "waiting",
    projectId: project.id,
    currentTask: tasksToCreate[0],
    room: "Idea Studio",
    computerStatus: "ready",
    businessIdea: brainDump,
    phase: "idea",
    nextMove: "Wait for the operator to approve the launch checkpoint.",
  }).returning();
  const tasks = await db.insert(tasksTable).values(
    tasksToCreate.map((title, index) => ({
      title,
      projectId: project.id,
      agentId: agent.id,
      priority: index === 0 ? "high" : "medium",
      status: "queued",
    })),
  ).returning();
  const [approval] = await db.insert(approvalsTable).values({
    projectId: project.id,
    agentId: agent.id,
    title: `Approve the ${projectName} launch loop`,
    action: "Approve the first experiment",
    details: `The main agent shaped this brain dump into a project, a lead operative, and ${tasks.length} starter tasks. Review the scope before any outside action begins.`,
    reason: "New ideas remain paused until a human confirms the project shape and first experiment.",
    requestedAction: "Review the project brief, then approve, request changes, or hand the loop to a different owner.",
    risk: "medium",
    status: "pending",
  }).returning();
  const [item] = await db.insert(missionItemsTable).values({
    kind: "idea_plan",
    name: projectName,
    data: {
      brainDump,
      summary,
      projectId: project.id,
      projectName: project.name,
      agentId: agent.id,
      agentName: agent.name,
      agentRole: agent.role,
      taskIds: tasks.map((task) => task.id),
      approvalId: approval.id,
      checkpoint: "Review the project shape and approve the first experiment before dispatch.",
    },
  }).returning();

  res.status(201).json(CreateMissionPlanResponse.parse(buildMissionPlanRecord(item)));
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

router.get("/agents/:agentId/tool-unlocks", async (req, res): Promise<void> => {
  await ensureSeeded();
  const params = GetAgentToolAccessParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Contestant identifier is invalid." });
    return;
  }
  const [agent] = await db.select({ id: agentsTable.id }).from(agentsTable).where(eq(agentsTable.id, params.data.agentId));
  if (!agent) {
    res.status(404).json({ error: "Contestant not found." });
    return;
  }
  res.json(GetAgentToolAccessResponse.parse(await getAgentToolAccess(agent.id)));
});

router.patch("/agents/:agentId/tool-unlocks/:toolKey", async (req, res): Promise<void> => {
  await ensureSeeded();
  const params = UpdateAgentToolUnlockParams.safeParse(req.params);
  const body = UpdateAgentToolUnlockBody.safeParse(req.body);
  if (!params.success || !body.success || !body.data.reason.trim()) {
    res.status(400).json({ error: "Choose grant or revoke and add a reason for the audit trail." });
    return;
  }
  const tool = findSeason0Tool(params.data.toolKey);
  if (!tool) {
    res.status(404).json({ error: "That tool is not part of the Season 0 catalog." });
    return;
  }
  const [[agent], [arena]] = await Promise.all([
    db.select({ id: agentsTable.id, name: agentsTable.name }).from(agentsTable).where(eq(agentsTable.id, params.data.agentId)),
    db.select({ round: arenaTable.round }).from(arenaTable).limit(1),
  ]);
  if (!agent) {
    res.status(404).json({ error: "Contestant not found." });
    return;
  }
  const round = arena?.round ?? 1;
  const reason = body.data.reason.trim();
  await db.insert(agentToolUnlocksTable).values({
    agentId: agent.id,
    toolKey: tool.key,
    action: body.data.action,
    reason,
    actor: "Game Master",
    round,
  });
  await db.insert(activityTable).values({
    agentId: agent.id,
    kind: body.data.action === "grant" ? "tool_unlock_granted" : "tool_unlock_revoked",
    message: `Game Master ${body.data.action === "grant" ? "granted" : "revoked"} ${tool.label} in Round ${round}: ${reason}`,
  });
  const access = await getAgentToolAccess(agent.id, round);
  const updatedTool = access.tools.find((item) => item.key === tool.key);
  res.json(UpdateAgentToolUnlockResponse.parse(updatedTool));
});

async function getAgentCapabilities(agentId: number) {
  const capabilities = await db
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
  const installations = await db
    .select()
    .from(skillInstallationsTable)
    .where(eq(skillInstallationsTable.agentId, agentId))
    .orderBy(desc(skillInstallationsTable.createdAt));
  return capabilities.map((capability) => {
    const installation = installations.find((item) => item.skillId === capability.skillId);
    return {
      ...capability,
      installationStatus: installation?.status,
      installationMessage: installation?.message,
      installationUpdatedAt: installation?.updatedAt ?? null,
    };
  });
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
  res.json(ListApprovalsResponse.parse(approvals.map((approval) => ({
    ...approval,
    resolvedAt: approval.resolvedAt?.toISOString() ?? null,
  }))));
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
  if (body.data.status === "approved" && approval.agentId) {
    await dispatchApprovedSkillInstallation(approval.agentId);
  } else if (body.data.status === "rejected" && approval.agentId) {
    const [installation] = await db
      .select()
      .from(skillInstallationsTable)
      .where(and(eq(skillInstallationsTable.agentId, approval.agentId), eq(skillInstallationsTable.status, "awaiting_approval")))
      .orderBy(desc(skillInstallationsTable.updatedAt))
      .limit(1);
    if (installation) {
      await db.update(skillInstallationsTable).set({
        status: "blocked",
        message: "Human approval was declined. No runtime installation request was sent.",
      }).where(eq(skillInstallationsTable.id, installation.id));
    }
  }
  res.json(UpdateApprovalResponse.parse({
    ...approval,
    resolvedAt: approval.resolvedAt?.toISOString() ?? null,
  }));
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

router.post("/skills/refresh", async (_req, res): Promise<void> => {
  await ensureSeeded();
  const result = await importApprovedCatalogs();
  const existingCatalog = (await db.select().from(skillsTable)).filter((skill) => skill.sourceKind === "catalog");
  const incomingIds = new Set(result.entries.map((entry) => entry.externalId));
  let imported = 0;
  let updated = 0;

  for (const entry of result.entries) {
    const [existing] = await db.select({ id: skillsTable.id }).from(skillsTable).where(eq(skillsTable.externalId, entry.externalId));
    if (existing) {
      await db.update(skillsTable).set({ ...entry, importState: "imported", importError: null, importedAt: new Date() }).where(eq(skillsTable.id, existing.id));
      updated += 1;
    } else {
      await db.insert(skillsTable).values({ ...entry, importState: "imported", importedAt: new Date() });
      imported += 1;
    }
  }

  for (const skill of existingCatalog) {
    const belongsToRefreshSource = APPROVED_CATALOG_SOURCES.some((source) => skill.sourceName === source.name);
    if (belongsToRefreshSource && skill.externalId && !incomingIds.has(skill.externalId) && result.errors.length > 0) {
      await db.update(skillsTable).set({
        importState: "unavailable",
        importError: result.errors.find((error) => error.startsWith(`${skill.sourceName}:`)) ?? "The approved repository did not return this entry.",
      }).where(eq(skillsTable.id, skill.id));
    }
  }

  res.json(RefreshSkillCatalogResponse.parse({
    imported,
    updated,
    skipped: existingCatalog.filter((skill) => skill.externalId && incomingIds.has(skill.externalId)).length,
    errors: result.errors,
    sources: APPROVED_CATALOG_SOURCES.map(({ name, repositoryUrl, skillsPath }) => ({ name, repositoryUrl, skillsPath })),
  }));
});

async function latestInstallation(agentId: number, skillId: number) {
  const [installation] = await db
    .select()
    .from(skillInstallationsTable)
    .where(and(eq(skillInstallationsTable.agentId, agentId), eq(skillInstallationsTable.skillId, skillId)))
    .orderBy(desc(skillInstallationsTable.createdAt))
    .limit(1);
  return installation;
}

async function createApprovalForSkill(agent: { id: number; projectId: number | null }, skill: {
  name: string;
  description: string;
  requiresApproval: boolean;
  sideEffectRisk: string;
  installMethod: string;
}) {
  if (!agent.projectId) return null;
  const title = `Equip ${skill.name} on ${agent.id}`;
  const existing = await db.select().from(approvalsTable).where(eq(approvalsTable.agentId, agent.id));
  const pending = existing.find((approval) => approval.status === "pending" && approval.title === title);
  if (pending) return pending;
  const [approval] = await db.insert(approvalsTable).values({
    projectId: agent.projectId,
    agentId: agent.id,
    title,
    action: "Approve skill installation",
    details: `${skill.description} Install method: ${skill.installMethod}.`,
    reason: skill.requiresApproval
      ? "This skill can create external side effects and needs a human clearance before installation."
      : "The skill has no verified automatic installation contract.",
    requestedAction: "Review the skill source and approve installation if it is appropriate for this staff member.",
    risk: skill.sideEffectRisk === "low" ? "medium" : "high",
  }).returning();
  return approval;
}

async function dispatchApprovedSkillInstallation(agentId: number): Promise<void> {
  const [installation] = await db
    .select()
    .from(skillInstallationsTable)
    .where(and(eq(skillInstallationsTable.agentId, agentId), eq(skillInstallationsTable.status, "awaiting_approval")))
    .orderBy(desc(skillInstallationsTable.updatedAt))
    .limit(1);
  if (!installation) return;

  const [[agent], [skill]] = await Promise.all([
    db.select().from(agentsTable).where(eq(agentsTable.id, agentId)),
    db.select().from(skillsTable).where(eq(skillsTable.id, installation.skillId)),
  ]);
  if (!agent || !skill) {
    await db.update(skillInstallationsTable).set({ status: "blocked", message: "Approval was granted, but the skill or staff record no longer exists." }).where(eq(skillInstallationsTable.id, installation.id));
    return;
  }
  const connections = await db.select().from(runtimeConnectionsTable);
  const connection = agent.runtimeConnectionId
    ? connections.find((item) => item.id === agent.runtimeConnectionId)
    : connections.find((item) => item.provider.toLowerCase() === agent.provider.toLowerCase());
  if (!connection || !runtimeSupportsSkillInstall(connection)) {
    await db.update(skillInstallationsTable).set({
      status: "not_supported",
      runtimeConnectionId: connection?.id ?? null,
      message: connection
        ? "Approval granted. The linked runtime does not advertise skill installation."
        : "Approval granted. No linked compatible runtime is available for installation.",
    }).where(eq(skillInstallationsTable.id, installation.id));
    return;
  }

  await db.update(skillInstallationsTable).set({
    status: "installing",
    runtimeConnectionId: connection.id,
    message: "Approval granted. Sending the installation request to the linked runtime.",
  }).where(eq(skillInstallationsTable.id, installation.id));
  try {
    const result = await installRuntimeSkill(connection, skill);
    await db.update(skillInstallationsTable).set({
      status: "installed",
      providerRequestId: result.providerRequestId,
      message: result.message,
    }).where(eq(skillInstallationsTable.id, installation.id));
  } catch (error) {
    const failure = adapterError(error);
    await db.update(skillInstallationsTable).set({
      status: "failed",
      message: `Approval was granted, but installation failed: ${failure.message}`,
    }).where(eq(skillInstallationsTable.id, installation.id));
  }
}

router.post("/agents/:agentId/skills/:skillId/equip", async (req, res): Promise<void> => {
  await ensureSeeded();
  const agentId = Number(req.params.agentId);
  const skillId = Number(req.params.skillId);
  if (!Number.isInteger(agentId) || !Number.isInteger(skillId)) {
    res.status(400).json({ error: "Agent and skill identifiers are invalid." });
    return;
  }
  const [[agent], [skill]] = await Promise.all([
    db.select().from(agentsTable).where(eq(agentsTable.id, agentId)),
    db.select().from(skillsTable).where(eq(skillsTable.id, skillId)),
  ]);
  if (!agent || !skill) {
    res.status(404).json({ error: "Agent or skill not found." });
    return;
  }
  if (skill.importState !== "imported" && skill.sourceKind === "catalog") {
    res.status(409).json({ error: skill.importError ?? "This catalog entry is not currently available from its approved source." });
    return;
  }

  let [assignment] = await db.select().from(agentSkillsTable).where(and(eq(agentSkillsTable.agentId, agentId), eq(agentSkillsTable.skillId, skillId)));
  if (!assignment) {
    [assignment] = await db.insert(agentSkillsTable).values({ agentId, skillId }).returning();
    await db.update(agentsTable).set({ skillCount: (await getAgentCapabilities(agentId)).length }).where(eq(agentsTable.id, agentId));
  }

  const compatible = skill.compatibleRuntimes.length === 0 || skill.compatibleRuntimes.some((runtime) => runtime.toLowerCase() === agent.provider.toLowerCase());
  const automaticInstall = ["skills.install", "skill_install", "install_skill"].includes(skill.installMethod.toLowerCase());
  let installation = await latestInstallation(agentId, skillId);
  if (!installation || ["failed", "not_supported", "blocked", "awaiting_approval"].includes(installation.status)) {
    [installation] = await db.insert(skillInstallationsTable).values({
      agentId,
      skillId,
      status: "queued",
      message: "Local capability equipped. Checking the linked runtime before remote installation.",
    }).returning();
  }

  if (!compatible) {
    [installation] = await db.update(skillInstallationsTable).set({
      status: "blocked",
      message: `This skill is compatible with ${skill.compatibleRuntimes.join(" or ")}, not ${agent.provider}. Local assignment is kept; no remote request was sent.`,
    }).where(eq(skillInstallationsTable.id, installation.id)).returning();
  } else if (skill.requiresApproval || skill.sideEffectRisk === "unknown" || !automaticInstall) {
    const approval = await createApprovalForSkill(agent, skill);
    [installation] = await db.update(skillInstallationsTable).set({
      status: approval ? "awaiting_approval" : "blocked",
      message: approval
        ? "Local capability equipped. Human approval is required before the runtime can install this skill."
        : "Local capability equipped, but this staff member has no project to hold the required approval.",
    }).where(eq(skillInstallationsTable.id, installation.id)).returning();
  } else {
    const connections = await db.select().from(runtimeConnectionsTable);
    const connection = agent.runtimeConnectionId
      ? connections.find((item) => item.id === agent.runtimeConnectionId)
      : connections.find((item) => item.provider.toLowerCase() === agent.provider.toLowerCase());
    if (!connection) {
      [installation] = await db.update(skillInstallationsTable).set({
        status: "not_supported",
        message: "Local capability equipped. No linked compatible runtime is available for installation.",
      }).where(eq(skillInstallationsTable.id, installation.id)).returning();
    } else if (!runtimeSupportsSkillInstall(connection)) {
      [installation] = await db.update(skillInstallationsTable).set({
        runtimeConnectionId: connection.id,
        status: "not_supported",
        message: "Local capability equipped. This runtime is linked but does not advertise skill installation.",
      }).where(eq(skillInstallationsTable.id, installation.id)).returning();
    } else {
      [installation] = await db.update(skillInstallationsTable).set({
        runtimeConnectionId: connection.id,
        status: "installing",
        message: "The linked runtime accepted the installation request in progress.",
      }).where(eq(skillInstallationsTable.id, installation.id)).returning();
      try {
        const result = await installRuntimeSkill(connection, skill);
        [installation] = await db.update(skillInstallationsTable).set({
          status: "installed",
          providerRequestId: result.providerRequestId,
          message: result.message,
        }).where(eq(skillInstallationsTable.id, installation.id)).returning();
      } catch (error) {
        const failure = adapterError(error);
        [installation] = await db.update(skillInstallationsTable).set({
          status: "failed",
          message: failure.message,
        }).where(eq(skillInstallationsTable.id, installation.id)).returning();
      }
    }
  }

  const capability = (await getAgentCapabilities(agentId)).find((item) => item.skillId === skillId);
  res.status(assignment ? 200 : 201).json(EquipAgentSkillResponse.parse({ capability, installation }));
});

async function getArenaState() {
  await ensureSeeded();
  const [arena] = await db.select().from(arenaTable).limit(1);
  const agents = await db.select().from(agentsTable).orderBy(desc(agentsTable.arenaScore));
  const capabilities = await Promise.all(agents.map((agent) => getAgentCapabilities(agent.id)));
  const toolAccess = await Promise.all(agents.map((agent) => getAgentToolAccess(agent.id, arena?.round ?? 1)));
  const scorecards = await getArenaScorecards(agents.map((agent) => agent.id));
  return GetArenaResponse.parse({
    ...arena,
    scores: agents.map((agent, index) => ({
      ...(() => {
        const loadout = capabilities[index] ?? [];
        const scorecard = scorecards.get(agent.id) ?? { score: 0, revenueCents: 0, metrics: [], evidenceCount: 0, lastVerifiedAt: null };
        return {
          assignedSkills: loadout.map((item) => item.name),
          tools: [...new Set(loadout.map((item) => item.category))],
          toolAccess: toolAccess[index]?.tools ?? [],
          verifiedScore: scorecard.score,
          evidenceCount: scorecard.evidenceCount,
          verifiedMetrics: scorecard.metrics,
          lastVerifiedAt: scorecard.lastVerifiedAt,
        };
      })(),
      agentId: agent.id,
      agentName: agent.name,
      score: scorecards.get(agent.id)?.score ?? 0,
      incomeCents: scorecards.get(agent.id)?.revenueCents ?? 0,
      businessIdea: agent.businessIdea ?? "A fresh business idea is being shaped.",
      room: agent.room,
      computerStatus: agent.computerStatus,
      phase: agent.phase,
      nextMove: agent.nextMove ?? "Choose the next experiment.",
       progressPercent: Math.min(100, Math.round(((scorecards.get(agent.id)?.revenueCents ?? 0) / 10000) * 100)),
      scaleRevenueCents: agent.scaleRevenueCents,
    })),
  });
}

router.get("/arena", async (_req, res): Promise<void> => {
  res.json(await getArenaState());
});

router.get("/arena/evidence", async (_req, res): Promise<void> => {
  await ensureSeeded();
  const evidence = await db
    .select()
    .from(arenaEvidenceTable)
    .orderBy(desc(arenaEvidenceTable.verifiedAt))
    .limit(100);
  res.json(ListArenaEvidenceResponse.parse({ evidence }));
});

router.post("/arena/evidence", async (req, res): Promise<void> => {
  const parsed = CreateArenaEvidenceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Provide a contestant, round, metric, integer result, and evidence source." });
    return;
  }
  await ensureSeeded();
  const [arena] = await db.select().from(arenaTable).limit(1);
  const [agent] = await db
    .select({ id: agentsTable.id, name: agentsTable.name })
    .from(agentsTable)
    .where(eq(agentsTable.id, parsed.data.agentId));
  const source = parsed.data.source.trim();
  const evidenceRef = parsed.data.evidenceRef?.trim() || null;
  const note = parsed.data.note?.trim() || null;
  if (!arena || !agent) {
    res.status(404).json({ error: "Contestant or Arena not found." });
    return;
  }
  if (!source || !Number.isInteger(parsed.data.value) || parsed.data.value < 0 || parsed.data.round < 1 || parsed.data.round > arena.totalRounds) {
    res.status(400).json({ error: `Use a non-negative integer result and a round from 1 to ${arena.totalRounds}.` });
    return;
  }
  if (parsed.data.metric === "website_exists" && parsed.data.value > 1) {
    res.status(400).json({ error: "Website exists must be 0 or 1." });
    return;
  }
  if (parsed.data.metric === "website_works" && parsed.data.value > 5) {
    res.status(400).json({ error: "Website works must be scored from 0 to 5." });
    return;
  }
  if (parsed.data.metric === "conversion_bps" && parsed.data.value > 10000) {
    res.status(400).json({ error: "Conversion rate cannot exceed 100%." });
    return;
  }

  const [evidence] = await db
    .insert(arenaEvidenceTable)
    .values({
      agentId: agent.id,
      round: parsed.data.round,
      metric: parsed.data.metric,
      value: parsed.data.value,
      source: source.slice(0, 160),
      evidenceRef: evidenceRef?.slice(0, 500) ?? null,
      note: note?.slice(0, 500) ?? null,
    })
    .returning();
  const scorecard = (await getArenaScorecards([agent.id])).get(agent.id) ?? {
    score: 0,
    revenueCents: 0,
    metrics: [],
    evidenceCount: 0,
    lastVerifiedAt: null,
  };
  await db
    .update(agentsTable)
    .set({
      arenaScore: scorecard.score,
      arenaIncomeCents: scorecard.revenueCents,
      phase: scorecard.revenueCents >= arena.winConditionCents ? "scale" : "first_100",
      nextMove: scorecard.revenueCents >= arena.winConditionCents
        ? "Double down on the channel that reached the first $100."
        : "Run the next small experiment toward the first $100.",
    })
    .where(eq(agentsTable.id, agent.id));
  await db.insert(activityTable).values({
    agentId: agent.id,
    kind: "arena_evidence_verified",
    message: `Game Master verified ${arenaEvidenceLabels[parsed.data.metric as ArenaEvidenceMetric]} for ${agent.name} via ${source.slice(0, 80)}. Score is now ${scorecard.score}.`,
  });
  res.status(201).json(CreateArenaEvidenceResponse.parse({ evidence, verifiedScore: scorecard.score }));
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
    const scorecards = await getArenaScorecards(agents.map((agent) => agent.id));
    await Promise.all(
      agents.map((agent, index) => {
        const scorecard = scorecards.get(agent.id) ?? { score: 0, revenueCents: 0 };
        return db
          .update(agentsTable)
          .set({
            arenaScore: scorecard.score,
            arenaIncomeCents: scorecard.revenueCents,
            phase: scorecard.revenueCents >= arena.winConditionCents ? "scale" : "first_100",
            computerStatus: index === 0 ? "selling" : "building",
            nextMove: scorecard.revenueCents >= arena.winConditionCents
              ? "Double down on the channel that reached the first $100."
              : "Run the next small experiment toward the first $100.",
          })
          .where(eq(agentsTable.id, agent.id));
      }),
    );
  }

  res.json(AdvanceArenaResponse.parse(await getArenaState()));
});

export default router;