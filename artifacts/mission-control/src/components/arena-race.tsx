import { Link } from "wouter";
import { Crown, Pencil, Trophy } from "lucide-react";
import {
  getGetArenaRaceQueryKey,
  useGetArenaRace,
} from "@workspace/api-client-react";
import type { AgentTraits, RaceContestant } from "@workspace/api-client-react";
import { BrutalBadge, BrutalCard } from "@/components/ui/brutal";
import { PixelPerson } from "@/components/house/pixel-person";

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

function ContestantRow({ contestant, prizeCents }: { contestant: RaceContestant; prizeCents: number }) {
  return (
    <div
      className={`rounded-lg border p-2 ${contestant.finished ? "border-accent bg-accent/10" : "border-border bg-card"}`}
      data-testid={`race-contestant-${contestant.id}`}
    >
      <div className="flex items-start gap-2">
        <div className="relative shrink-0">
          <span className="flex size-11 items-end justify-center overflow-hidden rounded-lg border border-border bg-muted/60"><PixelPerson seed={contestant.appearanceSeed ?? contestant.name} size={26} /></span>
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
            <Link
              href={`/arena/contestants/${contestant.id}`}
              aria-label={`Open ${contestant.name} in the builder`}
              className="ml-auto flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Pencil size={11} /> Build
            </Link>
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
