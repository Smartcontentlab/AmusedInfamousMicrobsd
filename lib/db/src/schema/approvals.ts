import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export const approvalsTable = pgTable("approvals", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  agentId: integer("agent_id").notNull(),
  title: text("title").notNull(),
  action: text("action").notNull(),
  details: text("details").notNull(),
  risk: text("risk").notNull().default("medium"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
});

export const insertApprovalSchema = createInsertSchema(approvalsTable).omit({
  id: true,
  createdAt: true,
  resolvedAt: true,
});

export type Approval = typeof approvalsTable.$inferSelect;