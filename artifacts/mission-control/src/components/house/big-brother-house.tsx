import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import type { CSSProperties, ElementType } from "react";
import { AlertTriangle, Coffee, DollarSign, Hammer, Lightbulb, Mic, Moon, Search, UserPlus } from "lucide-react";
import { getGetArenaRaceQueryKey, useCreateAgent, useGetArenaRace } from "@workspace/api-client-react";
import type { RaceContestant } from "@workspace/api-client-react";
import { PixelPerson } from "./pixel-person";

type RoomKey = "research" | "living" | "diary" | "workshop" | "sales" | "bedroom";

type Room = { key: RoomKey; label: string; x: number; y: number; w: number; h: number; floor: CSSProperties };

const WOOD: CSSProperties = {
  backgroundColor: "#d9b98f",
  backgroundImage: "repeating-linear-gradient(0deg, rgba(90,60,30,0.10) 0 1px, transparent 1px 14px), repeating-linear-gradient(90deg, rgba(90,60,30,0.06) 0 1px, transparent 1px 46px)",
};
const TILE: CSSProperties = {
  backgroundColor: "#dfe7ea",
  backgroundImage: "linear-gradient(rgba(126,162,170,0.25) 1px, transparent 1px), linear-gradient(90deg, rgba(126,162,170,0.25) 1px, transparent 1px)",
  backgroundSize: "18px 18px",
};
const CARPET_RED: CSSProperties = { backgroundColor: "#a86b6b", backgroundImage: "radial-gradient(rgba(255,255,255,0.08) 1px, transparent 1px)", backgroundSize: "6px 6px" };
const CARPET_LAVENDER: CSSProperties = { backgroundColor: "#b7b3cc", backgroundImage: "radial-gradient(rgba(255,255,255,0.12) 1px, transparent 1px)", backgroundSize: "6px 6px" };

const ROOMS: Room[] = [
  { key: "research", label: "Research lab", x: 0, y: 0, w: 36, h: 50, floor: TILE },
  { key: "living", label: "Living room", x: 36, y: 0, w: 34, h: 50, floor: WOOD },
  { key: "diary", label: "Diary room", x: 70, y: 0, w: 30, h: 50, floor: CARPET_RED },
  { key: "workshop", label: "Workshop", x: 0, y: 50, w: 36, h: 50, floor: WOOD },
  { key: "sales", label: "Sales floor", x: 36, y: 50, w: 34, h: 50, floor: WOOD },
  { key: "bedroom", label: "Bedroom", x: 70, y: 50, w: 30, h: 50, floor: CARPET_LAVENDER },
];

// Where people stand inside a room, as percentages of that room.
const SLOTS = [
  { x: 30, y: 62 },
  { x: 68, y: 62 },
  { x: 30, y: 90 },
  { x: 68, y: 90 },
  { x: 50, y: 76 },
];

const ACTIVITY: Record<RoomKey, { icon: ElementType; label: string }> = {
  research: { icon: Search, label: "Researching" },
  living: { icon: Coffee, label: "Hanging out" },
  diary: { icon: Mic, label: "In the diary room" },
  workshop: { icon: Hammer, label: "Building" },
  sales: { icon: DollarSign, label: "Selling" },
  bedroom: { icon: Moon, label: "Asleep" },
};

function classify(text: string | null | undefined): RoomKey | null {
  const value = (text ?? "").toLowerCase();
  if (!value) return null;
  if (/deploy|build|cod|develop|test|release|fix/.test(value)) return "workshop";
  if (/research|explor|discover|analy|audit|study/.test(value)) return "research";
  if (/sell|sales|outreach|pitch|customer|market|invite|email/.test(value)) return "sales";
  return null;
}

function roomFor(contestant: RaceContestant): RoomKey {
  if (contestant.status === "blocked") return "diary";
  if (contestant.status === "offline") return "bedroom";
  // What the agent is doing right now outranks the wording of its assigned task.
  return (
    classify(contestant.computerStatus) ??
    classify(contestant.currentTask) ??
    (contestant.status === "reviewing" ? "research" : contestant.status === "working" ? "workshop" : "living")
  );
}

function Sign({ label }: { label: string }) {
  return (
    <div className="absolute left-2 top-2 z-10 rounded-sm border border-[#4a3526] bg-[#8a5a3c] px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wide text-[#f6e7cf] shadow-sm">
      {label}
    </div>
  );
}

function Furniture({ room }: { room: RoomKey }) {
  const piece = "absolute rounded-sm border border-[#4a3526]/60 shadow-sm";
  switch (room) {
    case "research":
      return (
        <>
          <div className={`${piece} left-[12%] top-[18%] h-[14%] w-[76%] bg-[#8a6a4c]`} />
          <div className={`${piece} left-[30%] top-[40%] h-[16%] w-[40%] bg-[#c9a57b]`} />
          <div className="absolute left-[40%] top-[43%] h-[8%] w-[9%] rounded-[2px] bg-white/90" />
          <div className="absolute left-[53%] top-[44%] h-[7%] w-[8%] rounded-[2px] bg-white/80" />
        </>
      );
    case "living":
      return (
        <>
          <div className={`${piece} left-[16%] top-[20%] h-[12%] w-[46%] bg-[#9c7a97]`} />
          <div className="absolute left-[20%] top-[40%] h-[26%] w-[58%] rounded-md border-2 border-[#7ea2aa]/60 bg-[#8be8cb]/25" />
          <div className="absolute right-[10%] top-[18%] size-[9%] rounded-full bg-[#5f8f5a] shadow-sm" />
          <div className={`${piece} right-[18%] top-[16%] h-[6%] w-[18%] bg-[#303633]`} />
        </>
      );
    case "diary":
      return (
        <>
          <div className="absolute left-[38%] top-[28%] h-[20%] w-[24%] rounded-t-lg border border-[#3a2020]/60 bg-[#6b2d2d] shadow" />
          <div className="absolute left-[42%] top-[18%] h-[8%] w-[16%] rounded-full bg-[#303633]" />
        </>
      );
    case "workshop":
      return (
        <>
          {[14, 40, 66].map((left) => (
            <div key={left}>
              <div className={`${piece} top-[22%] h-[14%] w-[20%] bg-[#c9a57b]`} style={{ left: `${left}%` }} />
              <div className="absolute top-[16%] h-[10%] w-[12%] rounded-[2px] border border-[#303633] bg-[#3f5563]" style={{ left: `${left + 4}%` }} />
            </div>
          ))}
        </>
      );
    case "sales":
      return (
        <>
          <div className={`${piece} left-[10%] top-[14%] h-[12%] w-[34%] bg-white`} />
          <div className="absolute left-[38%] top-[34%] size-[24%] rounded-full border border-[#4a3526]/60 bg-[#c9a57b] shadow-sm" />
        </>
      );
    case "bedroom":
      return (
        <>
          {[14, 56].map((left) => (
            <div key={left} className={`${piece} top-[16%] h-[30%] w-[28%] bg-white`} style={{ left: `${left}%` }}>
              <div className="h-[30%] w-full rounded-t-sm bg-[#e8e3da]" />
              <div className="h-[70%] w-full bg-[#9c7a97]/70" />
            </div>
          ))}
        </>
      );
  }
}

function Resident({ contestant, room, slot }: { contestant: RaceContestant; room: Room; slot: { x: number; y: number } }) {
  const activity = ACTIVITY[room.key];
  const Icon = contestant.status === "blocked" ? AlertTriangle : contestant.finished ? Lightbulb : activity.icon;
  const left = room.x + (slot.x * room.w) / 100;
  const top = room.y + (slot.y * room.h) / 100;
  const motion = room.key === "bedroom" ? "" : room.key === "workshop" || room.key === "sales" ? "house-busy" : "house-idle";

  return (
    <Link
      href={`/arena/contestants/${contestant.id}`}
      title={`${contestant.name} — ${activity.label}${contestant.currentTask ? `: ${contestant.currentTask}` : ""}`}
      className="group absolute z-20 flex -translate-x-1/2 -translate-y-full flex-col items-center transition-[left,top] duration-[1400ms] ease-in-out"
      style={{ left: `${left}%`, top: `${top}%` }}
    >
      <span
        className={`mb-0.5 flex size-5 items-center justify-center rounded-md border shadow-sm ${
          contestant.status === "blocked" ? "border-destructive bg-[#fff3cd] text-destructive" : "border-[#303633]/30 bg-white text-[#303633]"
        }`}
      >
        <Icon size={11} />
      </span>
      <span className={motion}>
        <PixelPerson seed={contestant.name} size={30} className={room.key === "bedroom" ? "opacity-80" : ""} />
      </span>
      <span className="mt-0.5 rounded bg-[#303633]/85 px-1 font-mono text-[8px] font-bold uppercase leading-tight text-white group-hover:bg-primary">
        {contestant.name}
      </span>
    </Link>
  );
}

function MoveIn() {
  const [name, setName] = useState("");
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const createAgent = useCreateAgent({
    mutation: {
      onSuccess: (agent) => {
        queryClient.invalidateQueries({ queryKey: getGetArenaRaceQueryKey() });
        navigate(`/arena/contestants/${agent.id}`);
      },
    },
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    createAgent.mutate({ data: { name: trimmed.toUpperCase(), role: "Contestant", provider: "OpenClaw" } });
  };

  return (
    <form onSubmit={submit} className="flex items-center gap-1">
      <input
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="New houseguest name"
        maxLength={24}
        className="w-36 rounded-lg border border-border bg-background px-2 py-1 font-mono text-[11px] outline-none focus:ring-2 focus:ring-ring/30"
      />
      <button
        type="submit"
        disabled={!name.trim() || createAgent.isPending}
        className="flex items-center gap-1 rounded-lg bg-primary px-2 py-1 text-[11px] font-semibold uppercase text-primary-foreground disabled:opacity-40"
      >
        <UserPlus size={12} /> Move in
      </button>
      {createAgent.isError && <span className="font-mono text-[10px] text-destructive">Could not create them.</span>}
    </form>
  );
}

export function BigBrotherHouse() {
  const race = useGetArenaRace({ query: { queryKey: getGetArenaRaceQueryKey(), refetchInterval: 5000 } });
  const contestants = race.data?.contestants ?? [];

  const placed = ROOMS.flatMap((room) =>
    contestants
      .filter((contestant) => roomFor(contestant) === room.key)
      .map((contestant, index) => ({ contestant, room, slot: SLOTS[index % SLOTS.length] })),
  );

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <header className="flex flex-wrap items-center gap-3 border-b border-border px-3 py-2">
        <span className="flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase text-destructive">
          <span className="size-2 animate-pulse rounded-full bg-destructive" /> Live feed
        </span>
        <h2 className="text-sm font-bold uppercase tracking-tight">The house</h2>
        {race.data && (
          <span className="font-mono text-[11px] text-muted-foreground">
            Round {race.data.round}/{race.data.totalRounds} · {contestants.length} houseguests · ${(race.data.prizeCents / 100).toFixed(0)} prize
          </span>
        )}
        <div className="ml-auto">
          <MoveIn />
        </div>
      </header>

      <div className="bg-[#cfc6b8] p-2">
        <div className="relative mx-auto aspect-[16/8] w-full max-w-5xl overflow-hidden rounded-lg border-[5px] border-[#5c4636] shadow-inner">
          {ROOMS.map((room) => (
            <div
              key={room.key}
              className="absolute border border-[#5c4636]"
              style={{ left: `${room.x}%`, top: `${room.y}%`, width: `${room.w}%`, height: `${room.h}%`, ...room.floor }}
            >
              <div className="absolute inset-x-0 top-0 h-[10%] bg-[#e4e8ee] shadow-[inset_0_-2px_0_rgba(0,0,0,0.12)]" />
              <Sign label={room.label} />
              <Furniture room={room.key} />
            </div>
          ))}

          {placed.map(({ contestant, room, slot }) => (
            <Resident key={contestant.id} contestant={contestant} room={room} slot={slot} />
          ))}

          {!race.isLoading && contestants.length === 0 && (
            <div className="absolute inset-0 z-30 flex items-center justify-center">
              <p className="rounded-lg bg-card/90 px-3 py-2 font-mono text-[11px] uppercase text-muted-foreground shadow">
                The house is empty. Set up a contestant to move someone in.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
