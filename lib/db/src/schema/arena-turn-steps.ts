import { index, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

/** Every tool a contestant used during a turn, in order, so you can see exactly what it looked at. */
export const arenaTurnStepsTable = pgTable(
  "arena_turn_steps",
  {
    id: serial("id").primaryKey(),
    turnId: integer("turn_id").notNull(),
    step: integer("step").notNull(),
    tool: text("tool").notNull(),
    input: text("input").notNull(),
    ok: integer("ok").notNull().default(1),
    summary: text("summary"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("arena_turn_steps_turn_idx").on(table.turnId)],
);

export type ArenaTurnStep = typeof arenaTurnStepsTable.$inferSelect;
