import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export const arenaEvidenceTable = pgTable("arena_evidence", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").notNull(),
  round: integer("round").notNull(),
  metric: text("metric").notNull(),
  value: integer("value").notNull(),
  source: text("source").notNull(),
  evidenceRef: text("evidence_ref"),
  note: text("note"),
  verifiedBy: text("verified_by").notNull().default("Game Master"),
  verifiedAt: timestamp("verified_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertArenaEvidenceSchema = createInsertSchema(arenaEvidenceTable).omit({
  id: true,
  verifiedAt: true,
  createdAt: true,
});

export type ArenaEvidence = typeof arenaEvidenceTable.$inferSelect;