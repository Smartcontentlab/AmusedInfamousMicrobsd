import { integer, pgTable, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export const agentSkillsTable = pgTable("agent_skills", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").notNull(),
  skillId: integer("skill_id").notNull(),
  attachedAt: timestamp("attached_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAgentSkillSchema = createInsertSchema(agentSkillsTable).omit({
  id: true,
  attachedAt: true,
});

export type AgentSkill = typeof agentSkillsTable.$inferSelect;