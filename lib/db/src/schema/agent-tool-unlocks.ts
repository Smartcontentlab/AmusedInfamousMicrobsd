import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export const agentToolUnlocksTable = pgTable("agent_tool_unlocks", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").notNull(),
  toolKey: text("tool_key").notNull(),
  action: text("action").notNull(),
  reason: text("reason").notNull(),
  actor: text("actor").notNull().default("Game Master"),
  round: integer("round").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAgentToolUnlockSchema = createInsertSchema(agentToolUnlocksTable).omit({
  id: true,
  createdAt: true,
});

export type AgentToolUnlock = typeof agentToolUnlocksTable.$inferSelect;