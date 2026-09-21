import { useQueryClient } from "@tanstack/react-query";
import { Cpu } from "lucide-react";
import { useListModels, useSetAgentModel } from "@workspace/api-client-react";
import type { QueryKey } from "@tanstack/react-query";

export function ModelPicker({
  agentId,
  model,
  invalidateKey,
}: {
  agentId: number;
  model?: string | null;
  invalidateKey: QueryKey;
}) {
  const queryClient = useQueryClient();
  const catalog = useListModels({ query: { queryKey: ["models"], staleTime: 600000 } });
  const setModel = useSetAgentModel({
    mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: invalidateKey }) },
  });

  const models = catalog.data?.models ?? [];
  const unconfigured = catalog.data && !catalog.data.configured;

  return (
    <div className="mt-2 border-t-2 border-border/40 pt-2">
      <p className="mb-1 flex items-center gap-1 font-mono text-[10px] font-bold uppercase text-muted-foreground">
        <Cpu size={11} /> Model
      </p>

      {unconfigured ? (
        <p className="font-mono text-[10px] text-muted-foreground">{catalog.data?.message}</p>
      ) : (
        <>
          <select
            value={model ?? ""}
            disabled={setModel.isPending || models.length === 0}
            onChange={(event) =>
              setModel.mutate({ agentId, data: { model: event.target.value || null, modelProvider: "nvidia_nim" } })
            }
            aria-label="Model for this agent"
            className="w-full rounded-lg border border-border bg-background px-1.5 py-1 font-mono text-[10px] outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
          >
            <option value="">{models.length === 0 ? "Loading catalog..." : "Use project default"}</option>
            {models.map((option) => (
              <option key={option.id} value={option.id}>
                {option.id}
              </option>
            ))}
          </select>
          {catalog.data?.message && <p className="mt-1 font-mono text-[10px] text-destructive">{catalog.data.message}</p>}
        </>
      )}
    </div>
  );
}
