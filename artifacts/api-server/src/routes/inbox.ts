import { desc, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  CreateDirectMessageBody,
  CreateDirectMessageResponse,
  GetInboxResponse,
  MarkDirectMessageReadResponse,
} from "@workspace/api-zod";
import { agentsTable, approvalsTable, db, directMessagesTable, projectsTable, tasksTable } from "@workspace/db";

const router: IRouter = Router();

type MessageRow = typeof directMessagesTable.$inferSelect;

function serializeMessage(message: MessageRow, projectName: string | null, agentName: string | null) {
  return {
    id: message.id,
    sender: message.sender,
    body: message.body,
    projectId: message.projectId,
    projectName,
    agentId: message.agentId,
    agentName,
    needsReply: message.needsReply,
    readAt: message.readAt ? message.readAt.toISOString() : null,
    createdAt: message.createdAt.toISOString(),
  };
}

router.get("/inbox", async (_req, res): Promise<void> => {
  const [blockedAgents, reviewTasks, pendingApprovals, messages, projects, agents] = await Promise.all([
    db.select().from(agentsTable).where(eq(agentsTable.status, "blocked")),
    db.select().from(tasksTable).where(eq(tasksTable.status, "review")),
    db.select().from(approvalsTable).where(eq(approvalsTable.status, "pending")).orderBy(desc(approvalsTable.createdAt)),
    db.select().from(directMessagesTable).orderBy(desc(directMessagesTable.createdAt)).limit(50),
    db.select().from(projectsTable),
    db.select().from(agentsTable),
  ]);

  const projectName = (id: number | null) => projects.find((project) => project.id === id)?.name ?? null;
  const agentName = (id: number | null) => agents.find((agent) => agent.id === id)?.name ?? null;

  const needsYou = [
    ...blockedAgents.map((agent) => ({
      id: agent.id,
      kind: "agent" as const,
      title: `${agent.name} is blocked`,
      detail: agent.lastActivity ?? agent.currentTask ?? "This operative cannot continue without a decision.",
      risk: null,
      projectId: agent.projectId,
      projectName: projectName(agent.projectId),
      agentId: agent.id,
      agentName: agent.name,
      createdAt: agent.updatedAt.toISOString(),
    })),
    ...reviewTasks.map((task) => ({
      id: task.id,
      kind: "task" as const,
      title: task.title,
      detail: "This task is finished and waiting on your review.",
      risk: null,
      projectId: task.projectId,
      projectName: projectName(task.projectId),
      agentId: task.agentId,
      agentName: agentName(task.agentId),
      createdAt: task.createdAt.toISOString(),
    })),
  ];

  const needsApproval = pendingApprovals.map((approval) => ({
    id: approval.id,
    kind: "approval" as const,
    title: approval.title,
    detail: approval.details ?? approval.action,
    risk: approval.risk,
    projectId: approval.projectId,
    projectName: projectName(approval.projectId),
    agentId: approval.agentId,
    agentName: agentName(approval.agentId),
    createdAt: approval.createdAt.toISOString(),
  }));

  res.json(
    GetInboxResponse.parse({
      needsYou,
      needsApproval,
      directMessages: messages.map((message) => serializeMessage(message, projectName(message.projectId), agentName(message.agentId))),
    }),
  );
});

router.post("/direct-messages", async (req, res): Promise<void> => {
  const parsed = CreateDirectMessageBody.safeParse(req.body);
  if (!parsed.success || parsed.data.body.trim().length === 0) {
    res.status(400).json({ error: "Write a message before sending." });
    return;
  }

  const [message] = await db
    .insert(directMessagesTable)
    .values({
      sender: "operator",
      body: parsed.data.body.trim(),
      projectId: parsed.data.projectId ?? null,
      readAt: new Date(),
    })
    .returning();

  const project = message.projectId
    ? (await db.select().from(projectsTable).where(eq(projectsTable.id, message.projectId)))[0]
    : undefined;

  res.status(201).json(CreateDirectMessageResponse.parse(serializeMessage(message, project?.name ?? null, null)));
});

router.patch("/direct-messages/:messageId/read", async (req, res): Promise<void> => {
  const messageId = Number(req.params.messageId);
  if (!Number.isInteger(messageId)) {
    res.status(404).json({ error: "That message does not exist." });
    return;
  }

  const [message] = await db
    .update(directMessagesTable)
    .set({ readAt: new Date() })
    .where(eq(directMessagesTable.id, messageId))
    .returning();

  if (!message) {
    res.status(404).json({ error: "That message does not exist." });
    return;
  }

  const project = message.projectId
    ? (await db.select().from(projectsTable).where(eq(projectsTable.id, message.projectId)))[0]
    : undefined;
  const agent = message.agentId ? (await db.select().from(agentsTable).where(eq(agentsTable.id, message.agentId)))[0] : undefined;

  res.json(MarkDirectMessageReadResponse.parse(serializeMessage(message, project?.name ?? null, agent?.name ?? null)));
});

export default router;
