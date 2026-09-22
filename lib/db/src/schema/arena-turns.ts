import { index, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

/** One contestant's attempt at one level: exactly what was asked, what came back, and what it cost. */
export const arenaTurnsTable = pgTable(
  "arena_turns",
  {
    id: serial("id").primaryKey(),
    agentId: integer("agent_id").notNull(),
    level: integer("level").notNull(),
    model: text("model"),
    // The contestant's own model when a different one had to stand in for this turn.
    standInFor: text("stand_in_for"),
    status: text("status").notNull().default("queued"), // queued, running, completed, failed
    prompt: text("prompt").notNull(),
    output: text("output"),
    error: text("error"),
    promptTokens: integer("prompt_tokens"),
    completionTokens: integer("completion_tokens"),
    durationMs: integer("duration_ms"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (table) => [index("arena_turns_level_idx").on(table.level), index("arena_turns_created_idx").on(table.createdAt)],
);

export type ArenaTurn = typeof arenaTurnsTable.$inferSelect;
