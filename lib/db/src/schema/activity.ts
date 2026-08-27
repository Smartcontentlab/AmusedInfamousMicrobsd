import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const activityTable = pgTable("activity", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id"),
  agentId: integer("agent_id"),
  runId: integer("run_id"),
  sequence: integer("sequence").notNull().default(0),
  kind: text("kind").notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});