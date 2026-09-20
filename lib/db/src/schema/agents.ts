import { integer, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

/** Contestant strengths and weaknesses, 1-5, set before a match so results can be attributed. */
export type AgentTraits = {
  speed: number;
  creativity: number;
  rigor: number;
  charisma: number;
  thrift: number;
};

export const DEFAULT_TRAITS: AgentTraits = { speed: 3, creativity: 3, rigor: 3, charisma: 3, thrift: 3 };

export const agentsTable = pgTable("agents", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  role: text("role").notNull(),
  provider: text("provider").notNull().default("OpenClaw"),
  runtime: text("runtime").notNull().default("managed"),
   runtimeConnectionId: integer("runtime_connection_id"),
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
  capabilities: text("capabilities").array().notNull().default([]),
  // Model id as the provider names it, e.g. "meta/llama-3.3-70b-instruct" on NVIDIA NIM
  model: text("model"),
  modelProvider: text("model_provider").notNull().default("nvidia_nim"),
  personality: text("personality"),
  traits: jsonb("traits").$type<AgentTraits>().notNull().default(DEFAULT_TRAITS),
  catchphrase: text("catchphrase"),
  lastActivity: text("last_activity"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertAgentSchema = createInsertSchema(agentsTable).omit({
  id: true,
  arenaScore: true,
  arenaIncomeCents: true,
  scaleRevenueCents: true,
});

export type Agent = typeof agentsTable.$inferSelect;