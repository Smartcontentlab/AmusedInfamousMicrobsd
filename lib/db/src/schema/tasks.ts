import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export const tasksTable = pgTable("tasks", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  status: text("status").notNull().default("queued"),
  priority: text("priority").notNull().default("medium"),
  projectId: integer("project_id").notNull(),
  agentId: integer("agent_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTaskSchema = createInsertSchema(tasksTable).omit({
  id: true,
  createdAt: true,
});

export type Task = typeof tasksTable.$inferSelect;