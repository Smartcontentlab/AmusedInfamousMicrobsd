import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Loader2, Lock, Play } from "lucide-react";
import {
  getGetArenaLevelsQueryKey,
  getGetArenaRaceQueryKey,
  getListArenaTurnsQueryKey,
  useGetArenaLevels,
  useListArenaTurns,
  useRunArenaLevel,
} from "@workspace/api-client-react";
import type { ArenaTurn } from "@workspace/api-client-react";
import { PixelPerson } from "@/components/house/pixel-person";

function TurnCard({ turn }: { turn: ArenaTurn }) {
  const [open, setOpen] = useState(false);
  const long = (turn.output?.length ?? 0) > 420;
  const text = turn.output && long && !open ? `${turn.output.slice(0, 420).trimEnd()}…` : turn.output;

  return (
    <article className="flex gap-3 rounded-xl border border-border bg-card p-3 shadow-sm">
      <div className="flex w-12 shrink-0 flex-col items-center gap-1">
        <span className="flex size-12 items-end justify-center overflow-hidden rounded-lg bg-muted">
          <PixelPerson seed={turn.appearanceSeed ?? turn.agentName} size={26} />
        </span>
        <span className="text-center font-mono text-[9px] font-bold uppercase">{turn.agentName}</span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase text-muted-foreground">
          {turn.status === "completed" && <CheckCircle2 size={12} className="text-accent-strong" />}
          {turn.status === "failed" && <AlertTriangle size={12} className="text-destructive" />}
          {(turn.status === "running" || turn.status === "queued") && <Loader2 size={12} className="animate-spin" />}
          <span>{turn.model ?? "no model"}</span>
          {turn.durationMs != null && <span>· {(turn.durationMs / 1000).toFixed(1)}s</span>}
          {turn.completionTokens != null && <span>· {(turn.promptTokens ?? 0) + turn.completionTokens} tokens</span>}
        </div>

        {turn.status === "failed" && <p className="text-xs text-destructive">{turn.error}</p>}
        {(turn.status === "running" || turn.status === "queued") && (
          <p className="text-xs italic text-muted-foreground">Thinking in the diary room…</p>
        )}
        {text && <p className="whitespace-pre-wrap text-xs leading-relaxed">{text}</p>}
        {long && (
          <button
            onClick={() => setOpen((value) => !value)}
            className="mt-1 flex items-center gap-0.5 font-mono text-[10px] uppercase text-primary hover:underline"
          >
            {open ? <><ChevronUp size={11} /> Less</> : <><ChevronDown size={11} /> Read all</>}
          </button>
        )}
      </div>
    </article>
  );
}

export function ArenaShowControl() {
  const queryClient = useQueryClient();
  const levels = useGetArenaLevels({
    query: { queryKey: getGetArenaLevelsQueryKey(), refetchInterval: (query) => (query.state.data?.levels.some((level) => level.running) ? 3000 : 15000) },
  });
  const [selected, setSelected] = useState(0);

  const anyRunning = levels.data?.levels.some((level) => level.running) ?? false;
  const turnsParams = { level: selected };
  const turns = useListArenaTurns(turnsParams, {
    query: { queryKey: getListArenaTurnsQueryKey(turnsParams), refetchInterval: anyRunning ? 3000 : 15000 },
  });

  const run = useRunArenaLevel({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetArenaLevelsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListArenaTurnsQueryKey(turnsParams) });
        queryClient.invalidateQueries({ queryKey: getGetArenaRaceQueryKey() });
      },
    },
  });

  // When a run finishes, pull the house back to its resting state.
  useEffect(() => {
    if (!anyRunning) queryClient.invalidateQueries({ queryKey: getGetArenaRaceQueryKey() });
  }, [anyRunning, queryClient]);

  const level = levels.data?.levels.find((entry) => entry.level === selected);
  const latestRun = (turns.data ?? []).reduce<string | null>((latest, turn) => (!latest || turn.createdAt > latest ? turn.createdAt : latest), null);
  // Every turn in one run is inserted together, so they share the exact same timestamp.
  const shown = (turns.data ?? []).filter((turn) => turn.createdAt === latestRun);
  const runError = run.error as { data?: { error?: string } } | null;

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <header className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <h2 className="text-sm font-bold uppercase tracking-tight">Season 0</h2>
        {levels.data && (
          <span className="ml-auto font-mono text-[11px] text-muted-foreground">
            {levels.data.turnsToday}/{levels.data.dailyBudget} turns used today
          </span>
        )}
      </header>

      <ol className="grid grid-cols-2 gap-1.5 border-b border-border p-3 sm:grid-cols-5">
        {(levels.data?.levels ?? []).map((entry) => (
          <li key={entry.level}>
            <button
              onClick={() => setSelected(entry.level)}
              className={`h-full w-full rounded-lg border px-2 py-1.5 text-left transition-colors ${
                selected === entry.level ? "border-primary bg-primary/10" : "border-border hover:bg-muted/50"
              } ${entry.locked ? "opacity-60" : ""}`}
            >
              <span className="flex items-center gap-1 font-mono text-[10px] uppercase text-muted-foreground">
                Level {entry.level}
                {entry.locked && <Lock size={10} />}
                {entry.running && <Loader2 size={10} className="animate-spin text-primary" />}
                {!entry.locked && !entry.running && entry.completedTurns > 0 && <CheckCircle2 size={10} className="text-accent-strong" />}
              </span>
              <span className="block text-xs font-semibold leading-tight">{entry.title}</span>
            </button>
          </li>
        ))}
      </ol>

      {level && (
        <div className="space-y-3 p-3">
          <div className="flex flex-wrap items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{level.goal}</p>
              <p className="text-xs text-muted-foreground">
                {level.locked ? level.lockedReason : `Tools this level: ${level.tools.join(", ")}`}
              </p>
            </div>
            <button
              onClick={() => run.mutate({ level: level.level })}
              disabled={level.locked || level.running || run.isPending}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold uppercase text-primary-foreground shadow-sm disabled:opacity-40"
            >
              {level.running ? <Loader2 size={13} className="animate-spin" /> : level.locked ? <Lock size={13} /> : <Play size={13} />}
              {level.running ? "Running…" : level.locked ? "Locked" : level.completedTurns > 0 ? "Run again" : "Run level"}
            </button>
          </div>

          {run.isError && <p className="text-xs text-destructive">{runError?.data?.error ?? "That level could not start."}</p>}

          {shown.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
              {level.locked ? "This level unlocks when its tools are connected." : "Nobody has played this level yet. Run it to hear from the contestants."}
            </p>
          ) : (
            <div className="grid gap-2 lg:grid-cols-2">
              {shown.map((turn) => (
                <TurnCard key={turn.id} turn={turn} />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
