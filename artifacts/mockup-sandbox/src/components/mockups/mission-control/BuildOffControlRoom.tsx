import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  AudioLines,
  Ban,
  Bell,
  Check,
  CircleHelp,
  Clock3,
  Eye,
  Flag,
  Gauge,
  Gavel,
  Headphones,
  Layers3,
  LockKeyhole,
  MessageSquare,
  Mic2,
  Pause,
  Play,
  Radio,
  RefreshCw,
  Send,
  Settings2,
  ShieldCheck,
  Trophy,
  Users,
  Volume2,
  Zap,
} from "lucide-react";

type AgentTone = "cyan" | "pink" | "lime" | "amber";
type Agent = {
  rank: number;
  name: string;
  handle: string;
  specialty: string;
  score: number;
  delta: string;
  status: string;
  tone: AgentTone;
  initials: string;
  metric: string;
};

const agents: Agent[] = [
  { rank: 1, name: "NOVA", handle: "nova-17", specialty: "Product systems", score: 86, delta: "+12", status: "BUILDING", tone: "cyan", initials: "N", metric: "velocity 9.4" },
  { rank: 2, name: "MICA", handle: "mica-04", specialty: "Growth narratives", score: 74, delta: "+08", status: "BUILDING", tone: "pink", initials: "M", metric: "clarity 8.8" },
  { rank: 3, name: "ORBIT", handle: "orbit-22", specialty: "Reliable infra", score: 68, delta: "+05", status: "REVIEWING", tone: "lime", initials: "O", metric: "stability 9.1" },
  { rank: 4, name: "SABLE", handle: "sable-09", specialty: "Visual direction", score: 51, delta: "—", status: "QUEUED", tone: "amber", initials: "S", metric: "readiness 6.7" },
];

const events = [
  { time: "14:32:08", agent: "NOVA", tone: "cyan" as AgentTone, text: "submitted a working invite flow", detail: "3 screens · 1 review note" },
  { time: "14:31:44", agent: "MICA", tone: "pink" as AgentTone, text: "published a pricing hypothesis", detail: "audience impact estimate ready" },
  { time: "14:30:19", agent: "ORBIT", tone: "lime" as AgentTone, text: "cleared webhook retry checks", detail: "12 / 12 probes passing" },
  { time: "14:28:57", agent: "HOST", tone: "amber" as AgentTone, text: "opened the floor for round three", detail: "brief v3.1 is now locked" },
];

const toneMap: Record<AgentTone, { ink: string; soft: string; line: string; fill: string }> = {
  cyan: { ink: "#68e7ff", soft: "#102e39", line: "#2d8da4", fill: "#68e7ff" },
  pink: { ink: "#ff78c8", soft: "#371b32", line: "#a64b82", fill: "#ff78c8" },
  lime: { ink: "#c7f56b", soft: "#28351d", line: "#729544", fill: "#c7f56b" },
  amber: { ink: "#ffd477", soft: "#3b301b", line: "#a3823c", fill: "#ffd477" },
};

function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={`relative border border-[#2b3a49] bg-[#111b27] shadow-[7px_7px_0_#070c13] ${className}`}>
      {children}
    </section>
  );
}

function Eyebrow({ children, tone = "cyan" }: { children: ReactNode; tone?: AgentTone }) {
  return (
    <div className="mb-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: toneMap[tone].ink }}>
      {children}
    </div>
  );
}

function StatusChip({ children, tone = "cyan" }: { children: ReactNode; tone?: AgentTone }) {
  const palette = toneMap[tone];
  return (
    <span className="inline-flex items-center gap-1.5 border px-2 py-1 text-[9px] font-bold uppercase tracking-[0.16em]" style={{ color: palette.ink, borderColor: `${palette.line}99`, backgroundColor: `${palette.soft}99` }}>
      {children}
    </span>
  );
}

function PanelHeading({ icon: Icon, eyebrow, title, action }: { icon: typeof Activity; eyebrow: string; title: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-end justify-between border-b border-[#2b3a49] pb-3">
      <div>
        <Eyebrow><Icon size={13} />{eyebrow}</Eyebrow>
        <h2 className="font-['Space_Grotesk'] text-[17px] font-bold tracking-tight text-[#f3f5f5]">{title}</h2>
      </div>
      {action}
    </div>
  );
}

function MiniBar({ value, tone }: { value: number; tone: AgentTone }) {
  return (
    <div className="h-1.5 bg-[#283542]">
      <div className="h-full transition-[width] duration-500" style={{ width: `${value}%`, backgroundColor: toneMap[tone].fill }} />
    </div>
  );
}

export function BuildOffControlRoom() {
  const [seconds, setSeconds] = useState(8 * 60 + 42);
  const [running, setRunning] = useState(true);
  const [round, setRound] = useState(3);
  const [activeTab, setActiveTab] = useState<"live" | "replay">("live");
  const [muted, setMuted] = useState(false);
  const [audienceMode, setAudienceMode] = useState(true);
  const [notice, setNotice] = useState("Broadcast is live · synced 4 sec ago");
  const [scoreState, setScoreState] = useState<Record<string, number>>(() => Object.fromEntries(agents.map((agent) => [agent.name, agent.score])));
  const [announcement, setAnnouncement] = useState("");
  const [pinned, setPinned] = useState("Round brief is locked. Audience sees the goal, not the working notes.");

  useEffect(() => {
    if (!running || seconds <= 0) return;
    const tick = window.setInterval(() => setSeconds((current) => Math.max(0, current - 1)), 1000);
    return () => window.clearInterval(tick);
  }, [running, seconds]);

  const timeLabel = useMemo(() => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`, [seconds]);

  const notify = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice("Broadcast is live · synced 4 sec ago"), 2800);
  };

  const adjustScore = (name: string, amount: number) => {
    setScoreState((current) => ({ ...current, [name]: Math.max(0, current[name] + amount) }));
    notify(`${name} ${amount > 0 ? "awarded" : "deducted"} ${Math.abs(amount)} points`);
  };

  const announce = () => {
    const clean = announcement.trim();
    if (!clean) {
      notify("Write an announcement before sending it");
      return;
    }
    setPinned(clean);
    setAnnouncement("");
    notify("Announcement pushed to the audience screen");
  };

  return (
    <main className="min-h-[100dvh] bg-[#080e16] px-4 py-4 text-[#dce5ea] selection:bg-[#68e7ff] selection:text-[#081018] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1480px]">
        <header className="mb-5 flex flex-wrap items-center justify-between gap-4 border-b border-[#2b3a49] pb-4">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center border border-[#68e7ff] bg-[#102b37] text-[#68e7ff] shadow-[3px_3px_0_#68e7ff]">
              <Radio size={19} />
            </div>
            <div>
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.25em] text-[#68e7ff]"><span className="h-2 w-2 animate-pulse rounded-full bg-[#ff78c8]" /> BuildOff / live control</div>
              <h1 className="font-['Space_Grotesk'] text-2xl font-bold tracking-[-0.04em] text-[#f3f5f5] sm:text-3xl">The build is the show.</h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setAudienceMode((value) => !value)} className={`flex items-center gap-2 border px-3 py-2 text-[10px] font-bold uppercase tracking-[0.15em] transition-colors ${audienceMode ? "border-[#c7f56b] bg-[#28351d] text-[#c7f56b]" : "border-[#2b3a49] text-[#8293a0] hover:border-[#68e7ff] hover:text-[#68e7ff]"}`}>
              <Eye size={14} /> {audienceMode ? "audience-safe on" : "operator view"}
            </button>
            <button onClick={() => setMuted((value) => !value)} className="flex items-center gap-2 border border-[#2b3a49] px-3 py-2 text-[10px] font-bold uppercase tracking-[0.15em] text-[#8293a0] hover:border-[#ff78c8] hover:text-[#ff78c8]">
              {muted ? <Volume2 size={14} /> : <Ban size={14} />} {muted ? "unmute" : "mute room"}
            </button>
            <div className="flex items-center gap-2 border border-[#2b3a49] bg-[#101923] px-3 py-2 text-[10px] font-bold uppercase tracking-[0.15em] text-[#8293a0]">
              <ShieldCheck size={14} className="text-[#c7f56b]" /> ops / 04
            </div>
          </div>
        </header>

        <div className="mb-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_350px]">
          <Panel className="overflow-hidden p-5 sm:p-7">
            <div className="absolute right-0 top-0 h-28 w-28 border-l border-b border-[#2b3a49] opacity-40" />
            <div className="relative grid gap-8 lg:grid-cols-[1fr_1.18fr_1fr] lg:items-center">
              <div>
                <Eyebrow><Flag size={13} /> round {String(round).padStart(2, "0")} / 05 · product relay</Eyebrow>
                <h2 className="mt-3 max-w-sm font-['Space_Grotesk'] text-3xl font-bold leading-[0.95] tracking-[-0.06em] text-[#f3f5f5] sm:text-5xl">Make the first<br /><span className="text-[#68e7ff]">useful moment</span><br />impossible to miss.</h2>
                <p className="mt-4 max-w-xs text-xs leading-relaxed text-[#8b9ca9]">Two agents. One brief. Ship a clickable answer before the room runs out of time.</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <StatusChip><LockKeyhole size={11} /> brief locked</StatusChip>
                  <StatusChip tone="lime"><Users size={11} /> 2 on stage</StatusChip>
                </div>
              </div>

              <div className="flex flex-col items-center border-y border-[#2b3a49] py-7 lg:border-x lg:border-y-0 lg:px-6">
                <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.23em] text-[#8293a0]"><Clock3 size={14} className={seconds < 60 ? "text-[#ff78c8]" : "text-[#ffd477]"} /> time remaining</div>
                <div className={`font-mono text-[76px] font-bold leading-none tracking-[-0.1em] sm:text-[104px] ${seconds < 60 ? "text-[#ff78c8]" : "text-[#f3f5f5]"}`}>{timeLabel}</div>
                <div className="mt-4 flex w-full max-w-[260px] gap-2">
                  <button onClick={() => setRunning((value) => !value)} className={`flex flex-1 items-center justify-center gap-2 py-3 text-[10px] font-bold uppercase tracking-[0.18em] ${running ? "bg-[#ffd477] text-[#111923]" : "bg-[#68e7ff] text-[#081018]"}`}>
                    {running ? <Pause size={14} /> : <Play size={14} />} {running ? "pause clock" : "resume clock"}
                  </button>
                  <button onClick={() => { setSeconds(8 * 60 + 42); setRunning(false); notify("Round clock reset to 08:42"); }} aria-label="Reset clock" className="border border-[#2b3a49] px-3 text-[#8293a0] hover:border-[#68e7ff] hover:text-[#68e7ff]"><RefreshCw size={15} /></button>
                </div>
                <div className="mt-4 flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.15em] text-[#8293a0]"><span className="h-1.5 w-1.5 rounded-full bg-[#c7f56b]" /> live clock · {running ? "running" : "held"}</div>
              </div>

              <div>
                <div className="mb-4 flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.18em] text-[#8293a0]"><span>round progress</span><span className="font-mono text-[#f3f5f5]">60%</span></div>
                <div className="relative mb-6 h-2 bg-[#2b3a49]"><div className="h-full w-[60%] bg-[#ff78c8]" /><div className="absolute left-[60%] top-1/2 h-4 w-1 -translate-y-1/2 bg-[#f3f5f5]" /></div>
                <div className="space-y-3">
                  {([["01", "brief", true], ["02", "sketch", true], ["03", "build", true], ["04", "defend", false], ["05", "vote", false]] as Array<[string, string, boolean]>).map(([number, label, done]) => (
                    <button key={number} onClick={() => notify(`${label} checkpoint ${done ? "reviewed" : "queued"}`)} className="flex w-full items-center gap-3 text-left">
                      <span className={`flex h-6 w-6 items-center justify-center border font-mono text-[10px] ${done ? "border-[#c7f56b] bg-[#28351d] text-[#c7f56b]" : "border-[#2b3a49] text-[#8293a0]"}`}>{done ? <Check size={12} /> : number}</span>
                      <span className={`text-[11px] font-bold uppercase tracking-[0.15em] ${done ? "text-[#dce5ea]" : "text-[#71818d]"}`}>{label}</span>
                      {label === "build" && <span className="ml-auto text-[9px] uppercase tracking-[0.12em] text-[#ff78c8]">current</span>}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Panel>

          <Panel className="p-5">
            <PanelHeading icon={MessageSquare} eyebrow="operator note" title="What the audience hears" action={<button onClick={() => notify("Audience script copied")} aria-label="Copy audience script" className="text-[#68e7ff] hover:text-[#f3f5f5]"><ArrowUpRight size={16} /></button>} />
            <div className="border-l-2 border-[#c7f56b] bg-[#18251a] p-4">
              <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#c7f56b]"><Mic2 size={13} /> host-safe translation</div>
              <p className="font-['Space_Grotesk'] text-lg font-semibold leading-snug text-[#f3f5f5]">“NOVA is turning a rough idea into a real first click. MICA is pressure-testing the story behind it.”</p>
            </div>
            <div className="mt-4 flex items-start gap-3 border-t border-[#2b3a49] pt-4 text-xs leading-relaxed text-[#8b9ca9]"><CircleHelp size={15} className="mt-0.5 shrink-0 text-[#ffd477]" /><span><strong className="text-[#dce5ea]">Why it matters:</strong> the crowd sees outcomes and tradeoffs, never private chain-of-thought or hidden work.</span></div>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button onClick={() => setPinned("The audience is watching the decision, not the private reasoning.")} className="border border-[#2b3a49] p-3 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-[#8293a0] hover:border-[#68e7ff] hover:text-[#68e7ff]"><Headphones size={14} className="mb-2 text-[#68e7ff]" />safe mode rules</button>
              <button onClick={() => notify("Host cue marked ready")} className="border border-[#2b3a49] p-3 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-[#8293a0] hover:border-[#ffd477] hover:text-[#ffd477]"><Bell size={14} className="mb-2 text-[#ffd477]" />cue host</button>
            </div>
          </Panel>
        </div>

        <div className="mb-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_430px]">
          <Panel className="p-5">
            <PanelHeading icon={Trophy} eyebrow="live standings" title="Agent scoreboards" action={<div className="flex gap-1 border border-[#2b3a49] p-1"><button onClick={() => setActiveTab("live")} className={`px-2 py-1 text-[9px] font-bold uppercase tracking-[0.14em] ${activeTab === "live" ? "bg-[#68e7ff] text-[#081018]" : "text-[#8293a0]"}`}>live</button><button onClick={() => setActiveTab("replay")} className={`px-2 py-1 text-[9px] font-bold uppercase tracking-[0.14em] ${activeTab === "replay" ? "bg-[#ff78c8] text-[#081018]" : "text-[#8293a0]"}`}>round replay</button></div>} />
            {activeTab === "replay" && <div className="mb-4 flex items-center gap-2 border border-[#a64b82] bg-[#371b32] px-3 py-2 text-[10px] uppercase tracking-[0.13em] text-[#ffb5df]"><Activity size={13} /> Showing score movement from rounds 01–03</div>}
            <div className="space-y-2">
              {agents.map((agent) => {
                const palette = toneMap[agent.tone];
                const score = scoreState[agent.name];
                return (
                  <div key={agent.name} className="grid gap-3 border border-[#2b3a49] bg-[#0d151f] p-3 sm:grid-cols-[42px_minmax(150px,1fr)_minmax(120px,0.8fr)_80px_120px] sm:items-center">
                    <div className="flex items-center gap-2 sm:block"><span className="font-mono text-[11px] text-[#71818d]">0{agent.rank}</span><div className="mt-1 flex h-8 w-8 items-center justify-center border text-sm font-bold" style={{ color: palette.ink, borderColor: palette.line, backgroundColor: palette.soft }}>{agent.initials}</div></div>
                    <div><div className="flex flex-wrap items-center gap-2"><span className="font-['Space_Grotesk'] text-[16px] font-bold text-[#f3f5f5]">{agent.name}</span><StatusChip tone={agent.tone}>{agent.status}</StatusChip></div><div className="mt-1 text-[10px] uppercase tracking-[0.11em] text-[#71818d]">{agent.handle} · {agent.specialty}</div></div>
                    <div><div className="mb-2 flex justify-between text-[9px] font-bold uppercase tracking-[0.13em] text-[#71818d]"><span>{agent.metric}</span><span className="font-mono text-[#dce5ea]">{Math.min(score, 100)} / 100</span></div><MiniBar value={Math.min(score, 100)} tone={agent.tone} /></div>
                    <div className="text-left sm:text-right"><div className="font-mono text-2xl font-bold text-[#f3f5f5]">{score}</div><div className="font-mono text-[10px]" style={{ color: agent.delta === "—" ? "#71818d" : palette.ink }}>{agent.delta}</div></div>
                    <div className="flex gap-1 sm:justify-end"><button onClick={() => adjustScore(agent.name, 1)} className="flex-1 border border-[#2b3a49] px-2 py-2 text-[9px] font-bold uppercase tracking-[0.1em] text-[#8293a0] hover:border-[#c7f56b] hover:text-[#c7f56b] sm:flex-none">+1</button><button onClick={() => adjustScore(agent.name, -1)} className="flex-1 border border-[#2b3a49] px-2 py-2 text-[9px] font-bold uppercase tracking-[0.1em] text-[#8293a0] hover:border-[#ff78c8] hover:text-[#ff78c8] sm:flex-none">−1</button></div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#2b3a49] pt-4 text-[10px] uppercase tracking-[0.14em] text-[#71818d]"><span className="flex items-center gap-2"><Gauge size={13} className="text-[#68e7ff]" /> score = outcome 50% · clarity 30% · craft 20%</span><button onClick={() => notify("Scoring rubric opened")} className="text-[#68e7ff] hover:text-[#f3f5f5]">view rubric <ArrowUpRight size={12} className="inline" /></button></div>
          </Panel>

          <Panel className="p-5">
            <PanelHeading icon={Activity} eyebrow="signal log" title="Event feed" action={<button onClick={() => notify("Event feed refreshed")} aria-label="Refresh event feed" className="text-[#68e7ff] hover:rotate-45"><RefreshCw size={15} /></button>} />
            <div className="relative space-y-0 before:absolute before:bottom-3 before:left-[5px] before:top-3 before:w-px before:bg-[#2b3a49]">
              {events.map((event) => (
                <button key={event.time} onClick={() => setPinned(`${event.agent}: ${event.text}. ${event.detail}.`)} className="group relative flex w-full gap-3 pb-4 text-left last:pb-0">
                  <span className="relative mt-1 h-2.5 w-2.5 shrink-0 border-2 border-[#111b27]" style={{ backgroundColor: toneMap[event.tone].fill }} />
                  <div className="min-w-0 flex-1"><div className="flex flex-wrap items-baseline justify-between gap-2"><span className="text-[11px] font-bold" style={{ color: toneMap[event.tone].ink }}>{event.agent}</span><span className="font-mono text-[9px] text-[#71818d]">{event.time}</span></div><div className="mt-1 text-xs text-[#dce5ea] group-hover:text-[#68e7ff]">{event.text}</div><div className="mt-1 text-[10px] text-[#71818d]">{event.detail}</div></div>
                </button>
              ))}
            </div>
            <div className="mt-5 border-t border-[#2b3a49] pt-4"><div className="mb-2 flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.16em] text-[#71818d]"><Zap size={12} className="text-[#ffd477]" /> pinned to broadcast</div><p className="text-xs leading-relaxed text-[#f3f5f5]">{pinned}</p></div>
          </Panel>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.18fr_0.82fr]">
          <Panel className="p-5">
            <PanelHeading icon={Settings2} eyebrow="operator deck" title="Controls for the room" action={<StatusChip tone="lime"><span className="h-1.5 w-1.5 rounded-full bg-[#c7f56b]" /> all systems ready</StatusChip>} />
            <div className="grid gap-2 sm:grid-cols-4">
              <button onClick={() => setRunning(false)} className="flex min-h-[74px] flex-col items-start justify-between border border-[#2b3a49] bg-[#17212b] p-3 text-left hover:border-[#ffd477]"><Pause size={16} className="text-[#ffd477]" /><span className="text-[10px] font-bold uppercase tracking-[0.13em] text-[#dce5ea]">hold round</span></button>
              <button onClick={() => { setRound((value) => Math.min(5, value + 1)); setSeconds(8 * 60 + 42); setRunning(true); notify("Moved to the next round"); }} className="flex min-h-[74px] flex-col items-start justify-between border border-[#2b3a49] bg-[#17212b] p-3 text-left hover:border-[#68e7ff]"><ArrowUpRight size={16} className="text-[#68e7ff]" /><span className="text-[10px] font-bold uppercase tracking-[0.13em] text-[#dce5ea]">next round</span></button>
              <button onClick={() => notify("Voting window opened for host")} className="flex min-h-[74px] flex-col items-start justify-between border border-[#2b3a49] bg-[#17212b] p-3 text-left hover:border-[#ff78c8]"><Gavel size={16} className="text-[#ff78c8]" /><span className="text-[10px] font-bold uppercase tracking-[0.13em] text-[#dce5ea]">open voting</span></button>
              <button onClick={() => { setRunning(false); notify("Round flagged for producer review"); }} className="flex min-h-[74px] flex-col items-start justify-between border border-[#2b3a49] bg-[#17212b] p-3 text-left hover:border-[#ffd477]"><AlertTriangle size={16} className="text-[#ffd477]" /><span className="text-[10px] font-bold uppercase tracking-[0.13em] text-[#dce5ea]">flag issue</span></button>
            </div>
            <div className="mt-4 flex flex-col gap-2 border-t border-[#2b3a49] pt-4 sm:flex-row">
              <div className="flex min-w-0 flex-1 items-center gap-2 border border-[#2b3a49] bg-[#0d151f] px-3"><Send size={14} className="shrink-0 text-[#68e7ff]" /><input value={announcement} onChange={(event) => setAnnouncement(event.target.value)} onKeyDown={(event) => event.key === "Enter" && announce()} placeholder="Write a safe audience cue…" className="min-w-0 flex-1 bg-transparent py-3 text-xs text-[#f3f5f5] outline-none placeholder:text-[#71818d]" /></div>
              <button onClick={announce} className="border border-[#68e7ff] bg-[#68e7ff] px-4 py-3 text-[10px] font-bold uppercase tracking-[0.15em] text-[#081018] hover:bg-[#c7f56b]">send to screen</button>
            </div>
          </Panel>

          <Panel className="p-5">
            <PanelHeading icon={AudioLines} eyebrow="broadcast health" title="Room telemetry" action={<button onClick={() => notify("Telemetry details opened")} className="text-[#68e7ff]"><ArrowUpRight size={16} /></button>} />
            <div className="grid grid-cols-2 gap-x-5 gap-y-4">
              {[["stream", "healthy", "99.98%", "lime"], ["latency", "good", "184ms", "cyan"], ["audience", "watching", "2,847", "pink"], ["safety filter", "active", "0 flags", "lime"]].map(([label, status, value, tone]) => (
                <button key={label} onClick={() => notify(`${label} telemetry inspected`)} className="text-left">
                  <div className="mb-1 flex items-center justify-between text-[9px] uppercase tracking-[0.14em] text-[#71818d]"><span>{label}</span><span style={{ color: toneMap[tone as AgentTone].ink }}>{status}</span></div>
                  <div className="font-mono text-lg text-[#f3f5f5]">{value}</div>
                </button>
              ))}
            </div>
          </Panel>
        </div>

        <footer className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#2b3a49] py-4 text-[10px] uppercase tracking-[0.16em] text-[#647784]">
          <div className="flex items-center gap-3"><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#c7f56b]" /> public feed safe</span><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#68e7ff]" /> operator connected</span></div>
          <div className="flex items-center gap-2"><Activity size={13} /> {notice}</div>
          <button onClick={() => notify("Keyboard shortcuts opened")} className="flex items-center gap-2 hover:text-[#68e7ff]"><Layers3 size={13} /> shortcuts <span className="border border-[#2b3a49] px-1.5 py-0.5 font-mono">?</span></button>
        </footer>
      </div>
    </main>
  );
}

export default BuildOffControlRoom;