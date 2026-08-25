import { integer, pgTable, serial, text } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export const agentsTable = pgTable("agents", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  role: text("role").notNull(),
  provider: text("provider").notNull().default("OpenClaw"),
  status: text("status").notNull().default("waiting"),
  projectId: integer("project_id"),
  skillCount: integer("skill_count").notNull().default(0),
  currentTask: text("current_task"),
  room: text("room").notNull().default("studio"),
  computerStatus: text("computer_status").notNull().default("idle"),
  businessIdea: text("business_idea"),
  phase: text("phase").notNull().default("idea"),
  nextMove: text("next_move"),
  arenaScore: integer("arena_score").notNull().default(0),
  arenaIncomeCents: integer("arena_income_cents").notNull().default(0),
  scaleRevenueCents: integer("scale_revenue_cents").notNull().default(0),
});

export const insertAgentSchema = createInsertSchema(agentsTable).omit({
  id: true,
  arenaScore: true,
  arenaIncomeCents: true,
  scaleRevenueCents: true,
});

export type Agent = typeof agentsTable.$inferSelect;