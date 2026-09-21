import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, X } from "lucide-react";
import {
  getListPersonalTodosQueryKey,
  useCreatePersonalTodo,
  useDeletePersonalTodo,
  useListPersonalTodos,
  useUpdatePersonalTodo,
} from "@workspace/api-client-react";
import { BrutalCard } from "@/components/ui/brutal";

export function PersonalTodosWidget() {
  const [draft, setDraft] = useState("");
  const queryClient = useQueryClient();
  const todos = useListPersonalTodos();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListPersonalTodosQueryKey() });

  const createTodo = useCreatePersonalTodo({ mutation: { onSuccess: invalidate } });
  const updateTodo = useUpdatePersonalTodo({ mutation: { onSuccess: invalidate } });
  const deleteTodo = useDeletePersonalTodo({ mutation: { onSuccess: invalidate } });

  const items = todos.data ?? [];
  const openCount = items.filter((todo) => !todo.done).length;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const title = draft.trim();
    if (!title) return;
    createTodo.mutate({ data: { title } });
    setDraft("");
  };

  return (
    <BrutalCard
      title="My list"
      action={<span className="font-mono text-xs font-bold text-muted-foreground">{openCount} open</span>}
      className="h-full"
    >
      <form onSubmit={submit} className="mb-3 flex gap-2">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Add something for yourself..."
          className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm font-medium outline-none focus:ring-4 focus:ring-primary/20"
        />
        <button
          type="submit"
          disabled={!draft.trim() || createTodo.isPending}
          aria-label="Add to-do"
          className="shrink-0 rounded-xl border border-border bg-primary px-3 text-primary-foreground shadow-sm transition-all disabled:opacity-40"
        >
          <Plus size={18} />
        </button>
      </form>

      <ul className="flex-1 space-y-1 overflow-auto">
        {items.length === 0 && (
          <li className="py-6 text-center font-mono text-xs uppercase text-muted-foreground">Nothing on your list.</li>
        )}
        {items.map((todo) => (
          <li key={todo.id} className="group flex items-center gap-2 rounded-lg border border-transparent px-1 py-1 hover:border-border hover:bg-muted/40">
            <input
              type="checkbox"
              checked={todo.done}
              onChange={() => updateTodo.mutate({ todoId: todo.id, data: { done: !todo.done } })}
              className="size-4 shrink-0 accent-primary"
              aria-label={todo.done ? `Reopen ${todo.title}` : `Complete ${todo.title}`}
            />
            <span className={`flex-1 text-sm font-medium ${todo.done ? "text-muted-foreground line-through" : ""}`}>{todo.title}</span>
            <button
              onClick={() => deleteTodo.mutate({ todoId: todo.id })}
              aria-label={`Delete ${todo.title}`}
              className="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
            >
              <X size={15} />
            </button>
          </li>
        ))}
      </ul>
    </BrutalCard>
  );
}
