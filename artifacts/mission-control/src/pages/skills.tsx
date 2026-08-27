import {
  getListAgentCapabilitiesQueryKey,
  getListAgentsQueryKey,
  getListSkillsQueryKey,
  useCreateSkill,
  useEquipAgentSkill,
  useListAgents,
  useListSkills,
  useRefreshSkillCatalog,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AlertTriangle, Check, ExternalLink, Filter, Link as LinkIcon, Loader2, RefreshCw, Search, ShieldCheck, UserRound, Zap } from "lucide-react";
import { Link } from "wouter";
import { BrutalBadge, BrutalButton, BrutalCard } from "../components/ui/brutal";

type LooseSkill = Record<string, any>;
const asList = (value: unknown): LooseSkill[] => (Array.isArray(value) ? value : []);
const messageFor = (error: unknown, fallback: string) =>
  error && typeof error === "object" && "message" in error ? String((error as { message?: unknown }).message || fallback) : fallback;

function riskVariant(risk: string): "primary" | "secondary" | "accent" | "destructive" | "default" {
  if (risk === "low") return "primary";
  if (risk === "medium") return "secondary";
  if (risk === "high") return "destructive";
  return "default";
}

export function Skills() {
  const queryClient = useQueryClient();
  const skillsQuery = useListSkills({ query: { queryKey: getListSkillsQueryKey(), refetchOnMount: "always" } });
  const agentsQuery = useListAgents({ query: { queryKey: getListAgentsQueryKey(), refetchInterval: 15000 } });
  const createSkill = useCreateSkill({
    mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListSkillsQueryKey() }) },
  });
  const refreshCatalog = useRefreshSkillCatalog({
    mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListSkillsQueryKey() }) },
  });
  const equipSkill = useEquipAgentSkill();
  const [showNew, setShowNew] = useState(false);
  const [query, setQuery] = useState("");
  const [runtime, setRuntime] = useState("all");
  const [source, setSource] = useState("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [agentId, setAgentId] = useState("");
  const [newSkill, setNewSkill] = useState({ name: "", description: "", category: "" });

  const skills = asList(skillsQuery.data);
  const agents = asList(agentsQuery.data);
  const filteredSkills = useMemo(() => skills.filter((skill) => {
    const haystack = `${skill.name} ${skill.description} ${skill.category} ${skill.sourceName}`.toLowerCase();
    const matchesQuery = !query.trim() || haystack.includes(query.trim().toLowerCase());
    const matchesRuntime = runtime === "all" || skill.compatibleRuntimes?.some((item: string) => item.toLowerCase() === runtime);
    const matchesSource = source === "all" || skill.sourceKind === source;
    return matchesQuery && matchesRuntime && matchesSource;
  }), [query, runtime, skills, source]);
  const selectedSkill = skills.find((skill) => skill.id === selectedId) ?? filteredSkills[0];

  const handleCreate = () => {
    if (!newSkill.name.trim() || !newSkill.description.trim() || !newSkill.category.trim()) return;
    createSkill.mutate({ data: { name: newSkill.name.trim(), description: newSkill.description.trim(), category: newSkill.category.trim() } });
    setShowNew(false);
    setNewSkill({ name: "", description: "", category: "" });
  };

  const equip = () => {
    if (!selectedSkill || !agentId) return;
    equipSkill.mutate({ agentId: Number(agentId), skillId: selectedSkill.id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAgentCapabilitiesQueryKey(Number(agentId)) });
        queryClient.invalidateQueries({ queryKey: getListAgentsQueryKey() });
      },
    });
  };

  if (skillsQuery.isLoading || agentsQuery.isLoading) {
    return <div className="p-8 font-mono font-bold animate-pulse text-2xl uppercase">Downloading trusted skill catalog...</div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div className="max-w-3xl">
          <div className="mb-2 flex items-center gap-2 font-mono text-xs font-black uppercase tracking-widest text-primary"><ShieldCheck size={14} /> trusted capability catalog</div>
          <h1 className="text-4xl font-black uppercase tracking-tighter md:text-5xl">Skill Repository</h1>
          <p className="mt-2 font-mono text-lg text-muted-foreground">Discover approved Hermes and OpenClaw skills, inspect their safety boundary, then equip a staff member without silently running third-party code.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <BrutalButton data-testid="refresh-skill-catalog" variant="outline" disabled={refreshCatalog.isPending} onClick={() => refreshCatalog.mutate()}>
            {refreshCatalog.isPending ? <Loader2 size={17} className="animate-spin" /> : <RefreshCw size={17} />} Refresh catalogs
          </BrutalButton>
          <BrutalButton onClick={() => setShowNew(!showNew)} className="flex items-center gap-2"><Zap size={18} /> Compile local skill</BrutalButton>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="border-4 border-primary bg-primary/10 p-4 shadow-[4px_4px_0px_0px_hsl(var(--primary))]"><div className="font-mono text-xs font-black uppercase text-muted-foreground">Visible packs</div><div className="mt-1 font-mono text-3xl font-black">{filteredSkills.length}</div></div>
        <div className="border-4 border-accent bg-accent/10 p-4 shadow-[4px_4px_0px_0px_hsl(var(--accent))]"><div className="font-mono text-xs font-black uppercase text-muted-foreground">Trusted sources</div><div className="mt-1 font-mono text-3xl font-black">{new Set(skills.filter((skill) => skill.sourceKind === "catalog").map((skill) => skill.sourceName)).size}</div></div>
        <div className="border-4 border-border bg-muted/40 p-4"><div className="font-mono text-xs font-black uppercase text-muted-foreground">Approval-gated</div><div className="mt-1 font-mono text-3xl font-black">{skills.filter((skill) => skill.requiresApproval).length}</div></div>
      </div>

      {refreshCatalog.data && (
        <div className="border-4 border-primary bg-primary/10 p-4 font-mono text-sm">
          <div className="flex items-center gap-2 font-black uppercase"><Check size={17} /> Catalog refresh complete</div>
          <p className="mt-1">{refreshCatalog.data.imported} new, {refreshCatalog.data.updated} updated, {refreshCatalog.data.skipped} unchanged.</p>
          {refreshCatalog.data.errors?.map((error: string) => <p key={error} className="mt-2 flex items-center gap-2 text-destructive"><AlertTriangle size={15} /> {error}</p>)}
        </div>
      )}
      {refreshCatalog.isError && <div className="border-4 border-destructive bg-destructive/10 p-3 font-mono text-sm text-destructive"><AlertTriangle className="mr-2 inline" size={16} />{messageFor(refreshCatalog.error, "The approved catalogs could not be refreshed. Existing entries were kept.")}</div>}

      <div className="border-4 border-accent bg-accent/10 p-4 shadow-[4px_4px_0px_0px_hsl(var(--accent))] flex items-center gap-4 font-mono font-bold text-sm">
        <LinkIcon className="shrink-0 text-accent" />
        <p>Local assignment and remote installation are tracked separately. Skills with external side effects pause at <Link href="/approvals" className="underline text-accent hover:text-foreground">human approval</Link>; Mission Control never executes imported code.</p>
      </div>

      {showNew && (
        <BrutalCard title="Compile Local Skill Pack" className="bg-accent/10 border-dashed border-accent">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <label className="block text-sm font-bold uppercase">Skill name<input className="mt-2 w-full border-4 border-border bg-card p-3 font-mono normal-case focus:outline-none focus:ring-4 focus:ring-accent/20" value={newSkill.name} onChange={(event) => setNewSkill({ ...newSkill, name: event.target.value })} placeholder="e.g. TailwindCSS Mastery" /></label>
            <label className="block text-sm font-bold uppercase">Category<input className="mt-2 w-full border-4 border-border bg-card p-3 font-mono normal-case focus:outline-none focus:ring-4 focus:ring-accent/20" value={newSkill.category} onChange={(event) => setNewSkill({ ...newSkill, category: event.target.value })} placeholder="e.g. Frontend" /></label>
            <label className="block text-sm font-bold uppercase md:col-span-3">Purpose<textarea className="mt-2 w-full border-4 border-border bg-card p-3 font-mono normal-case focus:outline-none focus:ring-4 focus:ring-accent/20" rows={3} value={newSkill.description} onChange={(event) => setNewSkill({ ...newSkill, description: event.target.value })} placeholder="Explain what the agent can do once equipped..." /></label>
          </div>
          <div className="mt-6 flex gap-3"><BrutalButton onClick={handleCreate} variant="secondary" disabled={createSkill.isPending || !newSkill.name || !newSkill.description || !newSkill.category}>{createSkill.isPending ? "Compiling..." : "Compile & store"}</BrutalButton><BrutalButton variant="default" onClick={() => setShowNew(false)}>Cancel</BrutalButton></div>
          {createSkill.isError && <p className="mt-3 font-mono text-xs text-destructive">{messageFor(createSkill.error, "Could not save the local skill.")}</p>}
        </BrutalCard>
      )}

      <div className="flex flex-col gap-3 border-4 border-border bg-card p-4 md:flex-row">
        <label className="relative min-w-0 flex-1"><Search className="absolute left-3 top-3 text-muted-foreground" size={17} /><input data-testid="skill-search" className="w-full border-4 border-border bg-background p-2 pl-10 font-mono focus:outline-none focus:ring-4 focus:ring-primary/20" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search purpose, category, or source..." /></label>
        <label className="flex items-center gap-2 font-mono text-xs font-black uppercase"><Filter size={15} /> Runtime<select data-testid="skill-runtime-filter" className="border-4 border-border bg-background p-2 font-mono text-xs" value={runtime} onChange={(event) => setRuntime(event.target.value)}><option value="all">All runtimes</option><option value="hermes">Hermes</option><option value="openclaw">OpenClaw</option></select></label>
        <label className="font-mono text-xs font-black uppercase">Source<select data-testid="skill-source-filter" className="ml-2 border-4 border-border bg-background p-2 font-mono text-xs" value={source} onChange={(event) => setSource(event.target.value)}><option value="all">All sources</option><option value="catalog">Trusted catalogs</option><option value="custom">Local only</option></select></label>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,.65fr)]">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {filteredSkills.map((skill) => (
            <button type="button" key={skill.id} onClick={() => setSelectedId(skill.id)} className={`text-left ${selectedSkill?.id === skill.id ? "ring-4 ring-primary" : ""}`}>
              <BrutalCard className="h-full">
                <div className="flex items-start justify-between gap-3"><h2 className="font-black text-xl uppercase tracking-tight">{skill.name}</h2><BrutalBadge variant={skill.importState === "imported" || skill.sourceKind === "custom" ? "accent" : "destructive"}>{skill.importState === "imported" ? "IMPORTED" : skill.sourceKind === "custom" ? "LOCAL" : skill.importState}</BrutalBadge></div>
                <div className="mt-3 flex flex-wrap gap-2"><BrutalBadge variant="default">{skill.category}</BrutalBadge>{skill.compatibleRuntimes?.map((item: string) => <BrutalBadge key={item} variant="primary">{item}</BrutalBadge>)}</div>
                <p className="mt-4 line-clamp-3 border-4 border-border bg-muted/30 p-3 font-mono text-sm text-foreground/80">{skill.description}</p>
                <div className="mt-4 flex items-center justify-between border-t-2 border-border pt-3 font-mono text-xs text-muted-foreground"><span>{skill.sourceName}</span>{skill.requiresApproval && <span className="flex items-center gap-1 text-destructive"><AlertTriangle size={13} /> approval</span>}</div>
              </BrutalCard>
            </button>
          ))}
          {filteredSkills.length === 0 && <div className="col-span-full border-4 border-dashed border-border p-12 text-center font-mono font-bold text-muted-foreground">NO TRUSTED SKILLS MATCH THIS FILTER.</div>}
        </div>

        {selectedSkill && (
          <BrutalCard title={<span className="flex items-center gap-2"><UserRound size={18} /> Equip a staff member</span>} className="h-fit border-primary">
            <div className="border-b-4 border-border pb-4"><div className="flex items-start justify-between gap-3"><h2 className="text-2xl font-black uppercase">{selectedSkill.name}</h2><BrutalBadge variant={riskVariant(selectedSkill.sideEffectRisk)}>{selectedSkill.sideEffectRisk} risk</BrutalBadge></div><p className="mt-3 font-mono text-sm leading-relaxed">{selectedSkill.description}</p></div>
            <div className="space-y-3 py-4 font-mono text-xs"><div><span className="font-black uppercase text-muted-foreground">Source</span><div className="mt-1 flex items-center gap-2 font-bold">{selectedSkill.sourceName}{selectedSkill.sourceUrl && <a href={selectedSkill.sourceUrl} target="_blank" rel="noreferrer" className="text-primary underline" onClick={(event) => event.stopPropagation()}>Inspect repository <ExternalLink size={13} /></a>}</div></div><div><span className="font-black uppercase text-muted-foreground">Compatibility</span><div className="mt-1 font-bold">{selectedSkill.compatibleRuntimes?.join(" / ") || "Local assignment only"}</div></div><div><span className="font-black uppercase text-muted-foreground">Installation boundary</span><div className="mt-1 font-bold">{selectedSkill.requiresApproval || selectedSkill.sideEffectRisk === "unknown" ? "Human approval required before remote installation." : selectedSkill.installMethod === "manual" ? "Manual installation requires approval." : selectedSkill.installMethod}</div></div></div>
            <label className="block border-t-4 border-border pt-4 text-xs font-black uppercase">Equip to<select data-testid="equip-agent-select" className="mt-2 w-full border-4 border-border bg-background p-2 font-mono text-sm" value={agentId} onChange={(event) => setAgentId(event.target.value)}><option value="">-- SELECT STAFF MEMBER --</option>{agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name} // {agent.provider}</option>)}</select></label>
            <BrutalButton data-testid="equip-skill-button" className="mt-4 w-full" disabled={!agentId || equipSkill.isPending} onClick={equip}>{equipSkill.isPending ? <><Loader2 size={16} className="animate-spin" /> Equipping...</> : <><Zap size={16} /> Equip skill</>}</BrutalButton>
            {equipSkill.data && <div className="mt-4 border-4 border-primary bg-primary/10 p-3 font-mono text-xs"><div className="flex items-center gap-2 font-black uppercase"><Check size={15} /> Local capability equipped</div><p className="mt-2">{equipSkill.data.installation.message}</p><BrutalBadge className="mt-2" variant={equipSkill.data.installation.status === "installed" ? "primary" : equipSkill.data.installation.status === "awaiting_approval" ? "secondary" : equipSkill.data.installation.status === "failed" || equipSkill.data.installation.status === "blocked" ? "destructive" : "default"}>{equipSkill.data.installation.status.replaceAll("_", " ")}</BrutalBadge></div>}
            {equipSkill.isError && <div className="mt-4 border-4 border-destructive bg-destructive/10 p-3 font-mono text-xs text-destructive"><AlertTriangle className="mr-1 inline" size={14} />{messageFor(equipSkill.error, "Could not equip this skill.")}</div>}
          </BrutalCard>
        )}
      </div>
    </div>
  );
}