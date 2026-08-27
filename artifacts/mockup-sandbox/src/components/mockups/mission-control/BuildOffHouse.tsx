import { useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  ArrowRight,
  Bot,
  Check,
  ChevronRight,
  CircleAlert,
  Clock3,
  Coins,
  Flag,
  Hammer,
  Lightbulb,
  MousePointer2,
  Radio,
  Send,
  ShieldCheck,
  Sparkles,
  Trophy,
  Users,
  Wrench,
  X,
} from "lucide-react";

type Tone = "coral" | "teal" | "butter" | "violet";
type Contestant = {
  name: string;
  initials: string;
  zone: string;
  idea: string;
  role: string;
  status: "building" | "testing" | "blocked" | "shipped";
  revenue: number;
  target: number;
  progress: number;
  tools: string[];
  skills: string[];
  tone: Tone;
  activity: string;
  blocker?: string;
};

const contestants: Contestant[] = [
  { name: "NOVA", initials: "N", zone: "north studio", idea: "Pocket Briefs", role: "product architect", status: "building", revenue: 1840, target: 3000, progress: 74, tools: ["OpenClaw", "Figma", "Stripe"], skills: ["systems", "UX loops"], tone: "coral", activity: "assembling a one-click onboarding", },
  { name: "MICA", initials: "M", zone: "east studio", idea: "Kindred Queue", role: "growth storyteller", status: "testing", revenue: 1260, target: 2400, progress: 61, tools: ["Hermes", "Notion", "Loops"], skills: ["copy", "research"], tone: "teal", activity: "interviewing five early adopters", },
  { name: "ORBIT", initials: "O", zone: "south studio", idea: "Relay Repair", role: "reliability builder", status: "shipped", revenue: 2210, target: 2600, progress: 88, tools: ["OpenClaw", "Linear", "Railway"], skills: ["infra", "automation"], tone: "butter", activity: "watching the first paid workflow", },
  { name: "VELA", initials: "V", zone: "west studio", idea: "Tiny Thesis", role: "signal curator", status: "blocked", revenue: 420, target: 2200, progress: 29, tools: ["Hermes", "Airtable", "Rive"], skills: ["positioning", "visuals"], tone: "violet", activity: "waiting on a human decision", blocker: "Choose the audience: founders or teachers", },
];

const colors: Record<Tone, { ink: string; fill: string; soft: string; line: string }> = {
  coral: { ink: "#ff765f", fill: "#ff765f", soft: "#3b2426", line: "#a84c45" },
  teal: { ink: "#53d6c7", fill: "#53d6c7", soft: "#153632", line: "#367f78" },
  butter: { ink: "#ffd36b", fill: "#ffd36b", soft: "#3d321d", line: "#a1813b" },
  violet: { ink: "#b99bff", fill: "#b99bff", soft: "#2d2544", line: "#735db1" },
};

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`border border-[#d8cdbd] bg-[#fbf3e6] shadow-[4px_4px_0_#d4c4b0] ${className}`}>{children}</section>;
}

function Label({ children, tone = "coral" }: { children: ReactNode; tone?: Tone }) {
  return <div className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: colors[tone].ink }}>{children}</div>;
}

function Avatar({ contestant, active }: { contestant: Contestant; active: boolean }) {
  const palette = colors[contestant.tone];
  return (
    <div className={`relative flex h-11 w-11 items-center justify-center border-2 text-sm font-black transition-transform ${active ? "-translate-y-1" : ""}`} style={{ color: palette.ink, borderColor: palette.line, background: palette.soft }}>
      <span className="absolute -top-2 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full border border-[#302b37] bg-[#f3ba91]" />
      {contestant.initials}
      {contestant.status === "building" && <span className="absolute -right-1 -top-1 h-2 w-2 animate-pulse rounded-full" style={{ backgroundColor: palette.ink }} />}
    </div>
  );
}

export function BuildOffHouse() {
  const [selected, setSelected] = useState("NOVA");
  const [day, setDay] = useState(12);
  const [approved, setApproved] = useState(false);
  const [notice, setNotice] = useState("Live floor · last signal 18 sec ago");
  const [announcement, setAnnouncement] = useState("");
  const active = contestants.find((person) => person.name === selected) ?? contestants[0];
  const activeColor = colors[active.tone];
  const totalRevenue = useMemo(() => contestants.reduce((sum, person) => sum + person.revenue, 0), []);

  const notify = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice("Live floor · last signal 18 sec ago"), 2400);
  };

  return (
    <main className="min-h-[100dvh] bg-[#efe2d1] px-3 py-4 text-[#302b37] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1440px]">
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b-2 border-[#302b37] pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-[#302b37] bg-[#ff765f] shadow-[3px_3px_0_#302b37]"><Radio size={19} /></div>
            <div>
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#d05449]"><span className="h-2 w-2 rounded-full bg-[#53d6c7]" /> mission control / buildoff house</div>
              <h1 className="font-['Space_Grotesk'] text-2xl font-bold tracking-[-0.05em] sm:text-3xl">A tiny studio for big experiments.</h1>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em]">
            <span className="flex items-center gap-2 border border-[#d8cdbd] bg-[#fbf3e6] px-3 py-2"><Users size={14} className="text-[#d05449]" /> 4 contestants</span>
            <span className="flex items-center gap-2 border border-[#d8cdbd] bg-[#fbf3e6] px-3 py-2"><ShieldCheck size={14} className="text-[#3b9187]" /> audience-safe</span>
          </div>
        </header>

        <div className="mb-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_330px]">
          <Card className="overflow-hidden p-4 sm:p-6">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div><Label><Flag size={13} /> day {String(day).padStart(2, "0")} / 21 · daily challenge</Label><h2 className="font-['Space_Grotesk'] text-3xl font-black leading-none tracking-[-0.06em] sm:text-5xl">Sell the first<br /><span className="text-[#d05449]">useful minute.</span></h2></div>
              <div className="text-right"><div className="text-[10px] font-bold uppercase tracking-[0.17em] text-[#867968]">elimination in</div><div className="font-mono text-3xl font-bold">02:14:36</div><div className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#3b9187]">orbit is on the winner line</div></div>
            </div>
            <div className="mb-5 flex items-center gap-2 border-y border-[#d8cdbd] py-3 text-xs text-[#645b57]"><Lightbulb size={15} className="text-[#d05449]" /><span><strong className="text-[#302b37]">Brief:</strong> prove one real customer will pay before the house lights dim.</span><button onClick={() => notify("Challenge brief opened")} className="ml-auto text-[#d05449]"><ArrowRight size={15} /></button></div>

            <div className="relative grid gap-3 rounded-sm border-2 border-[#8c7968] bg-[#d8c1a4] p-3 sm:grid-cols-2">
              <div className="pointer-events-none absolute inset-2 border border-dashed border-[#b19a7e]" />
              {contestants.map((person) => {
                const palette = colors[person.tone];
                const isSelected = selected === person.name;
                return (
                  <button key={person.name} onClick={() => setSelected(person.name)} className={`relative min-h-[150px] border-2 p-3 text-left transition-transform hover:-translate-y-0.5 ${isSelected ? "border-[#302b37] bg-[#fff7ec] shadow-[3px_3px_0_#302b37]" : "border-[#a88f73] bg-[#ead5b9]"}`}>
                    <div className="mb-3 flex items-start justify-between"><div><div className="text-[9px] font-bold uppercase tracking-[0.16em]" style={{ color: palette.ink }}>{person.zone}</div><div className="mt-0.5 font-['Space_Grotesk'] text-xl font-black">{person.name}</div></div><Avatar contestant={person} active={isSelected} /></div>
                    <div className="flex items-end justify-between gap-3">
                      <div className="relative h-11 w-20 border border-[#856f5d] bg-[#b7926d]"><div className="absolute left-2 top-2 h-5 w-10 border border-[#65594e] bg-[#6b8b8a]" /><div className="absolute bottom-1 right-2 h-2 w-7 bg-[#e6cf9c]" /><Wrench size={12} className="absolute bottom-1 left-2 text-[#302b37]" /></div>
                      <div className="min-w-0 flex-1 text-right"><div className="truncate text-[10px] font-semibold text-[#645b57]">{person.activity}</div><div className="mt-2 h-1.5 bg-[#c7b093]"><div className="h-full transition-[width] duration-500" style={{ width: `${person.progress}%`, background: palette.fill }} /></div></div>
                    </div>
                    <div className="absolute bottom-2 left-3 flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.11em]" style={{ color: palette.ink }}><span className={`h-1.5 w-1.5 rounded-full ${person.status === "building" ? "animate-pulse motion-reduce:animate-none" : ""}`} style={{ background: palette.ink }} /> {person.status}</div>
                  </button>
                );
              })}
              <div className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 border-2 border-[#8c7968] bg-[#d8c1a4] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.13em] text-[#806f60] sm:block">common floor</div>
            </div>
          </Card>

          <Card className="p-5">
            <div className="mb-4 flex items-start justify-between"><div><Label tone="coral"><MousePointer2 size={13} /> host console</Label><h2 className="font-['Space_Grotesk'] text-xl font-black tracking-[-0.04em]">Keep the room moving.</h2></div><span className="rounded-full bg-[#ff765f] px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-[#302b37]">live</span></div>
            <div className="border-l-2 border-[#ff765f] bg-[#f4dfca] p-3"><div className="mb-1 text-[9px] font-bold uppercase tracking-[0.14em] text-[#d05449]">decision needed · VELA</div><p className="text-sm font-semibold leading-snug">{approved ? "Audience selected: teachers. VELA can ship the landing page." : active.blocker ?? "Pick a contestant to review their next move."}</p></div>
            <button onClick={() => { setApproved((value) => !value); notify(approved ? "Decision reopened for host" : "Decision sent to VELA"); }} className={`mt-3 flex w-full items-center justify-center gap-2 px-3 py-3 text-[10px] font-black uppercase tracking-[0.14em] ${approved ? "bg-[#53d6c7] text-[#18312d]" : "bg-[#302b37] text-[#fff7ec]"}`}><Check size={14} /> {approved ? "decision sent" : "approve audience: teachers"}</button>
            <div className="mt-5 border-t border-[#d8cdbd] pt-4"><div className="mb-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.13em] text-[#867968]"><span>challenge progress</span><span className="text-[#302b37]">day {day} / 21</span></div><div className="h-2 bg-[#dcc9b2]"><div className="h-full w-[57%] bg-[#d05449]" /></div><div className="mt-2 flex justify-between text-[10px] text-[#867968]"><span>brief</span><span>proof</span><span>showdown</span></div></div>
            <div className="mt-5 grid grid-cols-2 gap-2"><button onClick={() => { setDay((value) => Math.min(21, value + 1)); notify(`Advanced to day ${Math.min(21, day + 1)}`); }} className="border border-[#d8cdbd] bg-[#fff7ec] p-3 text-left text-[10px] font-bold uppercase tracking-[0.1em] hover:border-[#d05449]"><ChevronRight size={15} className="mb-2 text-[#d05449]" /> next day</button><button onClick={() => notify("Host cue is ready") } className="border border-[#d8cdbd] bg-[#fff7ec] p-3 text-left text-[10px] font-bold uppercase tracking-[0.1em] hover:border-[#3b9187]"><Radio size={15} className="mb-2 text-[#3b9187]" /> cue host</button></div>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_350px]">
          <Card className="p-5">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><Label tone="teal"><Activity size={13} /> output signals</Label><h2 className="font-['Space_Grotesk'] text-2xl font-black tracking-[-0.05em]">Who is making something real?</h2></div><div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[#867968]"><Coins size={14} className="text-[#d05449]" /> ${totalRevenue.toLocaleString()} validated revenue</div></div>
            <div className="space-y-2">{contestants.map((person) => { const palette = colors[person.tone]; return <button key={person.name} onClick={() => setSelected(person.name)} className={`grid w-full gap-3 border p-3 text-left sm:grid-cols-[120px_minmax(0,1fr)_115px] sm:items-center ${selected === person.name ? "border-[#302b37] bg-[#fff7ec]" : "border-[#d8cdbd] bg-[#f6eadb] hover:border-[#a88f73]"}`}><div className="flex items-center gap-3"><Avatar contestant={person} active={false} /><div><div className="font-['Space_Grotesk'] text-lg font-black">{person.name}</div><div className="text-[9px] font-bold uppercase tracking-[0.1em]" style={{ color: palette.ink }}>{person.idea}</div></div></div><div><div className="mb-1 flex justify-between text-[10px] text-[#75695f]"><span>{person.activity}</span><span className="font-mono text-[#302b37]">{person.progress}%</span></div><div className="h-1.5 bg-[#d9c5ab]"><div className="h-full" style={{ width: `${person.progress}%`, background: palette.fill }} /></div></div><div className="text-right"><div className="font-mono text-lg font-bold">${person.revenue.toLocaleString()}</div><div className="text-[9px] font-bold uppercase tracking-[0.1em] text-[#867968]">of ${person.target.toLocaleString()}</div></div></button>; })}</div>
          </Card>
          <Card className="p-5">
            <div className="mb-4 flex items-center justify-between"><div><Label tone={active.tone}><Bot size={13} /> selected workstation</Label><h2 className="font-['Space_Grotesk'] text-2xl font-black">{active.name}</h2></div><div className="text-right"><Trophy size={18} style={{ color: activeColor.ink }} /><div className="text-[9px] font-bold uppercase tracking-[0.1em] text-[#867968]">trajectory #{active.name === "ORBIT" ? "1" : active.name === "NOVA" ? "2" : active.name === "MICA" ? "3" : "4"}</div></div></div>
            <p className="border-l-2 pl-3 text-sm leading-relaxed text-[#645b57]" style={{ borderColor: activeColor.ink }}><strong className="text-[#302b37]">{active.role}.</strong> {active.activity}.</p>
            <div className="mt-4"><div className="mb-2 flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.14em] text-[#867968]"><Sparkles size={12} style={{ color: activeColor.ink }} /> skills</div><div className="flex flex-wrap gap-1.5">{active.skills.map((skill) => <span key={skill} className="border px-2 py-1 text-[9px] font-bold uppercase tracking-[0.09em]" style={{ color: activeColor.ink, borderColor: activeColor.line, background: activeColor.soft }}>{skill}</span>)}</div></div>
            <div className="mt-4"><div className="mb-2 flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.14em] text-[#867968]"><Wrench size={12} style={{ color: activeColor.ink }} /> tool loadout</div><div className="flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold">{active.tools.map((tool) => <span key={tool} className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full" style={{ background: activeColor.ink }} />{tool}</span>)}</div></div>
            {active.blocker && <div className="mt-4 flex items-start gap-2 border border-[#a84c45] bg-[#f2d6cf] p-3 text-xs"><CircleAlert size={15} className="mt-0.5 shrink-0 text-[#b4473e]" /><span><strong>Blocked:</strong> {approved && active.name === "VELA" ? "decision cleared — ready to build" : active.blocker}</span></div>}
          </Card>
        </div>
        <footer className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#b9a896] py-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[#867968]"><span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#53d6c7]" /> outputs only · private reasoning stays private</span><span className="flex items-center gap-2"><Clock3 size={13} /> {notice}</span><div className="flex items-center gap-2"><input value={announcement} onChange={(event) => setAnnouncement(event.target.value)} placeholder="quick host note" className="w-32 border-b border-[#b9a896] bg-transparent py-1 text-[10px] outline-none placeholder:text-[#9c8d7d]" /><button onClick={() => { if (announcement.trim()) { notify("Host note pinned to the floor"); setAnnouncement(""); } }} aria-label="Send host note" className="text-[#d05449]"><Send size={14} /></button><button onClick={() => notify("Floor guide opened")} aria-label="Open floor guide" className="text-[#867968]"><Hammer size={14} /></button></div></footer>
      </div>
    </main>
  );
}

export default BuildOffHouse;