import { integer, pgTable, serial, text } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export const arenaTable = pgTable("arena", {
  id: serial("id").primaryKey(),
  round: integer("round").notNull().default(1),
  totalRounds: integer("total_rounds").notNull().default(5),
  status: text("status").notNull().default("ready"),
  secondsRemaining: integer("seconds_remaining").notNull().default(240),
  winConditionCents: integer("win_condition_cents").notNull().default(50000),
  winnerAgentId: integer("winner_agent_id"),
});

export const insertArenaSchema = createInsertSchema(arenaTable).omit({
  id: true,
});

export type Arena = typeof arenaTable.$inferSelect;