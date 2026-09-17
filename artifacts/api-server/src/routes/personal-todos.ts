import { asc, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  CreatePersonalTodoBody,
  CreatePersonalTodoResponse,
  ListPersonalTodosResponse,
  UpdatePersonalTodoBody,
  UpdatePersonalTodoResponse,
} from "@workspace/api-zod";
import { db, personalTodosTable } from "@workspace/db";

const router: IRouter = Router();

function serialize(todo: typeof personalTodosTable.$inferSelect) {
  return {
    id: todo.id,
    title: todo.title,
    done: todo.done,
    dueDate: todo.dueDate ? todo.dueDate.toISOString() : null,
    createdAt: todo.createdAt.toISOString(),
    completedAt: todo.completedAt ? todo.completedAt.toISOString() : null,
  };
}

router.get("/personal-todos", async (_req, res): Promise<void> => {
  const todos = await db.select().from(personalTodosTable).orderBy(asc(personalTodosTable.done), asc(personalTodosTable.createdAt));
  res.json(ListPersonalTodosResponse.parse(todos.map(serialize)));
});

router.post("/personal-todos", async (req, res): Promise<void> => {
  const parsed = CreatePersonalTodoBody.safeParse(req.body);
  if (!parsed.success || parsed.data.title.trim().length === 0) {
    res.status(400).json({ error: "Give the to-do a title." });
    return;
  }

  const [todo] = await db
    .insert(personalTodosTable)
    .values({
      title: parsed.data.title.trim(),
      dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
    })
    .returning();

  res.status(201).json(CreatePersonalTodoResponse.parse(serialize(todo)));
});

router.patch("/personal-todos/:todoId", async (req, res): Promise<void> => {
  const todoId = Number(req.params.todoId);
  if (!Number.isInteger(todoId)) {
    res.status(404).json({ error: "That to-do does not exist." });
    return;
  }

  const parsed = UpdatePersonalTodoBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "That update is not valid." });
    return;
  }

  const updates: Partial<typeof personalTodosTable.$inferInsert> = {};
  if (parsed.data.title !== undefined) updates.title = parsed.data.title.trim();
  if (parsed.data.dueDate !== undefined) updates.dueDate = parsed.data.dueDate ? new Date(parsed.data.dueDate) : null;
  if (parsed.data.done !== undefined) {
    updates.done = parsed.data.done;
    updates.completedAt = parsed.data.done ? new Date() : null;
  }

  const [todo] = await db.update(personalTodosTable).set(updates).where(eq(personalTodosTable.id, todoId)).returning();
  if (!todo) {
    res.status(404).json({ error: "That to-do does not exist." });
    return;
  }

  res.json(UpdatePersonalTodoResponse.parse(serialize(todo)));
});

router.delete("/personal-todos/:todoId", async (req, res): Promise<void> => {
  const todoId = Number(req.params.todoId);
  if (!Number.isInteger(todoId)) {
    res.status(404).json({ error: "That to-do does not exist." });
    return;
  }

  const [todo] = await db.delete(personalTodosTable).where(eq(personalTodosTable.id, todoId)).returning();
  if (!todo) {
    res.status(404).json({ error: "That to-do does not exist." });
    return;
  }

  res.status(204).send();
});

export default router;
