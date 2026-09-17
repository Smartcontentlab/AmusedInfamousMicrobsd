import { boolean, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export const personalTodosTable = pgTable("personal_todos", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  done: boolean("done").notNull().default(false),
  dueDate: timestamp("due_date", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const insertPersonalTodoSchema = createInsertSchema(personalTodosTable).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

export type PersonalTodo = typeof personalTodosTable.$inferSelect;
