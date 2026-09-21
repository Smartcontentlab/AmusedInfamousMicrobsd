import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Cpu, Loader2 } from "lucide-react";
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
  const catalog = useListModels({
    query: {
      queryKey: ["models"],
      // Poll while the server is still probing which models respond, then settle.
      refetchInterval: (query) => (query.state.data?.checking ? 4000 : false),
    },
  });
  const setModel = useSetAgentModel({
    mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: invalidateKey }) },
  });

  const all = catalog.data?.models ?? [];
  const available = all.filter((option) => option.status === "available");
  const checkingCount = all.filter((option) => option.status === "checking").length;
  const current = model ? all.find((option) => option.id === model) : undefined;
  // A model can also vanish from the catalog entirely once NVIDIA retires it.
  const currentIsDead = !!model && !!catalog.data && (!current || current.status === "unavailable");

  if (catalog.data && !catalog.data.configured) {
    return (
      <p className="flex items-start gap-1 font-mono text-[10px] text-muted-foreground">
        <Cpu size={11} className="mt-0.5 shrink-0" /> {catalog.data.message}
      </p>
    );
  }

  return (
    <div>
      <select
        value={model ?? ""}
        disabled={setModel.isPending || available.length === 0}
        onChange={(event) => setModel.mutate({ agentId, data: { model: event.target.value || null, modelProvider: "nvidia_nim" } })}
        aria-label="Model for this agent"
        className="w-full rounded-lg border border-border bg-background px-2 py-1.5 font-mono text-[11px] outline-none focus:ring-2 focus:ring-ring/30 disabled:opacity-50"
      >
        <option value="">{available.length === 0 ? "Finding models that respond..." : "Use project default"}</option>
        {currentIsDead && model && <option value={model}>{model} (not responding)</option>}
        {available.map((option) => (
          <option key={option.id} value={option.id}>
            {option.id}
            {option.tools ? " · web tools" : ""}
          </option>
        ))}
      </select>

      <p className="mt-1 flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
        {catalog.data?.checking ? (
          <>
            <Loader2 size={10} className="animate-spin" /> {available.length} working so far, checking {checkingCount} more
          </>
        ) : (
          <>{available.length} free models working on your key</>
        )}
      </p>

      {!currentIsDead && current?.status === "available" && current.tools === false && (
        <p className="mt-1 font-mono text-[10px] text-muted-foreground">
          This model can't use web tools, so it will research from memory only.
        </p>
      )}

      {currentIsDead && (
        <p className="mt-1 flex items-start gap-1 font-mono text-[10px] text-destructive">
          <AlertTriangle size={11} className="mt-0.5 shrink-0" /> This agent's model stopped responding. Pick another.
        </p>
      )}
      {catalog.data?.message && !catalog.data.checking && <p className="mt-1 font-mono text-[10px] text-destructive">{catalog.data.message}</p>}
    </div>
  );
}
