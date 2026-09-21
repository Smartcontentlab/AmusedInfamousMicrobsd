import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Crown, Pencil, Trophy } from "lucide-react";
import {
  getGetArenaRaceQueryKey,
  useGetArenaRace,
  useSetContestantProfile,
} from "@workspace/api-client-react";
import type { AgentTraits, RaceContestant } from "@workspace/api-client-react";
import { BrutalBadge, BrutalButton, BrutalCard } from "@/components/ui/brutal";
import { PixelAvatar } from "@/components/pixel-avatar";

const TRAIT_KEYS: Array<{ key: keyof AgentTraits; label: string }> = [
  { key: "speed", label: "Speed" },
  { key: "creativity", label: "Creativity" },
  { key: "rigor", label: "Rigor" },
  { key: "charisma", label: "Charisma" },
  { key: "thrift", label: "Thrift" },
];

const MEDALS = ["bg-accent", "bg-secondary", "bg-muted-foreground"];

function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function StarRow({ value }: { value: number }) {
  return (
    <span className="flex gap-0.5" aria-label={`${value} of 5`}>
      {[1, 2, 3, 4, 5].map((step) => (
        <span
          key={step}
          className={`size-2 rounded-full border border-border ${step <= value ? "bg-primary" : "bg-transparent"}`}
        />
      ))}
    </span>
  );
}

function ProfileEditor({ contestant, onDone }: { contestant: RaceContestant; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [personality, setPersonality] = useState(contestant.personality ?? "");
  const [catchphrase, setCatchphrase] = useState(contestant.catchphrase ?? "");
  const [traits, setTraits] = useState<AgentTraits>(contestant.traits);

  const save = useSetContestantProfile({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetArenaRaceQueryKey() });
        onDone();
      },
    },
  });

  return (
    <div className="mt-2 border-t-2 border-border pt-2">
      <label className="block font-mono text-[10px] font-bold uppercase text-muted-foreground">
        Personality
        <textarea
          value={personality}
          onChange={(event) => setPersonality(event.target.value)}
          rows={2}
          placeholder="Impatient. Ships fast, skips validation, talks big."
          className="mt-1 w-full rounded-lg border border-border bg-background p-1.5 font-sans text-[11px] font-normal normal-case outline-none focus:ring-2 focus:ring-primary/20"
        />
      </label>

      <label className="mt-1.5 block font-mono text-[10px] font-bold uppercase text-muted-foreground">
        Catchphrase
        <input
          value={catchphrase}
          onChange={(event) => setCatchphrase(event.target.value)}
          placeholder="Ship it and find out."
          className="mt-1 w-full rounded-lg border border-border bg-background p-1.5 font-sans text-[11px] font-normal normal-case outline-none focus:ring-2 focus:ring-primary/20"
        />
      </label>

      <div className="mt-2 space-y-1">
        {TRAIT_KEYS.map((trait) => (
          <label key={trait.key} className="flex items-center gap-2">
            <span className="w-16 shrink-0 font-mono text-[10px] font-bold uppercase text-muted-foreground">{trait.label}</span>
            <input
              type="range"
              min={1}
              max={5}
              step={1}
              value={traits[trait.key]}
              onChange={(event) => setTraits({ ...traits, [trait.key]: Number(event.target.value) })}
              className="min-w-0 flex-1 accent-primary"
            />
            <StarRow value={traits[trait.key]} />
          </label>
        ))}
      </div>

      <div className="mt-2 flex gap-1">
        <BrutalButton
          variant="primary"
          disabled={save.isPending}
          onClick={() => save.mutate({ agentId: contestant.id, data: { personality, catchphrase, traits } })}
        >
          {save.isPending ? "Saving..." : "Save profile"}
        </BrutalButton>
        <BrutalButton variant="default" onClick={onDone}>
          Cancel
        </BrutalButton>
      </div>
    </div>
  );
}

function ContestantRow({ contestant, prizeCents }: { contestant: RaceContestant; prizeCents: number }) {
  const [editing, setEditing] = useState(false);

  return (
    <div
      className={`rounded-lg border p-2 ${contestant.finished ? "border-accent bg-accent/10" : "border-border bg-card"}`}
      data-testid={`race-contestant-${contestant.id}`}
    >
      <div className="flex items-start gap-2">
        <div className="relative shrink-0">
          <PixelAvatar seed={contestant.name} size={44} className="rounded-lg border border-border" />
          <span
            className={`absolute -left-1 -top-1 flex size-4 items-center justify-center rounded-lg border border-border font-mono text-[9px] font-bold ${
              MEDALS[contestant.rank - 1] ?? "bg-card"
            }`}
          >
            {contestant.rank}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-bold uppercase tracking-tight">{contestant.name}</span>
            {contestant.finished && <Crown size={13} className="text-accent-strong" />}
            <BrutalBadge variant="secondary">{contestant.provider}</BrutalBadge>
            <button
              onClick={() => setEditing((value) => !value)}
              aria-label={`Edit ${contestant.name}'s profile`}
              className="ml-auto text-muted-foreground hover:text-foreground"
            >
              <Pencil size={12} />
            </button>
          </div>

          <p className="font-mono text-[10px] uppercase text-muted-foreground">{contestant.role}</p>

          {contestant.catchphrase && (
            <p className="mt-0.5 text-[11px] italic text-muted-foreground">&ldquo;{contestant.catchphrase}&rdquo;</p>
          )}

          <div className="mt-1.5 flex items-center gap-2">
            <div className="h-3 min-w-0 flex-1 overflow-hidden rounded-lg border border-border bg-muted">
              <div
                className={`h-full ${contestant.finished ? "bg-accent" : "bg-primary"}`}
                style={{ width: `${contestant.percentToPrize}%` }}
              />
            </div>
            <span className="shrink-0 font-mono text-[11px] font-bold tabular-nums">{money(contestant.earnedCents)}</span>
            <span className="shrink-0 font-mono text-[10px] text-muted-foreground">/ {money(prizeCents)}</span>
          </div>

          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
            {TRAIT_KEYS.map((trait) => (
              <span key={trait.key} className="flex items-center gap-1">
                <span className="font-mono text-[9px] uppercase text-muted-foreground">{trait.label.slice(0, 4)}</span>
                <StarRow value={contestant.traits[trait.key]} />
              </span>
            ))}
          </div>

          {contestant.personality ? (
            <p className="mt-1 text-[11px] text-muted-foreground">{contestant.personality}</p>
          ) : (
            <p className="mt-1 font-mono text-[10px] uppercase text-muted-foreground">
              No personality set — results cannot be attributed yet.
            </p>
          )}

          {contestant.currentTask && (
            <p className="mt-1 text-[11px]">
              <span className="font-mono text-[9px] uppercase text-muted-foreground">Building: </span>
              {contestant.currentTask}
            </p>
          )}
        </div>
      </div>

      {editing && <ProfileEditor contestant={contestant} onDone={() => setEditing(false)} />}
    </div>
  );
}

export function ArenaRace() {
  const race = useGetArenaRace({ query: { queryKey: getGetArenaRaceQueryKey(), refetchInterval: 5000 } });
  const data = race.data;

  return (
    <BrutalCard
      title={
        <span className="flex items-center gap-2 text-sm">
          <Trophy size={15} /> Race to {data ? money(data.prizeCents) : "the prize"}
        </span>
      }
      action={
        <span className="font-mono text-[11px] font-bold text-muted-foreground">
          {data ? `Round ${data.round}/${data.totalRounds}` : "—"}
        </span>
      }
    >
      {data?.winnerName && (
        <p className="mb-2 flex items-center gap-2 rounded-lg border border-accent bg-accent/20 px-2 py-1 font-mono text-[11px] font-bold uppercase">
          <Crown size={13} /> {data.winnerName} reached the prize first
        </p>
      )}

      {!data || data.contestants.length === 0 ? (
        <p className="py-6 text-center font-mono text-xs uppercase text-muted-foreground">
          {race.isLoading ? "Loading contestants..." : "No contestants yet. Set one up to start the show."}
        </p>
      ) : (
        <div className="space-y-2">
          {data.contestants.map((contestant) => (
            <ContestantRow key={contestant.id} contestant={contestant} prizeCents={data.prizeCents} />
          ))}
        </div>
      )}
    </BrutalCard>
  );
}
