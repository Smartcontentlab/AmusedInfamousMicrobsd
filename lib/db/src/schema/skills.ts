import { boolean, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export const skillsTable = pgTable("skills", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  sourceKind: text("source_kind").notNull().default("custom"),
  sourceName: text("source_name").notNull().default("Mission Control"),
  sourceUrl: text("source_url"),
  externalId: text("external_id"),
  compatibleRuntimes: text("compatible_runtimes").array().notNull().default([]),
  installMethod: text("install_method").notNull().default("manual"),
  importState: text("import_state").notNull().default("operator_created"),
  importError: text("import_error"),
  requiresApproval: boolean("requires_approval").notNull().default(false),
  sideEffectRisk: text("side_effect_risk").notNull().default("unknown"),
  importedAt: timestamp("imported_at", { withTimezone: true }),
});

export const insertSkillSchema = createInsertSchema(skillsTable).omit({
  id: true,
  enabled: true,
});

export type Skill = typeof skillsTable.$inferSelect;