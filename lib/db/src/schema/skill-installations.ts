import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export const skillInstallationsTable = pgTable("skill_installations", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").notNull(),
  skillId: integer("skill_id").notNull(),
  runtimeConnectionId: integer("runtime_connection_id"),
  status: text("status").notNull().default("queued"),
  message: text("message").notNull().default("Installation request queued."),
  providerRequestId: text("provider_request_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertSkillInstallationSchema = createInsertSchema(skillInstallationsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type SkillInstallation = typeof skillInstallationsTable.$inferSelect;