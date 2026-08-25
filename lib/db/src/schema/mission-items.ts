import { jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const missionItemsTable = pgTable("mission_items", {
  id: serial("id").primaryKey(),
  kind: text("kind").notNull(),
  name: text("name").notNull(),
  data: jsonb("data").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertMissionItemSchema = createInsertSchema(missionItemsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertMissionItem = z.infer<typeof insertMissionItemSchema>;
export type MissionItem = typeof missionItemsTable.$inferSelect;