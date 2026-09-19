import { boolean, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export const agentLoopsTable = pgTable("agent_loops", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  // how often it repeats, e.g. "daily", "weekly", "every monday", "on new lead"
  cadence: text("cadence").notNull().default("daily"),
  enabled: boolean("enabled").notNull().default(true),
  lastRunAt: timestamp("last_run_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAgentLoopSchema = createInsertSchema(agentLoopsTable).omit({
  id: true,
  createdAt: true,
  lastRunAt: true,
});

export type AgentLoop = typeof agentLoopsTable.$inferSelect;
