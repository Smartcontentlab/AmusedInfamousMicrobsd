import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export const approvalsTable = pgTable("approvals", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  agentId: integer("agent_id"),
  title: text("title").notNull(),
  action: text("action"),
  details: text("details"),
  reason: text("reason").notNull().default("Operator review is required."),
  requestedAction: text("requested_action").notNull().default("Review the requested action."),
  risk: text("risk").notNull().default("medium"),
  status: text("status").notNull().default("needs_review"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
});

export const insertApprovalSchema = createInsertSchema(approvalsTable).omit({
  id: true,
  createdAt: true,
  resolvedAt: true,
});

export type Approval = typeof approvalsTable.$inferSelect;