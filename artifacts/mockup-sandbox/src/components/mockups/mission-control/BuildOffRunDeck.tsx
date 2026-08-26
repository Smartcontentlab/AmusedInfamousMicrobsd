import { useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  ArrowUpRight,
  Bot,
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  Command,
  Eye,
  Filter,
  GitBranch,
  Link2,
  LockKeyhole,
  MessageSquare,
  MoreHorizontal,
  Pause,
  Play,
  Radio,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
  UserRound,
  X,
} from "lucide-react";

type RunStatus = "running" | "waiting" | "ready" | "paused";
type RunTone = "cyan" | "pink" | "lime" | "amber";

type Run = {
  id: string;
  agent: string;
  handle: string;
  model: string;
  title: string;
  branch: string;
  status: RunStatus;
  tone: RunTone;
  progress: number;
  elapsed: string;
  next: string;
  lastSignal: string;
  safe: boolean;
};

const runs: Run[] = [
  {
    id: "OC-174",
    agent: "NOVA",
    handle: "nova-17",
    model: "OpenClaw",
    title: "Shape the first useful moment",
    branch: "invite-flow / v3",
    status: "running",
    tone: "cyan",
    progress: 72,
    elapsed: "06:18",
    next: "needs a visual sanity check",
    lastSignal: "CTA hierarchy is now testable",
    safe: true,
  },
  {
    id: "HE-092",
    agent: "MICA",
    handle: "mica-04",
    model: "Hermes",
    title: "Pressure-test the pricing story",
    branch: "pricing / hypothesis-b",
    status: "waiting",
    tone: "pink",
    progress: 58,
    elapsed: "04:47",
    next: "awaiting host decision",
    lastSignal: "Three objections clustered",
    safe: true,
  },
  {
    id: "OC-168",
    agent: "ORBIT",
    handle: "orbit-22",
    model: "OpenClaw",
    title: "Clear the webhook retry path",
    branch: "infra / retry-probes",
    status: "ready",
    tone: "lime",
    progress: 91,
    elapsed: "08:02",
    next: "ready to hand off",
    lastSignal: "12 / 12 probes passing",
    safe: true,
  },
  {
    id: "HE-087",
    agent: "SABLE",
    handle: "sable-09",
    model: "Hermes",
    title: "Give the demo a visual spine",
    branch: "story / cut-02",
    status: "paused",
    tone: "amber",
    progress: 33,
    elapsed: "02:11",
    next: "paused by operator",
    lastSignal: "Reference frame is ambiguous",
    safe: false,
  },
];

const toneMap: Record<RunTone, { ink: string; soft: string; line: string }> = {
  cyan: { ink: "#7be7ff", soft: "#12313a", line: "#2b91a8" },
  pink: { ink: "#ff82c9", soft: "#3b2035", line: "#aa4d84" },
  lime: { ink: "#c9f573", soft: "#29381d", line: "#759b45" },
  amber: { ink: "#ffd579", soft: "#3d311c", line: "#a9843f" },
};

const statusCopy: Record<RunStatus, string> = {
  running: "RUNNING",
  waiting: "WAITING ON YOU",
  ready: "READY TO HAND OFF",
  paused: "PAUSED",
};

function RailItem({
  icon: Icon,
  label,
  count,
  active,
  onClick,
}: {
  icon: typeof Activity;
  label: string;
  count?: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`group flex w-full items-center gap-3 border-l-2 px-3 py-3 text-left transition-colors ${
        active
          ? "border-[#7be7ff] bg-[#132630] text-[#f3f5f5]"
          : "border-transparent text-[#81919d] hover:border-[#385768] hover:bg-[#101d28] hover:text-[#dce5ea]"
      }`}
    >
      <Icon size={15} className={active ? "text-[#7be7ff]" : "text-[#5f7380]"} />
      <span className="flex-1 text-[10px] font-bold uppercase tracking-[0.16em]">{label}</span>
      {count && <span className="font-mono text-[10px] text-[#657783]">{count}</span>}
      {active && <ChevronRight size={13} className="text-[#7be7ff]" />}
    </button>
  );
}

function StatusBadge({ status, tone }: { status: RunStatus; tone: RunTone }) {
  const palette = toneMap[tone];
  return (
    <span
      className="inline-flex items-center gap-1.5 border px-2 py-1 text-[9px] font-bold uppercase tracking-[0.13em]"
      style={{ color: palette.ink, borderColor: `${palette.line}99`, backgroundColor: `${palette.soft}99` }}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${status === "running" ? "animate-pulse" : ""}`} style={{ backgroundColor: palette.ink }} />
      {statusCopy[status]}
    </span>
  );
}

function Signal({
  children,
  tone = "cyan",
}: {
  children: ReactNode;
  tone?: RunTone;
}) {
  return (
    <span
      className="inline-flex items-center gap-1.5 border px-2 py-1 text-[9px] font-bold uppercase tracking-[0.13em]"
      style={{ color: toneMap[tone].ink, borderColor: `${toneMap[tone].line}99`, backgroundColor: `${toneMap[tone].soft}99` }}
    >
      {children}
    </span>
  );
}

export function BuildOffRunDeck() {
  const [activeRunId, setActiveRunId] = useState("OC-174");
  const [activeRail, setActiveRail] = useState("in-flight");
  const [filter, setFilter] = useState<"all" | RunStatus>("all");
  const [search, setSearch] = useState("");
  const [paused, setPaused] = useState<Record<string, boolean>>({});
  const [linked, setLinked] = useState<Record<string, boolean>>({ "OC-174": true, "HE-092": true });
  const [command, setCommand] = useState("");
  const [toast, setToast] = useState("4 runs connected · last sync 4 sec ago");

  const visibleRuns = useMemo(() => {
    const query = search.trim().toLowerCase();
    return runs.filter((run) => {
      const matchesRail =
        activeRail === "all" ||
        (activeRail === "in-flight" && (run.status === "running" || run.status === "waiting")) ||
        (activeRail === "handoff" && run.status === "ready") ||
        (activeRail === "paused" && run.status === "paused");
      const matchesFilter = filter === "all" || run.status === filter;
      const matchesSearch =
        !query ||
        [run.id, run.agent, run.title, run.branch, run.model].some((value) => value.toLowerCase().includes(query));
      return matchesRail && matchesFilter && matchesSearch;
    });
  }, [activeRail, filter, search]);

  const activeRun = runs.find((run) => run.id === activeRunId) ?? runs[0];
  const activeTone = toneMap[activeRun.tone];

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast("4 runs connected · last sync 4 sec ago"), 2600);
  };

  const togglePause = (id: string) => {
    setPaused((current) => ({ ...current, [id]: !current[id] }));
    notify(`${id} ${paused[id] ? "resumed" : "paused"} by operator`);
  };

  const sendCommand = () => {
    const clean = command.trim();
    if (!clean) {
      notify("Write a command before sending it");
      return;
    }
    setCommand("");
    notify(`Command queued for ${activeRun.agent}`);
  };

  return (
    <main className="min-h-[100dvh] bg-[#080f17] px-3 py-3 text-[#dce5ea] selection:bg-[#7be7ff] selection:text-[#091117] sm:px-5 sm:py-5">
      <div className="mx-auto max-w-[1540px]">
        <header className="mb-3 flex flex-wrap items-center justify-between gap-4 border-b border-[#283946] pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center border border-[#7be7ff] bg-[#102b36] text-[#7be7ff] shadow-[3px_3px_0_#7be7ff]">
              <TerminalSquare size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.24em] text-[#7be7ff]">
                <span className="h-2 w-2 animate-pulse rounded-full bg-[#ff82c9]" />
                buildoff / run deck
              </div>
              <h1 className="font-['Space_Grotesk'] text-2xl font-bold tracking-[-0.05em] text-[#f3f5f5] sm:text-3xl">
                Keep the useful signal moving.
              </h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 border border-[#283946] bg-[#101923] px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#8293a0]">
              <Radio size={13} className="text-[#c9f573]" /> live relay
            </div>
            <button onClick={() => notify("Command palette opened")} className="flex items-center gap-2 border border-[#283946] px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#8293a0] hover:border-[#7be7ff] hover:text-[#7be7ff]">
              <Command size={13} /> command <span className="border border-[#3a4a57] px-1 font-mono text-[9px]">K</span>
            </button>
            <div className="flex items-center gap-2 border border-[#283946] bg-[#101923] px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#8293a0]">
              <ShieldCheck size={13} className="text-[#c9f573]" /> safe mode
            </div>
          </div>
        </header>

        <div className="grid gap-3 lg:grid-cols-[205px_minmax(0,1fr)_310px]">
          <aside className="border border-[#283946] bg-[#0d1721] p-3">
            <div className="mb-3 border-b border-[#283946] pb-3">
              <div className="mb-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#7be7ff]">
                <GitBranch size={13} /> mission relay
              </div>
              <div className="font-mono text-[11px] text-[#8293a0]">ROUND 03 / PRODUCT RELAY</div>
            </div>
            <div className="space-y-1">
              <RailItem icon={Activity} label="in-flight" count="02" active={activeRail === "in-flight"} onClick={() => setActiveRail("in-flight")} />
              <RailItem icon={ArrowUpRight} label="handoff queue" count="01" active={activeRail === "handoff"} onClick={() => setActiveRail("handoff")} />
              <RailItem icon={Pause} label="paused" count="01" active={activeRail === "paused"} onClick={() => setActiveRail("paused")} />
              <RailItem icon={Eye} label="all runs" count="04" active={activeRail === "all"} onClick={() => setActiveRail("all")} />
            </div>
            <div className="mt-6 border-t border-[#283946] pt-4">
              <div className="mb-3 flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.17em] text-[#6d818e]"><Link2 size={12} /> linked runtimes</div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[10px] text-[#dce5ea]"><span className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-[#7be7ff]" /> OpenClaw</span><span className="font-mono text-[#6d818e]">02</span></div>
                <div className="flex items-center justify-between text-[10px] text-[#dce5ea]"><span className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-[#ff82c9]" /> Hermes</span><span className="font-mono text-[#6d818e]">02</span></div>
              </div>
            </div>
            <div className="mt-6 border border-[#2b594f] bg-[#142a27] p-3">
              <div className="mb-2 flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.16em] text-[#c9f573]"><LockKeyhole size={12} /> audience-safe</div>
              <p className="text-[11px] leading-relaxed text-[#a6b7b2]">Private reasoning stays private. Only outputs, blockers, and tradeoffs cross the relay.</p>
            </div>
          </aside>

          <section className="min-w-0 border border-[#283946] bg-[#0d1721]">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#283946] p-4 sm:p-5">
              <div>
                <div className="mb-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#ff82c9]"><Sparkles size={13} /> operator queue</div>
                <h2 className="font-['Space_Grotesk'] text-xl font-bold tracking-[-0.04em] text-[#f3f5f5]">Choose the next useful intervention.</h2>
              </div>
              <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-[#6f828e]"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#c9f573]" /> synced {toast.includes("sync") ? "now" : "just now"}</div>
            </div>
            <div className="flex flex-col gap-2 border-b border-[#283946] bg-[#0b141d] p-3 sm:flex-row">
              <label className="flex min-w-0 flex-1 items-center gap-2 border border-[#283946] bg-[#101b25] px-3 text-[#6f828e]">
                <Search size={14} />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a run, branch, or agent…" className="min-w-0 flex-1 bg-transparent py-2 text-xs text-[#f3f5f5] outline-none placeholder:text-[#5e7280]" />
                {search && <button onClick={() => setSearch("")} aria-label="Clear search" className="hover:text-[#f3f5f5]"><X size={13} /></button>}
              </label>
              <div className="flex items-center gap-1 border border-[#283946] p-1">
                <Filter size={13} className="mx-2 text-[#6f828e]" />
                {(["all", "running", "waiting", "ready"] as const).map((item) => (
                  <button key={item} onClick={() => setFilter(item)} className={`px-2 py-1.5 text-[9px] font-bold uppercase tracking-[0.11em] ${filter === item ? "bg-[#7be7ff] text-[#091117]" : "text-[#81919d] hover:text-[#f3f5f5]"}`}>{item}</button>
                ))}
              </div>
            </div>
            <div className="space-y-2 p-3 sm:p-4">
              {visibleRuns.length === 0 && (
                <div className="border border-dashed border-[#38505f] px-5 py-12 text-center">
                  <Search size={18} className="mx-auto mb-3 text-[#7be7ff]" />
                  <div className="text-sm font-bold text-[#f3f5f5]">No runs in this slice.</div>
                  <div className="mt-1 text-xs text-[#748794]">Try a different lane or clear the search.</div>
                  <button onClick={() => { setSearch(""); setFilter("all"); setActiveRail("all"); }} className="mt-4 border border-[#7be7ff] px-3 py-2 text-[9px] font-bold uppercase tracking-[0.14em] text-[#7be7ff] hover:bg-[#12313a]">show all runs</button>
                </div>
              )}
              {visibleRuns.map((run) => {
                const palette = toneMap[run.tone];
                const isSelected = activeRunId === run.id;
                const isPaused = paused[run.id] || run.status === "paused";
                return (
                  <button
                    key={run.id}
                    onClick={() => setActiveRunId(run.id)}
                    className={`w-full border p-3 text-left transition-colors sm:p-4 ${isSelected ? "border-[#7be7ff] bg-[#122530]" : "border-[#283946] bg-[#101b25] hover:border-[#536d7b]"}`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center border text-[12px] font-bold" style={{ color: palette.ink, borderColor: palette.line, backgroundColor: palette.soft }}>{run.agent.slice(0, 1)}</div>
                        <div className="min-w-0">
                          <div className="mb-1 flex flex-wrap items-center gap-2"><span className="font-['Space_Grotesk'] text-[16px] font-bold text-[#f3f5f5]">{run.title}</span><StatusBadge status={isPaused ? "paused" : run.status} tone={run.tone} /></div>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] uppercase tracking-[0.11em] text-[#70838f]"><span style={{ color: palette.ink }}>{run.agent}</span><span>·</span><span>{run.model}</span><span>·</span><span>{run.branch}</span></div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-right"><div><div className="font-mono text-[9px] uppercase tracking-[0.12em] text-[#6e818e]">elapsed</div><div className="font-mono text-sm text-[#f3f5f5]">{run.elapsed}</div></div><ChevronRight size={15} className={isSelected ? "text-[#7be7ff]" : "text-[#5f7380]"} /></div>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_155px] sm:items-end">
                      <div>
                        <div className="mb-2 flex justify-between text-[9px] font-bold uppercase tracking-[0.12em] text-[#6e818e]"><span>useful output assembled</span><span className="font-mono text-[#dce5ea]">{run.progress}%</span></div>
                        <div className="h-1.5 bg-[#273843]"><div className="h-full transition-[width] duration-500" style={{ width: `${run.progress}%`, backgroundColor: palette.ink }} /></div>
                      </div>
                      <div className="text-[10px] text-[#8799a4]"><span className="mr-1 uppercase tracking-[0.1em] text-[#647783]">next:</span>{run.next}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <aside className="border border-[#283946] bg-[#0d1721]">
            <div className="border-b border-[#283946] p-4">
              <div className="mb-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: activeTone.ink }}><span className="flex items-center gap-2"><Bot size={13} /> selected run</span><button onClick={() => notify("Run menu opened")} aria-label="Open run menu" className="text-[#6f828e] hover:text-[#f3f5f5]"><MoreHorizontal size={16} /></button></div>
              <h2 className="font-['Space_Grotesk'] text-xl font-bold leading-tight tracking-[-0.04em] text-[#f3f5f5]">{activeRun.title}</h2>
              <div className="mt-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.12em] text-[#71838f]"><span style={{ color: activeTone.ink }}>{activeRun.agent}</span><span>·</span><span>{activeRun.id}</span></div>
            </div>
            <div className="space-y-4 p-4">
              <div className="flex items-center justify-between"><StatusBadge status={paused[activeRun.id] ? "paused" : activeRun.status} tone={activeRun.tone} /><span className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.1em] text-[#c9f573]"><ShieldCheck size={12} /> public-safe</span></div>
              <div className="border-l-2 pl-3" style={{ borderColor: activeTone.ink }}>
                <div className="mb-1 text-[9px] font-bold uppercase tracking-[0.16em] text-[#70838f]">latest useful signal</div>
                <p className="text-sm leading-relaxed text-[#e1e8eb]">{activeRun.lastSignal}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="border border-[#283946] bg-[#101b25] p-3"><div className="text-[9px] uppercase tracking-[0.12em] text-[#6e818e]">progress</div><div className="mt-1 font-mono text-xl text-[#f3f5f5]">{activeRun.progress}%</div></div>
                <div className="border border-[#283946] bg-[#101b25] p-3"><div className="text-[9px] uppercase tracking-[0.12em] text-[#6e818e]">runtime</div><div className="mt-1 font-mono text-xl text-[#f3f5f5]">{activeRun.model}</div></div>
              </div>
              <div>
                <div className="mb-2 flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.16em] text-[#6e818e]"><Activity size={12} className="text-[#7be7ff]" /> decision trail</div>
                <div className="space-y-3 border-l border-[#334853] pl-3">
                  <div><div className="font-mono text-[9px] text-[#607581]">14:32:08</div><div className="mt-1 text-xs text-[#dce5ea]">Output checkpoint marked visible</div></div>
                  <div><div className="font-mono text-[9px] text-[#607581]">14:30:41</div><div className="mt-1 text-xs text-[#dce5ea]">Agent requested a human sanity check</div></div>
                  <div><div className="font-mono text-[9px] text-[#607581]">14:27:12</div><div className="mt-1 text-xs text-[#dce5ea]">Run linked to round brief v3.1</div></div>
                </div>
              </div>
              <div className="border-t border-[#283946] pt-4">
                <div className="mb-2 flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.16em] text-[#6e818e]"><UserRound size={12} className="text-[#ffd579]" /> operator action</div>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => togglePause(activeRun.id)} className="flex items-center justify-center gap-2 border border-[#283946] px-2 py-2.5 text-[9px] font-bold uppercase tracking-[0.11em] text-[#dce5ea] hover:border-[#ffd579] hover:text-[#ffd579]">{paused[activeRun.id] ? <Play size={13} /> : <Pause size={13} />}{paused[activeRun.id] ? "resume" : "pause"}</button>
                  <button onClick={() => { setLinked((current) => ({ ...current, [activeRun.id]: !current[activeRun.id] })); notify(`${activeRun.id} ${linked[activeRun.id] ? "unlinked" : "linked"} to audience relay`); }} className={`flex items-center justify-center gap-2 border px-2 py-2.5 text-[9px] font-bold uppercase tracking-[0.11em] ${linked[activeRun.id] ? "border-[#759b45] bg-[#29381d] text-[#c9f573]" : "border-[#283946] text-[#81919d] hover:border-[#7be7ff] hover:text-[#7be7ff]"}`}><Link2 size={13} />{linked[activeRun.id] ? "linked" : "link output"}</button>
                </div>
                <button onClick={() => notify(`${activeRun.id} marked ready for review`)} className="mt-2 flex w-full items-center justify-center gap-2 border border-[#7be7ff] bg-[#7be7ff] px-3 py-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[#091117] hover:bg-[#c9f573]"><Check size={14} /> mark ready for review</button>
              </div>
              <div className="border border-[#283946] bg-[#101b25] p-3">
                <div className="mb-2 flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.15em] text-[#6e818e]"><MessageSquare size={12} className="text-[#ff82c9]" /> send a safe instruction</div>
                <div className="flex items-center gap-2 border border-[#344955] bg-[#0c151e] px-2"><input value={command} onChange={(event) => setCommand(event.target.value)} onKeyDown={(event) => event.key === "Enter" && sendCommand()} placeholder="e.g. show the tradeoff" className="min-w-0 flex-1 bg-transparent py-2.5 text-xs text-[#f3f5f5] outline-none placeholder:text-[#627682]" /><button onClick={sendCommand} aria-label="Send instruction" className="text-[#7be7ff] hover:text-[#c9f573]"><Send size={14} /></button></div>
              </div>
            </div>
          </aside>
        </div>

        <footer className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-[#283946] py-3 text-[10px] uppercase tracking-[0.15em] text-[#607581]">
          <div className="flex items-center gap-3"><span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-[#c9f573]" /> audience-safe relay</span><span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-[#7be7ff]" /> operator connected</span></div>
          <div className="flex items-center gap-2"><Clock3 size={12} /> {toast}</div>
          <button onClick={() => notify("Runbook opened")} className="flex items-center gap-2 hover:text-[#7be7ff]"><CircleHelp size={13} /> runbook <ArrowUpRight size={11} /></button>
        </footer>
      </div>
    </main>
  );
}

export default BuildOffRunDeck;