import { useMemo, useState } from "react";
import {
  Activity,
  ArrowRight,
  Bot,
  BrainCircuit,
  CircleHelp,
  Command,
  Crosshair,
  GitBranch,
  LayoutDashboard,
  MessageSquare,
  MoreHorizontal,
  Play,
  Plus,
  Radio,
  Send,
} from "lucide-react";

type Task = { id: number; title: string; project: string; agent: string; tone: string };
type Lane = "queued" | "active" | "review";

const seedTasks: Record<Lane, Task[]> = {
  queued: [
    { id: 1, title: "Map onboarding friction", project: "Lumen / growth", agent: "NOVA", tone: "cyan" },
    { id: 2, title: "Write pricing experiment", project: "Kite / revenue", agent: "MICA", tone: "pink" },
    { id: 3, title: "Wire webhook retries", project: "Relay / infra", agent: "ORBIT", tone: "lime" },
  ],
  active: [
    { id: 4, title: "Ship the invite flow", project: "Lumen / product", agent: "NOVA", tone: "cyan" },
    { id: 5, title: "Audit creator payouts", project: "Kite / finance", agent: "MICA", tone: "pink" },
  ],
  review: [
    { id: 6, title: "Release notes v0.8.4", project: "Relay / infra", agent: "ORBIT", tone: "lime" },
  ],
};

const projects = [
  { name: "Lumen", desc: "AI onboarding for indie teams", color: "#65e5ff", progress: 78, income: "$3,840", status: "shipping" },
  { name: "Kite", desc: "Creator revenue command layer", color: "#ff71c8", progress: 46, income: "$1,260", status: "needs review" },
  { name: "Relay", desc: "Quiet infrastructure for loud ideas", color: "#c6ff4a", progress: 64, income: "$920", status: "stable" },
];

function Badge({ children, tone = "cyan" }: { children: React.ReactNode; tone?: "cyan" | "pink" | "lime" | "amber" }) {
  const styles = { cyan: "border-cyan-300/40 text-cyan-200 bg-cyan-300/10", pink: "border-pink-300/40 text-pink-200 bg-pink-300/10", lime: "border-lime-300/40 text-lime-200 bg-lime-300/10", amber: "border-amber-300/40 text-amber-200 bg-amber-300/10" };
  return <span className={`inline-flex items-center gap-1 border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[.16em] ${styles[tone]}`}>{children}</span>;
}

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`relative border border-[#293747] bg-[#111a25]/95 shadow-[8px_8px_0_#090e15] ${className}`}>{children}</section>;
}

function SectionTitle({ icon: Icon, eyebrow, title, action }: { icon: React.ElementType; eyebrow: string; title: string; action?: React.ReactNode }) {
  return <div className="mb-4 flex items-end justify-between border-b border-[#293747] pb-3"><div><div className="mb-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.22em] text-[#65e5ff]"><Icon size={13} />{eyebrow}</div><h2 className="font-['Space_Grotesk'] text-lg font-bold tracking-tight text-[#f4f7f9]">{title}</h2></div>{action}</div>;
}

export function MissionControl() {
  const [tab, setTab] = useState("overview");
  const [tasks, setTasks] = useState(seedTasks);
  const [simRunning, setSimRunning] = useState(false);
  const [round, setRound] = useState(3);
  const [message, setMessage] = useState("");
  const [toast, setToast] = useState("System nominal · last sync 14 sec ago");
  const [expanded, setExpanded] = useState<number | null>(null);
  const totalActive = useMemo(() => tasks.active.length, [tasks]);

  const notify = (text: string) => { setToast(text); window.setTimeout(() => setToast("System nominal · last sync 14 sec ago"), 2600); };
  const advanceTask = (id: number, from: Lane, to: Lane) => {
    const item = tasks[from].find((task) => task.id === id);
    if (!item) return;
    setTasks({ ...tasks, [from]: tasks[from].filter((task) => task.id !== id), [to]: [...tasks[to], item] });
    notify(`${item.title} moved to ${to}`);
  };
  const sendMessage = () => { if (message.trim()) { notify("NOVA received your directive"); setMessage(""); } };

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#080d14] text-[#dce8ee] selection:bg-[#ff71c8] selection:text-[#080d14]">
      <style>{`
        @keyframes pulseDot { 0%,100%{opacity:1} 50%{opacity:.35} }
        @keyframes scan { from{transform:translateY(-100%)} to{transform:translateY(100vh)} }
        .mc-grid{background-image:linear-gradient(rgba(101,229,255,.045) 1px,transparent 1px),linear-gradient(90deg,rgba(101,229,255,.045) 1px,transparent 1px);background-size:32px 32px}
        .mc-scan:after{content:"";position:absolute;inset:0;background:linear-gradient(transparent,rgba(101,229,255,.05),transparent);height:18%;animation:scan 7s linear infinite;pointer-events:none}
      `}</style>
      <div className="mc-grid mc-scan pointer-events-none fixed inset-0 opacity-70" />
      <div className="relative mx-auto max-w-[1600px] px-4 py-4 md:px-7">
        <header className="mb-5 flex flex-wrap items-center justify-between gap-4 border-b border-[#293747] pb-4">
          <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center bg-[#ff71c8] text-[#080d14] shadow-[4px_4px_0_#65e5ff]"><Command size={22} strokeWidth={3} /></div><div><div className="font-['Space_Grotesk'] text-xl font-bold tracking-[-.06em] text-white">MISSION<span className="text-[#ff71c8]">/</span>CONTROL</div><div className="font-mono text-[9px] uppercase tracking-[.2em] text-[#718597]">fleet operating system · workspace 07</div></div></div>
          <nav className="flex items-center gap-1 overflow-x-auto">{["overview", "projects", "agents", "skills"].map((item) => <button key={item} onClick={() => setTab(item)} className={`whitespace-nowrap border-b-2 px-3 py-2 text-[10px] font-bold uppercase tracking-[.18em] transition ${tab === item ? "border-[#ff71c8] text-white" : "border-transparent text-[#718597] hover:text-[#dce8ee]"}`}>{item}</button>)}</nav>
          <div className="flex items-center gap-3"><Badge tone="lime"><span className="h-1.5 w-1.5 animate-[pulseDot_1.5s_infinite] rounded-full bg-lime-300" />fleet online</Badge><button onClick={() => notify("Command palette opened")} className="border border-[#293747] p-2 text-[#718597] hover:border-[#65e5ff] hover:text-[#65e5ff]"><CircleHelp size={15} /></button><div className="grid h-8 w-8 place-items-center border border-[#ff71c8] text-xs font-bold text-[#ff71c8]">JR</div></div>
        </header>

        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-l-2 border-[#ff71c8] bg-[#111a25] px-4 py-3">
          <div><div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.2em] text-[#ff71c8]"><Crosshair size={13} />What should I do now?</div><p className="mt-1 text-sm text-[#dce8ee]">Review Kite's payout audit before NOVA ships the Lumen invite flow.</p></div><button onClick={() => { setTab("projects"); notify("Opening Kite review queue"); }} className="flex items-center gap-2 bg-[#ff71c8] px-3 py-2 text-[10px] font-bold uppercase tracking-[.15em] text-[#080d14] hover:bg-[#ffa1d9]">Open review queue <ArrowRight size={14} /></button>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          {[["$6,020", "monthly income", "cash earned across live projects", "lime"], ["18.4 d", "runway", "days until compute budget needs attention", "pink"], ["+27%", "velocity", "work completed versus last 7 days", "cyan"], [`${totalActive} / 6`, "agents working", "active tasks right now, not total agents", "amber"]].map(([value, label, help, tone]) => <Panel key={label} className="p-4"><div className={`font-['Space_Grotesk'] text-2xl font-bold ${tone === "lime" ? "text-[#c6ff4a]" : tone === "pink" ? "text-[#ff71c8]" : tone === "amber" ? "text-[#ffd166]" : "text-[#65e5ff]"}`}>{value}</div><div className="mt-1 text-[10px] font-bold uppercase tracking-[.18em] text-white">{label}</div><div className="mt-2 text-[11px] leading-snug text-[#718597]">{help}</div></Panel>)}
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.25fr_.75fr]">
          <div className="space-y-5">
            <Panel className="p-5"><SectionTitle icon={MessageSquare} eyebrow="01 · command channel" title="Talk to NOVA, your lead agent" action={<Badge>context: all projects</Badge>} /><div className="mb-4 grid gap-3 sm:grid-cols-[auto_1fr]"><div className="grid h-11 w-11 place-items-center border border-[#65e5ff] bg-[#65e5ff]/10 text-[#65e5ff]"><Bot size={22} /></div><div className="border-l-2 border-[#65e5ff] bg-[#0b131d] px-4 py-3"><div className="mb-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.18em] text-[#65e5ff]">NOVA <span className="text-[#718597]">· lead orchestration</span></div><p className="text-sm leading-relaxed text-[#dce8ee]">Kite is the only project with a blocked revenue path. I can prepare a payout review brief while the other agents keep shipping.</p><button onClick={() => notify("NOVA is preparing the payout brief")} className="mt-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.16em] text-[#ff71c8] hover:text-white">Prepare brief <ArrowRight size={13} /></button></div></div><div className="flex gap-2"><input value={message} onChange={(e) => setMessage(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendMessage()} placeholder="Give NOVA a directive..." className="min-w-0 flex-1 border border-[#293747] bg-[#0b131d] px-3 py-3 text-sm text-white outline-none placeholder:text-[#536675] focus:border-[#65e5ff]" /><button onClick={sendMessage} className="grid w-12 place-items-center bg-[#65e5ff] text-[#080d14] hover:bg-white"><Send size={16} /></button></div></Panel>

            <Panel className="p-5"><SectionTitle icon={GitBranch} eyebrow="02 · flow state" title="Work queue, in plain sight" action={<button onClick={() => notify("New task composer opened")} className="flex items-center gap-1 border border-[#293747] px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#65e5ff]"><Plus size={13} /> task</button>} /><div className="grid gap-3 md:grid-cols-3">{(["queued", "active", "review"] as Lane[]).map((lane) => <div key={lane} className="min-h-[190px] bg-[#0b131d] p-3"><div className="mb-3 flex items-center justify-between"><span className="text-[10px] font-bold uppercase tracking-[.18em] text-[#a9bac5]">{lane}</span><span className="font-mono text-[10px] text-[#536675]">{tasks[lane].length.toString().padStart(2, "0")}</span></div>{tasks[lane].map((task) => <div key={task.id} onClick={() => setExpanded(expanded === task.id ? null : task.id)} className="mb-2 cursor-pointer border border-[#293747] bg-[#111a25] p-3 hover:border-[#65e5ff]"><div className="text-xs font-bold text-[#f4f7f9]">{task.title}</div><div className="mt-2 flex items-center justify-between text-[10px] text-[#718597]"><span>{task.project}</span><Badge tone={task.tone as "cyan" | "pink" | "lime"}>{task.agent}</Badge></div>{expanded === task.id && <div className="mt-3 border-t border-[#293747] pt-2 text-[10px] text-[#a9bac5]">{lane === "review" ? "Ready for your approval." : lane === "active" ? "Agent is actively producing output." : "Waiting for an agent slot."}<div className="mt-2 flex gap-2">{lane !== "active" && <button onClick={(e) => { e.stopPropagation(); advanceTask(task.id, lane, "active"); }} className="text-[#65e5ff] underline">Start task</button>}{lane === "active" && <button onClick={(e) => { e.stopPropagation(); advanceTask(task.id, lane, "review"); }} className="text-[#c6ff4a] underline">Send to review</button>}</div></div>}</div>)}</div>)}</div></Panel>
          </div>

          <div className="space-y-5">
            <Panel className="p-5"><SectionTitle icon={Radio} eyebrow="03 · live arena" title="Agent game show" action={<Badge tone="pink">round {round} / 5</Badge>} /><div className="mb-4 border border-[#ff71c8]/40 bg-[#ff71c8]/5 p-4"><div className="flex items-center justify-between"><div><div className="font-['Space_Grotesk'] text-2xl font-bold text-white">BUILD<span className="text-[#ff71c8]">OFF</span></div><p className="mt-1 text-xs text-[#a9bac5]">Agents race to turn a brief into revenue. Highest quality shipped output wins.</p></div><div className="font-mono text-3xl font-bold text-[#ff71c8]">{simRunning ? "02:41" : "— —"}</div></div><div className="mt-4 h-2 bg-[#293747]"><div className="h-full bg-[#ff71c8] transition-all" style={{ width: `${round * 20}%` }} /></div><div className="mt-2 flex justify-between font-mono text-[9px] uppercase text-[#718597]"><span>brief → build → demo → income</span><span>win condition: first $500</span></div></div><div className="space-y-2">{[["NOVA", "$420", "82 pts", "cyan"], ["MICA", "$310", "74 pts", "pink"], ["ORBIT", "$180", "61 pts", "lime"]].map(([name, income, score, tone], i) => <div key={name} className="flex items-center gap-3 border-b border-[#293747] pb-2"><span className={`font-mono text-xs ${i === 0 ? "text-[#ffd166]" : "text-[#718597]"}`}>0{i + 1}</span><div className="h-6 w-6 border border-[#293747] grid place-items-center"><Bot size={13} /></div><span className="flex-1 text-xs font-bold text-white">{name}</span><span className="font-mono text-xs text-[#c6ff4a]">{income}</span><span className={`font-mono text-[10px] ${tone === "cyan" ? "text-[#65e5ff]" : tone === "pink" ? "text-[#ff71c8]" : "text-[#c6ff4a]"}`}>{score}</span></div>)}</div><button onClick={() => { setSimRunning(!simRunning); notify(simRunning ? "Buildoff paused" : "Buildoff live — agents are racing"); }} className={`mt-4 flex w-full items-center justify-center gap-2 py-3 text-[10px] font-bold uppercase tracking-[.2em] ${simRunning ? "bg-[#293747] text-[#ff71c8]" : "bg-[#ff71c8] text-[#080d14]"}`}>{simRunning ? "Pause live round" : "Start live round"} <Play size={13} /></button><button onClick={() => setRound(round === 5 ? 1 : round + 1)} className="mt-2 w-full py-2 text-[10px] uppercase tracking-widest text-[#718597] hover:text-white">Advance round manually</button></Panel>

            <Panel className="p-5"><SectionTitle icon={BrainCircuit} eyebrow="04 · skill repository" title="Equip a new agent" action={<button onClick={() => notify("Skill library opened")} className="text-[#65e5ff]"><MoreHorizontal size={17} /></button>} /><p className="mb-3 text-xs leading-relaxed text-[#a9bac5]">Skills are repeatable behaviors. Add a pack before you spawn so agents start useful, not empty.</p><div className="grid grid-cols-2 gap-2">{[["Product sense", "12 skills", "cyan"], ["Revenue ops", "08 skills", "pink"], ["Full-stack", "24 skills", "lime"], ["QA instincts", "06 skills", "amber"]].map(([name, count, tone]) => <button key={name} onClick={() => notify(`${name} pack selected`)} className="border border-[#293747] p-3 text-left hover:border-[#65e5ff]"><div className="mb-2 h-1 w-8" style={{ background: tone === "cyan" ? "#65e5ff" : tone === "pink" ? "#ff71c8" : tone === "lime" ? "#c6ff4a" : "#ffd166" }} /><div className="text-xs font-bold text-white">{name}</div><div className="mt-1 font-mono text-[10px] text-[#718597]">{count}</div></button>)}</div><button onClick={() => notify("Agent creation flow ready")} className="mt-3 flex w-full items-center justify-center gap-2 border border-[#65e5ff] py-2 text-[10px] font-bold uppercase tracking-[.18em] text-[#65e5ff] hover:bg-[#65e5ff] hover:text-[#080d14]"><Plus size={14} /> create agent from skills</button></Panel>
          </div>
        </div>

        <Panel className="mt-5 p-5"><SectionTitle icon={LayoutDashboard} eyebrow="05 · portfolio radar" title="Projects at a glance" action={<button onClick={() => notify("Project creation flow ready")} className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-[#65e5ff]"><Plus size={13} /> new project</button>} /><div className="grid gap-3 md:grid-cols-3">{projects.map((project) => <div key={project.name} className="border border-[#293747] bg-[#0b131d] p-4"><div className="mb-3 flex items-start justify-between"><div><div className="flex items-center gap-2 text-lg font-bold text-white"><span className="h-2 w-2" style={{ background: project.color }} />{project.name}</div><div className="mt-1 text-xs text-[#718597]">{project.desc}</div></div><Badge tone={project.status === "needs review" ? "pink" : project.status === "shipping" ? "cyan" : "lime"}>{project.status}</Badge></div><div className="mb-2 flex justify-between text-[10px] uppercase tracking-widest text-[#718597]"><span>delivery confidence</span><span className="font-mono text-white">{project.progress}%</span></div><div className="h-1 bg-[#293747]"><div className="h-full" style={{ width: `${project.progress}%`, background: project.color }} /></div><div className="mt-4 flex items-center justify-between border-t border-[#293747] pt-3"><span className="text-[10px] uppercase tracking-widest text-[#718597]">income this month</span><span className="font-mono text-sm text-[#c6ff4a]">{project.income}</span></div></div>)}</div></Panel>

        <footer className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#293747] py-4 text-[10px] uppercase tracking-[.15em] text-[#536675]"><div className="flex items-center gap-3"><span className="flex items-center gap-1.5"><span className="h-2 w-2 bg-[#c6ff4a]" /> online / working</span><span className="flex items-center gap-1.5"><span className="h-2 w-2 bg-[#ff71c8]" /> needs your review</span><span className="flex items-center gap-1.5"><span className="h-2 w-2 bg-[#ffd166]" /> waiting / queued</span></div><div className="flex items-center gap-3"><Activity size={13} /> {toast}</div></footer>
      </div>
    </div>
  );
}

export default MissionControl;