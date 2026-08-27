import {
  useAttachAgentCapability,
  useCheckRuntimeConnection,
  useCreateAgent,
  useCreateRuntimeConnection,
  useDetachAgentCapability,
  useGetAgentRun,
  useLaunchAgentRun,
  useListAgentActivity,
  useListAgentCapabilities,
  useListAgents,
  useListProjects,
  useListRuntimeConnections,
  useListRuntimeHealth,
  useListSkills,
  usePauseAgentRun,
  useResumeAgentRun,
  useStopAgentRun,
  useUpdateAgent,
  getListAgentCapabilitiesQueryKey,
  getListAgentsQueryKey,
} from "@workspace/api-client-react";
import { BrutalBadge, BrutalButton, BrutalCard } from "../components/ui/brutal";
import { useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  Check,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  Cpu,
  HeartPulse,
  Lightbulb,
  Link2,
  Loader2,
  Monitor,
  Pause,
  Play,
  Plus,
  Radio,
  RefreshCw,
  Server,
  Square,
  Terminal,
  UserPlus,
  Workflow,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";

type LooseRecord = Record<string, any>;

const asList = (value: unknown): LooseRecord[] => (Array.isArray(value) ? value : []);
const messageFor = (error: unknown, fallback: string) =>
  error && typeof error === "object" && "message" in error
    ? String((error as { message?: unknown }).message || fallback)
    : fallback;

function statusVariant(status: string | undefined): "primary" | "secondary" | "accent" | "destructive" | "default" {
  const normalized = status?.toLowerCase();
  if (normalized === "running" || normalized === "working" || normalized === "connected" || normalized === "healthy") return "primary";
  if (normalized === "paused" || normalized === "waiting" || normalized === "idle") return "secondary";
  if (normalized === "failed" || normalized === "blocked" || normalized === "error" || normalized === "offline") return "destructive";
  return "default";
}

function RuntimeLinkPanel() {
  const queryClient = useQueryClient();
  const connectionsQuery = useListRuntimeConnections({ query: { queryKey: ["runtime-connections"], refetchInterval: 15000 } });
  const healthQuery = useListRuntimeHealth({ query: { queryKey: ["runtime-health"], refetchInterval: 10000 } });
  const createConnection = useCreateRuntimeConnection({
    mutation: {
      onSuccess: () => {
        setShowForm(false);
        setForm({ name: "", provider: "", endpointUrl: "", token: "" });
        queryClient.invalidateQueries({ queryKey: connectionsQuery.queryKey });
        queryClient.invalidateQueries({ queryKey: healthQuery.queryKey });
      },
    },
  });
  const checkConnection = useCheckRuntimeConnection({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: connectionsQuery.queryKey });
        queryClient.invalidateQueries({ queryKey: healthQuery.queryKey });
      },
    },
  });
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", provider: "", endpointUrl: "", token: "" });
  const connections = asList(connectionsQuery.data);
  const health = asList(healthQuery.data);
  const isBusy = createConnection.isPending || checkConnection.isPending;

  const submit = () => {
    if (!form.name.trim() || !form.provider || !form.endpointUrl.trim()) return;
    createConnection.mutate({ data: {
      name: form.name.trim(),
      provider: form.provider as "hermes" | "openclaw",
      endpointUrl: form.endpointUrl.trim(),
      token: form.token.trim() || undefined,
    } });
  };

  return (
    <BrutalCard
      title={<span className="flex items-center gap-2"><Link2 size={18} /> Runtime links</span>}
      action={
        <BrutalButton
          data-testid="runtime-add-button"
          variant="outline"
          className="px-2 py-1 text-xs"
          onClick={() => setShowForm((open) => !open)}
        >
          <Plus size={15} /> Add link
        </BrutalButton>
      }
      className="border-primary/70"
    >
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="border-2 border-border bg-primary/10 p-3">
          <div className="flex items-center gap-2 text-xs font-black uppercase text-muted-foreground"><Radio size={14} /> Links</div>
          <div className="mt-1 font-mono text-2xl font-black" data-testid="runtime-connection-count">{connections.length}</div>
        </div>
        <div className="border-2 border-border bg-accent/10 p-3">
          <div className="flex items-center gap-2 text-xs font-black uppercase text-muted-foreground"><HeartPulse size={14} /> Health probes</div>
          <div className="mt-1 font-mono text-2xl font-black">{health.length || "—"}</div>
        </div>
        <div className="border-2 border-border bg-muted/40 p-3">
          <div className="flex items-center gap-2 text-xs font-black uppercase text-muted-foreground"><RefreshCw size={14} /> Refresh</div>
          <div className="mt-1 font-mono text-sm font-black">15 SEC / 10 SEC</div>
        </div>
      </div>

      {connectionsQuery.isLoading && <div className="flex items-center gap-2 border-2 border-dashed border-border p-4 font-mono text-sm"><Loader2 size={16} className="animate-spin" /> Scanning runtime links...</div>}
      {connectionsQuery.isError && (
        <div className="flex items-center justify-between gap-3 border-4 border-destructive bg-destructive/10 p-3 text-sm">
          <span className="flex items-center gap-2 font-mono"><CircleAlert size={16} /> {messageFor(connectionsQuery.error, "Runtime links unavailable.")}</span>
          <BrutalButton data-testid="runtime-retry-button" variant="destructive" className="px-2 py-1 text-xs" onClick={() => connectionsQuery.refetch()}>Retry</BrutalButton>
        </div>
      )}

      {!connectionsQuery.isLoading && !connectionsQuery.isError && connections.length === 0 && (
        <div className="border-2 border-dashed border-border p-5 text-center font-mono text-sm text-muted-foreground">NO RUNTIME LINKS. ADD ONE TO ENABLE LIVE RUNS.</div>
      )}
      <div className="space-y-2">
        {connections.map((connection) => {
          const id = Number(connection.id ?? connection.connectionId);
          const connectionHealth = health.find((item) => Number(item.id) === id);
          const label = String(connection.name ?? connection.provider ?? `LINK-${id}`);
          const state = String(connection.status ?? connectionHealth?.status ?? "unknown");
          return (
            <div key={id || label} className="flex flex-col gap-3 border-4 border-border bg-card p-3 sm:flex-row sm:items-center sm:justify-between" data-testid={`runtime-connection-${id}`}>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Server size={16} className="shrink-0 text-primary" />
                  <span className="truncate font-black uppercase">{label}</span>
                  <BrutalBadge variant={statusVariant(state)}>{state}</BrutalBadge>
                </div>
                <div className="mt-1 truncate font-mono text-xs text-muted-foreground">{connection.provider ?? "provider pending"} // server-side endpoint {connection.hasCredentials ? "// credential stored" : "// no credential"}</div>
              </div>
              <BrutalButton
                data-testid={`runtime-check-${id}`}
                variant="outline"
                className="shrink-0 px-3 py-1 text-xs"
                disabled={isBusy || !id}
                title={!id ? "This connection has no usable identifier." : "Probe this runtime connection"}
                onClick={() => checkConnection.mutate({ connectionId: id })}
              >
                {checkConnection.isPending ? <Loader2 size={14} className="animate-spin" /> : <><Check size={14} /> Check link</>}
              </BrutalButton>
            </div>
          );
        })}
      </div>
      {checkConnection.isError && <div className="mt-3 flex items-center gap-2 border-2 border-destructive bg-destructive/10 p-2 font-mono text-xs text-destructive"><CircleAlert size={14} /> {messageFor(checkConnection.error, "Runtime check failed. The link may be unreachable.")}</div>}

      {showForm && (
        <div className="mt-4 border-4 border-primary bg-primary/5 p-4" data-testid="runtime-connection-form">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="font-black uppercase">Register runtime link</h4>
            <button type="button" className="border-2 border-border p-1 hover:bg-muted" aria-label="Close runtime link form" onClick={() => setShowForm(false)}><X size={16} /></button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {([
              ["name", "Link name", "e.g. studio-primary"],
              ["provider", "Provider", "e.g. openclaw"],
              ["endpointUrl", "Endpoint URL", "https://runtime..."],
              ["token", "Credential", "stored only on server"],
            ] as const).map(([key, label, placeholder]) => (
              <label key={key} className="text-xs font-black uppercase">
                {label}
                <input
                  data-testid={`runtime-input-${key}`}
                  type={key === "token" ? "password" : "text"}
                  value={form[key]}
                  onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))}
                  placeholder={placeholder}
                  className="mt-1 w-full border-4 border-border bg-card p-2 font-mono text-sm font-normal normal-case focus:outline-none focus:ring-4 focus:ring-primary/20"
                />
              </label>
            ))}
          </div>
          {createConnection.isError && <p className="mt-3 border-2 border-destructive bg-destructive/10 p-2 font-mono text-xs text-destructive">{messageFor(createConnection.error, "Could not register runtime link.")}</p>}
          <BrutalButton data-testid="runtime-save-button" className="mt-4" disabled={createConnection.isPending || !form.name.trim() || !form.provider || !form.endpointUrl.trim()} onClick={submit}>
            {createConnection.isPending ? <><Loader2 size={15} className="animate-spin" /> Registering...</> : "Register link"}
          </BrutalButton>
        </div>
      )}
    </BrutalCard>
  );
}

function RunPanel({ agentId, agentName }: { agentId: number; agentName: string }) {
  const queryClient = useQueryClient();
  const runQuery = useGetAgentRun(agentId, { query: { queryKey: ["agent-run", agentId], refetchInterval: 5000 } });
  const activityQuery = useListAgentActivity(agentId, { query: { queryKey: ["agent-activity", agentId], refetchInterval: 5000 } });
  const connectionsQuery = useListRuntimeConnections({ query: { queryKey: ["runtime-connections"], refetchInterval: 15000 } });
  const launchRun = useLaunchAgentRun();
  const pauseRun = usePauseAgentRun();
  const resumeRun = useResumeAgentRun();
  const stopRun = useStopAgentRun();
  const [instruction, setInstruction] = useState("");
  const [connectionId, setConnectionId] = useState("");
  const [showActivity, setShowActivity] = useState(false);
  const run = runQuery.data;
  const events = useMemo(() => activityQuery.data ?? [], [activityQuery.data]);
  const runId = run?.id;
  const runStatus = run?.status ?? "not_running";
  const busy = launchRun.isPending || pauseRun.isPending || resumeRun.isPending || stopRun.isPending;
  const actionError = launchRun.error || pauseRun.error || resumeRun.error || stopRun.error;
  const canPause = Boolean(run?.supportsPause && runStatus === "running");
  const canResume = Boolean(run?.supportsResume && runStatus === "paused");
  const canStop = Boolean(run?.supportsStop && ["running", "paused", "queued", "stopping"].includes(runStatus));
  const disabledReason = runStatus === "not_running" ? "No live run exists for this operative." : `Action unavailable while run is ${runStatus}.`;

  const refresh = () => {
    runQuery.refetch();
    activityQuery.refetch();
    queryClient.invalidateQueries({ queryKey: runQuery.queryKey });
    queryClient.invalidateQueries({ queryKey: getListAgentsQueryKey() });
  };
  const launch = () => {
    if (!instruction.trim()) return;
    launchRun.mutate({ agentId, data: { task: instruction.trim() } }, {
      onSuccess: () => {
        setInstruction("");
        refresh();
      },
    });
  };
  const mutateRun = (action: "pause" | "resume" | "stop") => {
    if (!runId) return;
    if (action === "pause") pauseRun.mutate({ agentId }, { onSuccess: refresh });
    if (action === "resume") resumeRun.mutate({ agentId }, { onSuccess: refresh });
    if (action === "stop") stopRun.mutate({ agentId }, { onSuccess: refresh });
  };

  return (
    <div className="mt-5 border-4 border-border bg-background/60 p-4" data-testid={`agent-run-panel-${agentId}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-border pb-2">
        <div className="flex items-center gap-2 text-sm font-black uppercase"><Terminal size={16} className="text-primary" /> Live run // {agentName}</div>
        <div className="flex items-center gap-2">
          <BrutalBadge variant={statusVariant(runStatus)}>{runStatus.replaceAll("_", " ")}</BrutalBadge>
          <button type="button" data-testid={`run-refresh-${agentId}`} className="border-2 border-border p-1 hover:bg-muted" title="Refresh run and activity" onClick={refresh}><RefreshCw size={14} /></button>
        </div>
      </div>
      {runQuery.isLoading ? (
        <div className="mt-3 flex items-center gap-2 font-mono text-xs text-muted-foreground"><Loader2 size={14} className="animate-spin" /> Reading run state...</div>
      ) : runQuery.isError ? (
        <div className="mt-3 flex items-center justify-between gap-2 border-2 border-destructive bg-destructive/10 p-2 font-mono text-xs">
          <span>{messageFor(runQuery.error, "Run state unavailable.")}</span>
          <button type="button" className="font-black uppercase underline" onClick={refresh}>Retry</button>
        </div>
      ) : (
        <>
          <div className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
            <div><span className="font-black uppercase text-muted-foreground">Run ID</span><div className="font-mono font-bold">{runId || "—"}</div></div>
            <div><span className="font-black uppercase text-muted-foreground">Provider ref</span><div className="truncate font-mono font-bold">{run?.providerRunId || "pending"}</div></div>
            <div><span className="font-black uppercase text-muted-foreground">Last event</span><div className="truncate font-mono font-bold">{run?.lastEvent || "Awaiting dispatch"}</div></div>
          </div>
          {runStatus === "not_running" && (
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              {asList(connectionsQuery.data).length > 0 && <select data-testid={`run-connection-${agentId}`} value={connectionId} onChange={(event) => setConnectionId(event.target.value)} className="border-4 border-border bg-card p-2 font-mono text-xs focus:outline-none sm:max-w-48"><option value="">AUTO LINK</option>{asList(connectionsQuery.data).map((connection) => <option key={String(connection.id ?? connection.connectionId)} value={String(connection.id ?? connection.connectionId)}>{connection.name ?? connection.provider ?? "runtime link"}</option>)}</select>}
              <input data-testid={`run-instruction-${agentId}`} value={instruction} onChange={(event) => setInstruction(event.target.value)} placeholder="Describe the next run directive..." className="min-w-0 flex-1 border-4 border-border bg-card p-2 font-mono text-sm focus:outline-none focus:ring-4 focus:ring-primary/20" />
              <BrutalButton data-testid={`run-launch-${agentId}`} disabled={busy || !instruction.trim()} onClick={launch}>
                {launchRun.isPending ? <><Loader2 size={15} className="animate-spin" /> Launching...</> : <><Play size={15} /> Launch run</>}
              </BrutalButton>
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <BrutalButton data-testid={`run-pause-${agentId}`} variant="secondary" className="px-3 py-1 text-xs" disabled={busy || !canPause} title={!canPause ? disabledReason : "Pause this live run"} onClick={() => mutateRun("pause")}><Pause size={14} /> Pause</BrutalButton>
            <BrutalButton data-testid={`run-resume-${agentId}`} variant="primary" className="px-3 py-1 text-xs" disabled={busy || !canResume} title={!canResume ? disabledReason : "Resume this paused run"} onClick={() => mutateRun("resume")}><Play size={14} /> Resume</BrutalButton>
            <BrutalButton data-testid={`run-stop-${agentId}`} variant="destructive" className="px-3 py-1 text-xs" disabled={busy || !canStop} title={!canStop ? disabledReason : "Stop this run"} onClick={() => mutateRun("stop")}><Square size={13} /> Stop</BrutalButton>
            {!canPause && !canResume && !canStop && <span className="self-center font-mono text-[11px] text-muted-foreground">{disabledReason}</span>}
          </div>
          {actionError && <p className="mt-2 border-2 border-destructive bg-destructive/10 p-2 font-mono text-xs text-destructive">{messageFor(actionError, "Run command failed.")}</p>}
        </>
      )}
      <button type="button" data-testid={`run-activity-toggle-${agentId}`} className="mt-4 flex w-full items-center justify-between border-t-2 border-border pt-3 text-left text-xs font-black uppercase text-muted-foreground hover:text-foreground" onClick={() => setShowActivity((open) => !open)}>
        <span className="flex items-center gap-2"><Activity size={14} /> Activity stream ({events.length})</span>{showActivity ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
      </button>
      {showActivity && (
        <div className="mt-3 max-h-44 space-y-2 overflow-auto">
          {activityQuery.isLoading && <div className="font-mono text-xs text-muted-foreground">Loading activity...</div>}
          {activityQuery.isError && <div className="border-2 border-destructive p-2 font-mono text-xs text-destructive">{messageFor(activityQuery.error, "Activity unavailable.")}</div>}
          {!activityQuery.isLoading && !activityQuery.isError && events.length === 0 && <div className="border-2 border-dashed border-border p-3 text-center font-mono text-xs text-muted-foreground">NO EVENTS YET</div>}
          {events.map((event, index) => (
              <div key={String(event.id ?? index)} className="border-l-4 border-primary bg-muted/40 p-2 font-mono text-xs">
              <div className="flex justify-between gap-3 font-black uppercase"><span>{event.kind}</span><span className="text-muted-foreground">{event.createdAt ? new Date(event.createdAt).toLocaleTimeString() : "now"}</span></div>
              <div className="mt-1">{event.message}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AgentCard({ agent, projects, skills, runtimeConnections }: { agent: any; projects: any[]; skills: any[]; runtimeConnections: LooseRecord[] }) {
  const queryClient = useQueryClient();
  const { data: capabilities, isLoading: capLoading, isError: capError } = useListAgentCapabilities(agent.id);
  const updateAgent = useUpdateAgent({
    mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListAgentsQueryKey() }) },
  });
  const attachSkill = useAttachAgentCapability({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAgentCapabilitiesQueryKey(agent.id) });
        queryClient.invalidateQueries({ queryKey: getListAgentsQueryKey() });
      },
    },
  });
  const detachSkill = useDetachAgentCapability({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListAgentCapabilitiesQueryKey(agent.id) }),
    },
  });
  const availableSkills = skills.filter((skill) => !capabilities?.some((capability) => capability.skillId === skill.id));
  const [selectedSkill, setSelectedSkill] = useState("");

  return (
    <div data-testid={`agent-card-${agent.id}`}><BrutalCard className="group flex h-full flex-col bg-card">
      <div className="flex items-start justify-between gap-3 border-b-4 border-border pb-4">
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center border-4 border-border bg-accent shadow-[4px_4px_0px_0px_hsl(var(--border))] transition-transform group-hover:-translate-y-1"><Cpu size={28} className="text-accent-foreground" /></div>
          <div className="min-w-0">
            <h2 className="truncate text-2xl font-black uppercase tracking-tight">{agent.name}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-2 font-mono text-xs font-bold uppercase text-muted-foreground"><span>{agent.role}</span><span className="text-muted-foreground/50">/</span><span className="text-primary">{agent.provider || "default"}</span></div>
          </div>
        </div>
        <BrutalBadge variant={statusVariant(agent.status)}>{agent.status}</BrutalBadge>
      </div>

      <div className="my-4 grid grid-cols-2 gap-3">
        <div className="border-4 border-border bg-muted/30 p-3"><div className="flex items-center gap-2 border-b-2 border-border pb-1 text-[11px] font-black uppercase text-muted-foreground"><Monitor size={13} /> Room</div><div className="mt-2 truncate font-mono text-sm font-bold">{agent.room || "unassigned"}</div><div className="font-mono text-xs">{agent.computerStatus || "no status"}</div></div>
        <div className="border-4 border-border bg-muted/30 p-3"><div className="flex items-center gap-2 border-b-2 border-border pb-1 text-[11px] font-black uppercase text-muted-foreground"><Lightbulb size={13} /> Venture</div><div className="mt-2 truncate font-mono text-sm font-bold" title={agent.businessIdea || ""}>{agent.businessIdea || "awaiting idea"}</div><div className="font-mono text-xs uppercase text-secondary">{agent.phase || "idle"}</div></div>
      </div>

      <div className="mb-4">
        <div className="mb-2 flex items-center gap-2 border-b-4 border-border pb-1 text-xs font-black uppercase text-muted-foreground"><Workflow size={14} /> Current operation</div>
        <div className="truncate border-4 border-border bg-card p-3 font-mono text-sm" title={agent.currentTask || "Idle / Awaiting Instructions"}>{agent.currentTask || "Idle / Awaiting Instructions"}</div>
        {agent.nextMove && <div className="mt-2 flex gap-2 truncate font-mono text-xs text-muted-foreground"><span className="font-black">NEXT:</span><span title={agent.nextMove}>{agent.nextMove}</span></div>}
      </div>

      <div className="mb-4 flex-1">
        <div className="mb-2 flex justify-between border-b-4 border-border pb-1 text-xs font-black uppercase text-muted-foreground"><span>Capabilities</span><span>{agent.skillCount ?? capabilities?.length ?? 0} attached</span></div>
        {capError && <div className="mb-2 border-2 border-destructive bg-destructive/10 p-2 font-mono text-xs text-destructive">Capability registry unavailable.</div>}
        <div className="max-h-28 space-y-2 overflow-y-auto">
          {capLoading && <div className="font-mono text-xs text-muted-foreground">Loading modules...</div>}
          {!capLoading && capabilities?.length ? capabilities.map((capability: any) => (
            <div key={capability.id} className="flex items-center justify-between border-2 border-border bg-card p-2"><span className="truncate font-mono text-xs font-bold">{capability.name}</span><button type="button" data-testid={`detach-skill-${agent.id}-${capability.skillId}`} onClick={() => detachSkill.mutate({ agentId: agent.id, skillId: capability.skillId })} className="border-2 border-transparent px-2 text-xs font-black text-destructive hover:border-destructive hover:bg-destructive hover:text-destructive-foreground" title="Detach skill">X</button></div>
          )) : !capLoading && <div className="border-2 border-dashed border-border p-2 text-center font-mono text-xs text-muted-foreground">NO MODULES ATTACHED</div>}
        </div>
        {availableSkills.length > 0 && <div className="mt-3 flex gap-2"><select data-testid={`skill-select-${agent.id}`} value={selectedSkill} onChange={(event) => setSelectedSkill(event.target.value)} className="min-w-0 flex-1 border-4 border-border bg-card p-1 font-mono text-xs focus:outline-none"><option value="">ATTACH MODULE...</option>{availableSkills.map((skill) => <option key={skill.id} value={skill.id}>{skill.name}</option>)}</select><BrutalButton data-testid={`attach-skill-${agent.id}`} variant="accent" className="px-3 py-1 text-xs" disabled={!selectedSkill || attachSkill.isPending} onClick={() => { attachSkill.mutate({ agentId: agent.id, data: { skillId: Number(selectedSkill) } }); setSelectedSkill(""); }}>+</BrutalButton></div>}
      </div>

       <div className="border-4 border-border bg-muted/50 p-3">
         <div className="flex items-center gap-2 text-xs font-black uppercase"><Radio size={14} className="text-primary" /> Live state is controlled by the run panel</div>
        <label className="mt-3 block text-xs font-black uppercase">Assignment<select data-testid={`agent-project-${agent.id}`} className="mt-1 w-full border-4 border-border bg-card p-2 font-mono text-sm font-bold focus:outline-none" value={agent.projectId || ""} onChange={(event) => updateAgent.mutate({ agentId: agent.id, data: { projectId: event.target.value ? Number(event.target.value) : undefined } })}><option value="">-- UNASSIGNED --</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
        <label className="mt-3 block text-xs font-black uppercase">Runtime link<select data-testid={`agent-runtime-${agent.id}`} className="mt-1 w-full border-4 border-border bg-card p-2 font-mono text-sm font-bold focus:outline-none" value={agent.runtimeConnectionId || ""} onChange={(event) => updateAgent.mutate({ agentId: agent.id, data: { runtimeConnectionId: event.target.value ? Number(event.target.value) : undefined } })}><option value="">-- AUTO BY PROVIDER --</option>{runtimeConnections.map((connection) => <option key={String(connection.id)} value={String(connection.id)}>{connection.name} ({connection.provider})</option>)}</select></label>
        {updateAgent.isError && <p className="mt-2 font-mono text-xs text-destructive">{messageFor(updateAgent.error, "Agent update failed.")}</p>}
      </div>
      <RunPanel agentId={agent.id} agentName={agent.name} />
    </BrutalCard></div>
  );
}

export function Agents() {
  const { data: agents, isLoading: agentsLoading, isError: agentsError, error: agentsErrorValue, refetch: refetchAgents } = useListAgents({ query: { queryKey: getListAgentsQueryKey(), refetchInterval: 10000 } });
  const { data: projects, isLoading: projectsLoading } = useListProjects();
  const { data: skills, isLoading: skillsLoading } = useListSkills();
   const { data: runtimeConnections } = useListRuntimeConnections({ query: { queryKey: ["runtime-connections"], refetchInterval: 15000 } });
  const queryClient = useQueryClient();
  const createAgent = useCreateAgent({ mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListAgentsQueryKey() }) } });
  const [showNew, setShowNew] = useState(false);
  const [newAgent, setNewAgent] = useState({ name: "", role: "", projectId: "", provider: "" });

  const handleCreate = () => {
    if (!newAgent.name.trim() || !newAgent.role.trim()) return;
    createAgent.mutate({ data: { name: newAgent.name.trim(), role: newAgent.role.trim(), projectId: newAgent.projectId ? Number(newAgent.projectId) : undefined, provider: newAgent.provider.trim() || undefined } }, { onSuccess: () => { setShowNew(false); setNewAgent({ name: "", role: "", projectId: "", provider: "" }); } } as any);
  };

  if (agentsLoading || projectsLoading || skillsLoading) return <div className="space-y-4 p-2 font-mono font-bold"><div className="h-10 w-2/3 animate-pulse bg-muted" /><div className="h-24 animate-pulse border-4 border-border bg-muted/50" /><div className="h-64 animate-pulse border-4 border-border bg-muted/50" /></div>;
  if (agentsError) return <div className="border-4 border-destructive bg-destructive/10 p-8"><h1 className="text-2xl font-black uppercase">Roster feed interrupted</h1><p className="mt-2 font-mono text-sm">{messageFor(agentsErrorValue, "Agent roster unavailable.")}</p><BrutalButton data-testid="agents-retry-button" variant="destructive" className="mt-5" onClick={() => refetchAgents()}><RefreshCw size={16} /> Retry feed</BrutalButton></div>;

  return (
    <div className="space-y-8">
      <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div className="max-w-2xl"><div className="mb-2 flex items-center gap-2 font-mono text-xs font-black uppercase tracking-widest text-primary"><Radio size={14} className="animate-pulse" /> live staff control</div><h1 className="text-4xl font-black uppercase tracking-tighter md:text-5xl">Operative roster</h1><p className="mt-2 font-mono text-lg text-muted-foreground">Equip the staff. Dispatch the work. Watch every run move.</p></div>
        <BrutalButton data-testid="spawn-agent-button" onClick={() => setShowNew((open) => !open)} className="flex items-center gap-2"><UserPlus size={18} /> Spawn operative</BrutalButton>
      </div>
      <RuntimeLinkPanel />
      {showNew && <div data-testid="new-agent-form"><BrutalCard title="Instantiate new agent" className="border-dashed border-primary bg-primary/10"><div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">{([["name", "Callsign", "e.g. Unit-01"], ["role", "Designated role", "e.g. Researcher"], ["provider", "LLM provider", "e.g. anthropic"]] as const).map(([key, label, placeholder]) => <label key={key} className="text-sm font-black uppercase">{label}<input data-testid={`new-agent-${key}`} value={newAgent[key]} onChange={(event) => setNewAgent({ ...newAgent, [key]: event.target.value })} placeholder={placeholder} className="mt-2 w-full border-4 border-border bg-card p-3 font-mono font-normal normal-case focus:outline-none focus:ring-4 focus:ring-primary/20" /></label>)}<label className="text-sm font-black uppercase">Initial assignment<select data-testid="new-agent-project" value={newAgent.projectId} onChange={(event) => setNewAgent({ ...newAgent, projectId: event.target.value })} className="mt-2 w-full border-4 border-border bg-card p-3 font-mono font-normal focus:outline-none"><option value="">-- UNASSIGNED --</option>{projects?.map((project: any) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label></div><div className="mt-6 flex gap-3"><BrutalButton data-testid="create-agent-button" onClick={handleCreate} disabled={createAgent.isPending || !newAgent.name.trim() || !newAgent.role.trim()}>{createAgent.isPending ? <><Loader2 size={16} className="animate-spin" /> Instantiating...</> : "Instantiate"}</BrutalButton><BrutalButton variant="default" onClick={() => setShowNew(false)}>Cancel</BrutalButton></div>{createAgent.isError && <p className="mt-3 font-mono text-sm text-destructive">{messageFor(createAgent.error, "Could not instantiate agent.")}</p>}</BrutalCard></div>}
      <div className="grid items-stretch gap-8 md:grid-cols-2 xl:grid-cols-3">
        {agents?.map((agent: any) => <AgentCard key={agent.id} agent={agent} projects={projects || []} skills={skills || []} runtimeConnections={asList(runtimeConnections)} />)}
        {(!agents || agents.length === 0) && <div className="col-span-full border-4 border-dashed border-border p-12 text-center font-mono font-bold text-muted-foreground">NO AGENTS INSTANTIATED. SPAWN AN OPERATIVE TO BEGIN.</div>}
      </div>
    </div>
  );
}