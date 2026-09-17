import { boolean, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export const directMessagesTable = pgTable("direct_messages", {
  id: serial("id").primaryKey(),
  // "atlas" for the orchestrator, "operator" for the human, or a staff agent name
  sender: text("sender").notNull(),
  body: text("body").notNull(),
  projectId: integer("project_id"),
  agentId: integer("agent_id"),
  readAt: timestamp("read_at", { withTimezone: true }),
  needsReply: boolean("needs_reply").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertDirectMessageSchema = createInsertSchema(directMessagesTable).omit({
  id: true,
  createdAt: true,
  readAt: true,
});

export type DirectMessage = typeof directMessagesTable.$inferSelect;
