import { integer, pgTable, serial, text, timestamp, boolean } from "drizzle-orm/pg-core";

export const liveRunsTable = pgTable("live_runs", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").notNull(),
  connectionId: integer("connection_id").notNull(),
  providerRunId: text("provider_run_id"),
  task: text("task").notNull(),
  allowedTools: text("allowed_tools").array().notNull().default([]),
  status: text("status").notNull().default("queued"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  lastEventAt: timestamp("last_event_at", { withTimezone: true }),
  lastEvent: text("last_event"),
  errorCode: text("error_code"),
  errorMessage: text("error_message"),
  supportsPause: boolean("supports_pause").notNull().default(false),
  supportsResume: boolean("supports_resume").notNull().default(false),
  supportsStop: boolean("supports_stop").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type LiveRun = typeof liveRunsTable.$inferSelect;