import { boolean, pgTable, serial, text } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export const skillsTable = pgTable("skills", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  enabled: boolean("enabled").notNull().default(true),
});

export const insertSkillSchema = createInsertSchema(skillsTable).omit({
  id: true,
  enabled: true,
});

export type Skill = typeof skillsTable.$inferSelect;