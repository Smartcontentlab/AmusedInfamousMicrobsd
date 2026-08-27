import { integer, jsonb, pgTable, serial, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export const runtimeConnectionsTable = pgTable("runtime_connections", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  provider: text("provider").notNull(),
  endpointUrl: text("endpoint_url").notNull(),
  encryptedToken: text("encrypted_token"),
  status: text("status").notNull().default("unknown"),
  capabilities: jsonb("capabilities").$type<string[]>().notNull().default([]),
  lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
  lastErrorCode: text("last_error_code"),
  lastErrorMessage: text("last_error_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertRuntimeConnectionSchema = createInsertSchema(runtimeConnectionsTable).omit({
  id: true,
  encryptedToken: true,
  createdAt: true,
  updatedAt: true,
});

export type RuntimeConnection = typeof runtimeConnectionsTable.$inferSelect;