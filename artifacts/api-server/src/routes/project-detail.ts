import { asc, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  CreateAgentLoopBody,
  CreateAgentLoopResponse,
  GetProjectDetailResponse,
  ListAgentLoopsResponse,
  UpdateAgentLoopBody,
  UpdateAgentLoopResponse,
} from "@workspace/api-zod";
import { agentLoopsTable, agentsTable, approvalsTable, db, projectsTable, tasksTable } from "@workspace/db";

const router: IRouter = Router();

function serializeLoop(loop: typeof agentLoopsTable.$inferSelect) {
  return {
    id: loop.id,
    agentId: loop.agentId,
    name: loop.name,
    description: loop.description,
    cadence: loop.cadence,
    enabled: loop.enabled,
    lastRunAt: loop.lastRunAt ? loop.lastRunAt.toISOString() : null,
    createdAt: loop.createdAt.toISOString(),
  };
}

router.get("/projects/:projectId/detail", async (req, res): Promise<void> => {
  const projectId = Number(req.params.projectId);
  if (!Number.isInteger(projectId)) {
    res.status(404).json({ error: "That project does not exist." });
    return;
  }

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) {
    res.status(404).json({ error: "That project does not exist." });
    return;
  }

  const [staff, tasks, approvals] = await Promise.all([
    db.select().from(agentsTable).where(eq(agentsTable.projectId, projectId)),
    db.select().from(tasksTable).where(eq(tasksTable.projectId, projectId)).orderBy(asc(tasksTable.createdAt)),
    db.select().from(approvalsTable).where(eq(approvalsTable.projectId, projectId)),
  ]);

  const loops = staff.length
    ? await db.select().from(agentLoopsTable).orderBy(asc(agentLoopsTable.createdAt))
    : [];

  const countByStatus = (status: string) => tasks.filter((task) => task.status === status).length;
  const doneTasks = countByStatus("done");

  res.json(
    GetProjectDetailResponse.parse({
      project: {
        id: project.id,
        name: project.name,
        status: project.status,
        incomeCents: project.incomeCents,
        updatedAt: project.updatedAt.toISOString(),
      },
      description: project.description,
      staff: staff.map((agent) => {
        const agentTasks = tasks.filter((task) => task.agentId === agent.id);
        return {
          id: agent.id,
          name: agent.name,
          role: agent.role,
          status: agent.status,
          provider: agent.provider,
          model: agent.model,
          modelProvider: agent.modelProvider,
          currentTask: agent.currentTask,
          nextMove: agent.nextMove,
          lastActivity: agent.lastActivity,
          room: agent.room,
          skillCount: agent.skillCount,
          capabilities: agent.capabilities,
          openTaskCount: agentTasks.filter((task) => task.status !== "done").length,
          doneTaskCount: agentTasks.filter((task) => task.status === "done").length,
          loops: loops.filter((loop) => loop.agentId === agent.id).map(serializeLoop),
        };
      }),
      tasks: tasks.map((task) => ({
        id: task.id,
        title: task.title,
        status: task.status,
        priority: task.priority,
        projectId: task.projectId,
        agentId: task.agentId,
        createdAt: task.createdAt.toISOString(),
      })),
      approvals: approvals.map((approval) => ({
        id: approval.id,
        title: approval.title,
        action: approval.action,
        details: approval.details,
        reason: approval.reason,
        requestedAction: approval.requestedAction,
        risk: approval.risk,
        status: approval.status,
        projectId: approval.projectId,
        agentId: approval.agentId,
        createdAt: approval.createdAt.toISOString(),
      })),
      progress: {
        totalTasks: tasks.length,
        doneTasks,
        activeTasks: countByStatus("active"),
        reviewTasks: countByStatus("review"),
        queuedTasks: countByStatus("queued"),
        percentComplete: tasks.length === 0 ? 0 : Math.round((doneTasks / tasks.length) * 100),
      },
    }),
  );
});

router.get("/agents/:agentId/loops", async (req, res): Promise<void> => {
  const agentId = Number(req.params.agentId);
  if (!Number.isInteger(agentId)) {
    res.status(404).json({ error: "That agent does not exist." });
    return;
  }
  const loops = await db.select().from(agentLoopsTable).where(eq(agentLoopsTable.agentId, agentId)).orderBy(asc(agentLoopsTable.createdAt));
  res.json(ListAgentLoopsResponse.parse(loops.map(serializeLoop)));
});

router.post("/agents/:agentId/loops", async (req, res): Promise<void> => {
  const agentId = Number(req.params.agentId);
  if (!Number.isInteger(agentId)) {
    res.status(404).json({ error: "That agent does not exist." });
    return;
  }

  const parsed = CreateAgentLoopBody.safeParse(req.body);
  if (!parsed.success || parsed.data.name.trim().length === 0) {
    res.status(400).json({ error: "Give the loop a name." });
    return;
  }

  const [agent] = await db.select().from(agentsTable).where(eq(agentsTable.id, agentId));
  if (!agent) {
    res.status(400).json({ error: "That agent does not exist." });
    return;
  }

  const [loop] = await db
    .insert(agentLoopsTable)
    .values({
      agentId,
      name: parsed.data.name.trim(),
      description: parsed.data.description ?? null,
      cadence: parsed.data.cadence?.trim() || "daily",
    })
    .returning();

  res.status(201).json(CreateAgentLoopResponse.parse(serializeLoop(loop)));
});

router.patch("/agent-loops/:loopId", async (req, res): Promise<void> => {
  const loopId = Number(req.params.loopId);
  if (!Number.isInteger(loopId)) {
    res.status(404).json({ error: "That loop does not exist." });
    return;
  }

  const parsed = UpdateAgentLoopBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "That update is not valid." });
    return;
  }

  const updates: Partial<typeof agentLoopsTable.$inferInsert> = {};
  if (parsed.data.name !== undefined) updates.name = parsed.data.name.trim();
  if (parsed.data.description !== undefined) updates.description = parsed.data.description;
  if (parsed.data.cadence !== undefined) updates.cadence = parsed.data.cadence;
  if (parsed.data.enabled !== undefined) updates.enabled = parsed.data.enabled;

  const [loop] = await db.update(agentLoopsTable).set(updates).where(eq(agentLoopsTable.id, loopId)).returning();
  if (!loop) {
    res.status(404).json({ error: "That loop does not exist." });
    return;
  }

  res.json(UpdateAgentLoopResponse.parse(serializeLoop(loop)));
});

router.delete("/agent-loops/:loopId", async (req, res): Promise<void> => {
  const loopId = Number(req.params.loopId);
  if (!Number.isInteger(loopId)) {
    res.status(404).json({ error: "That loop does not exist." });
    return;
  }
  const [loop] = await db.delete(agentLoopsTable).where(eq(agentLoopsTable.id, loopId)).returning();
  if (!loop) {
    res.status(404).json({ error: "That loop does not exist." });
    return;
  }
  res.status(204).send();
});

export default router;
