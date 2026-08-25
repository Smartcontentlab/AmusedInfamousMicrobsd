import { integer, pgTable, serial, text } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export const agentsTable = pgTable("agents", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  role: text("role").notNull(),
  status: text("status").notNull().default("waiting"),
  projectId: integer("project_id"),
  skillCount: integer("skill_count").notNull().default(0),
  currentTask: text("current_task"),
  arenaScore: integer("arena_score").notNull().default(0),
  arenaIncomeCents: integer("arena_income_cents").notNull().default(0),
});

export const insertAgentSchema = createInsertSchema(agentsTable).omit({
  id: true,
  arenaScore: true,
  arenaIncomeCents: true,
});

export type Agent = typeof agentsTable.$inferSelect;