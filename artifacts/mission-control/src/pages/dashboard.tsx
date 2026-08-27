import {
  getListApprovalsQueryKey,
  getListTasksQueryKey,
  useCreateTask,
  useGetDashboard,
  useHealthCheck,
  useListAgents,
  useListApprovals,
  useListProjects,
  useListRuntimeConnections,
  useListRuntimeHealth,
  useListTasks,
  useUpdateApproval,
  useUpdateTask,
} from "@workspace/api-client-react";
import type {
  Agent,
  Approval,
  RuntimeConnectionSafe,
  RuntimeHealth,
  Task,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Clock3,
  Command,
  HeartPulse,
  Link2,
  ListChecks,
  Radio,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  UserRound,
  Wrench,
  X,
} from "lucide-react";
import { Link } from "wouter";
import { BrutalBadge, BrutalButton, BrutalCard } from "../components/ui/brutal";

function formatRelativeDate(dateValue: string | null | undefined) {
  if (!dateValue) return "time not recorded";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "time not recorded";
  const minutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function statusVariant(status: string): "primary" | "secondary" | "accent" | "destructive" | "default" {
  if (["working", "active", "healthy", "online", "approved", "live"].includes(status)) return "primary";
  if (["reviewing", "review", "degraded", "changes_requested", "building"].includes(status)) return "accent";
  if (["blocked", "unhealthy", "pending", "rejected", "paused"].includes(status)) return "destructive";
  return "secondary";
}

function SectionIntro({
  eyebrow,
  title,
  explanation,
  count,
  icon,
}: {
  eyebrow: string;
  title: string;
  explanation: string;
  count?: number;
  icon: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-col gap-3 border-b-4 border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <div className="mb-1 flex items-center gap-2 font-mono text-xs font-black uppercase tracking-[0.14em] text-primary">
          {icon}
          {eyebrow}
        </div>
        <h2 className="text-2xl font-black uppercase tracking-tight">{title}</h2>
        <p className="mt-1 max-w-2xl font-mono text-xs leading-relaxed text-muted-foreground">{explanation}</p>
      </div>
      {typeof count === "number" && <div className="font-mono text-4xl font-black leading-none text-primary">{count.toString().padStart(2, "0")}</div>}
    </div>
  );
}

function EmptyState({ title, explanation }: { title: string; explanation: string }) {
  return (
    <div className="border-4 border-dashed border-border bg-muted/25 p-6 text-center">
      <div className="font-black uppercase">{title}</div>
      <p className="mt-2 font-mono text-xs leading-relaxed text-muted-foreground">{explanation}</p>
    </div>
  );
}

function InlineError({ explanation, onRetry, testId }: { explanation: string; onRetry?: () => void; testId: string }) {
  return (
    <div data-testid={testId} className="flex flex-col gap-3 border-4 border-destructive bg-destructive/10 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <AlertTriangle size={18} className="mt-0.5 shrink-0 text-destructive" />
        <p className="font-mono text-xs leading-relaxed">{explanation}</p>
      </div>
      {onRetry && (
        <button
          type="button"
          data-testid={`${testId}-retry`}
          className="inline-flex items-center gap-1 self-start font-black uppercase underline sm:self-auto"
          onClick={onRetry}
        >
          <RefreshCw size={13} /> Retry
        </button>
      )}
    </div>
  );
}

function ActionLink({ href, children, testId }: { href: string; children: ReactNode; testId: string }) {
  return (
    <Link
      href={href}
      data-testid={testId}
      className="inline-flex items-center gap-2 border-4 border-border bg-primary px-3 py-2 text-xs font-black uppercase text-primary-foreground shadow-[4px_4px_0px_0px_hsl(var(--border))] transition-all hover:-translate-y-1 hover:translate-x-1 hover:shadow-[6px_6px_0px_0px_hsl(var(--border))]"
    >
      {children} <ArrowRight size={15} />
    </Link>
  );
}

function ApprovalRow({
  approval,
  projectName,
  agentName,
  onResolve,
  resolving,
}: {
  approval: Approval;
  projectName: string;
  agentName: string;
  onResolve: (id: number, status: "approved" | "rejected" | "changes_requested") => void;
  resolving: boolean;
}) {
  return (
    <div data-testid={`approval-card-${approval.id}`} className="border-4 border-border bg-card p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <BrutalBadge variant={approval.risk === "high" ? "destructive" : "accent"}>{approval.risk} risk</BrutalBadge>
            <span className="font-mono text-[11px] font-bold text-muted-foreground">{formatRelativeDate(approval.createdAt)}</span>
          </div>
          <h3 data-testid={`text-approval-title-${approval.id}`} className="mt-2 text-lg font-black uppercase leading-tight">{approval.title}</h3>
          <p className="mt-1 font-mono text-xs text-muted-foreground">{agentName} / {projectName}</p>
        </div>
        <ShieldAlert size={22} className="shrink-0 text-destructive" />
      </div>
      <div className="mt-3 border-l-4 border-primary bg-muted/40 p-3">
        <p className="font-black uppercase text-xs">Proposed action</p>
        <p className="mt-1 font-mono text-sm leading-relaxed">{approval.action}</p>
        <p className="mt-2 font-mono text-xs leading-relaxed text-muted-foreground">{approval.details}</p>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <BrutalButton
          data-testid={`button-approve-${approval.id}`}
          className="px-3 py-1.5 text-xs"
          disabled={resolving}
          onClick={() => onResolve(approval.id, "approved")}
        >
          <Check size={15} /> Approve
        </BrutalButton>
        <BrutalButton
          data-testid={`button-request-changes-${approval.id}`}
          variant="default"
          className="px-3 py-1.5 text-xs"
          disabled={resolving}
          onClick={() => onResolve(approval.id, "changes_requested")}
        >
          <Wrench size={15} /> Request changes
        </BrutalButton>
        <BrutalButton
          data-testid={`button-reject-${approval.id}`}
          variant="destructive"
          className="px-3 py-1.5 text-xs"
          disabled={resolving}
          onClick={() => onResolve(approval.id, "rejected")}
        >
          <X size={15} /> Reject
        </BrutalButton>
      </div>
    </div>
  );
}

function RuntimeHealthRow({ runtime }: { runtime: RuntimeHealth }) {
  const isBlocked = ["degraded", "unhealthy", "unknown", "disabled"].includes(runtime.status);
  return (
    <div data-testid={`runtime-health-row-${runtime.id}`} className={`border-4 border-border p-4 ${isBlocked ? "bg-destructive/10" : "bg-card"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className={`mt-1 h-3 w-3 shrink-0 border-2 border-border ${isBlocked ? "bg-destructive" : "bg-primary"}`} />
          <div className="min-w-0">
            <h3 className="truncate font-black uppercase">{runtime.name}</h3>
            <p className="mt-1 font-mono text-xs text-muted-foreground">{runtime.provider} / checked {formatRelativeDate(runtime.lastCheckedAt)}</p>
          </div>
        </div>
        <BrutalBadge variant={statusVariant(runtime.status)}>{runtime.status}</BrutalBadge>
      </div>
      <div className="mt-3 border-l-4 border-border pl-3">
        <p className="font-black uppercase text-[11px]">{isBlocked ? "Restart or repair blocker" : "Health signal"}</p>
        <p className="mt-1 font-mono text-xs leading-relaxed">{runtime.nextAction || "Keep this runtime connected and continue observing its health."}</p>
        {runtime.errorMessage && <p className="mt-1 font-mono text-xs text-destructive">{runtime.errorMessage}</p>}
      </div>
    </div>
  );
}

export function Dashboard() {
  const queryClient = useQueryClient();
  const { data: dashboard, isLoading: dashLoading, isError: dashError, error: dashErrorValue, refetch: refetchDashboard } = useGetDashboard();
  const { data: health, isLoading: healthLoading, isError: healthError, refetch: refetchHealth } = useHealthCheck({ query: { queryKey: ["/api/healthz"], refetchInterval: 10000 } });
  const { data: runtimeHealth, isLoading: runtimeHealthLoading, isError: runtimeHealthError, refetch: refetchRuntimeHealth } = useListRuntimeHealth({ query: { queryKey: ["runtime-health"], refetchInterval: 10000 } });
  const { data: runtimeConnections, isLoading: runtimeConnectionsLoading, isError: runtimeConnectionsError, refetch: refetchRuntimeConnections } = useListRuntimeConnections({ query: { queryKey: ["runtime-connections"], refetchInterval: 15000 } });
  const { data: tasks, isLoading: tasksLoading, isError: tasksError, refetch: refetchTasks } = useListTasks({ query: { queryKey: ["/api/tasks"], refetchInterval: 10000 } });
  const { data: agents, isLoading: agentsLoading, isError: agentsError, refetch: refetchAgents } = useListAgents({ query: { queryKey: ["/api/agents"], refetchInterval: 10000 } });
  const { data: projects, isLoading: projectsLoading, isError: projectsError, refetch: refetchProjects } = useListProjects();
  const { data: approvals, isLoading: approvalsLoading, isError: approvalsError, refetch: refetchApprovals } = useListApprovals();
  const [command, setCommand] = useState("");

  const createTask = useCreateTask({
    mutation: {
      onSuccess: () => {
        setCommand("");
        queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
      },
    },
  });
  const updateApproval = useUpdateApproval({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListApprovalsQueryKey() });
      },
    },
  });
  const updateTask = useUpdateTask({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
      },
    },
  });

  const projectNames = useMemo(() => new Map((projects ?? []).map((project) => [project.id, project.name])), [projects]);
  const agentNames = useMemo(() => new Map((agents ?? []).map((agent) => [agent.id, agent.name])), [agents]);
  const pendingApprovals = (approvals ?? []).filter((approval) => approval.status === "pending");
  const activeAgents = (agents ?? []).filter((agent) => ["working", "reviewing", "waiting"].includes(agent.status));
  const blockedAgents = (agents ?? []).filter((agent) => agent.status === "blocked");
  const activeTasks = (tasks ?? []).filter((task) => ["queued", "active", "review"].includes(task.status));
  const runtimeHealthList = Array.isArray(runtimeHealth) ? runtimeHealth : [];
  const runtimeConnectionList = Array.isArray(runtimeConnections) ? runtimeConnections : [];
  const runtimeBlockers = runtimeHealthList.filter((runtime) => ["degraded", "unhealthy", "unknown", "disabled"].includes(runtime.status));
  const healthyRuntimeCount = runtimeHealthList.filter((runtime) => ["healthy", "ok", "connected", "online"].includes(runtime.status)).length;
  const todayLabel = new Intl.DateTimeFormat("en", { weekday: "long", month: "long", day: "numeric" }).format(new Date());

  const refreshAll = () => {
    void Promise.all([
      refetchDashboard(),
      refetchHealth(),
      refetchRuntimeHealth(),
      refetchRuntimeConnections(),
      refetchTasks(),
      refetchAgents(),
      refetchProjects(),
      refetchApprovals(),
    ]);
  };

  if (dashLoading || healthLoading || tasksLoading || agentsLoading || projectsLoading || approvalsLoading || runtimeHealthLoading || runtimeConnectionsLoading) {
    return (
      <div data-testid="dashboard-loading" className="space-y-5 p-2">
        <div className="h-5 w-40 animate-pulse bg-muted" />
        <div className="h-16 w-3/4 animate-pulse bg-muted" />
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="h-72 animate-pulse border-4 border-border bg-muted/50" />
          <div className="h-72 animate-pulse border-4 border-border bg-muted/50" />
        </div>
        <div className="h-56 animate-pulse border-4 border-border bg-muted/50" />
      </div>
    );
  }

  if (dashError) {
    return (
      <div data-testid="dashboard-error" className="border-4 border-destructive bg-destructive/10 p-8 shadow-[6px_6px_0px_0px_hsl(var(--destructive))]">
        <h1 className="text-2xl font-black uppercase">Daily brief unavailable</h1>
        <p className="mt-2 font-mono text-sm">{dashErrorValue instanceof Error ? dashErrorValue.message : "The dashboard feed could not be loaded."}</p>
        <BrutalButton data-testid="dashboard-retry-button" variant="destructive" className="mt-5" onClick={() => refetchDashboard()}>
          <RefreshCw size={16} /> Retry feed
        </BrutalButton>
      </div>
    );
  }

  const resolveApproval = (approvalId: number, status: "approved" | "rejected" | "changes_requested") => {
    updateApproval.mutate({ approvalId, data: { status } });
  };

  const moveTask = (task: Task, status: "active" | "done") => {
    updateTask.mutate({ taskId: task.id, data: { status } });
  };

  return (
    <div className="space-y-8 pb-8">
      <header className="flex flex-col gap-5 border-b-4 border-border pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 font-mono text-xs font-black uppercase tracking-[0.18em] text-primary">
            <Command size={15} /> Mission Control / daily operating home
          </div>
          <h1 data-testid="text-dashboard-title" className="text-4xl font-black uppercase tracking-[-0.06em] sm:text-6xl">Make today move.</h1>
          <p className="mt-2 font-mono text-sm font-bold text-muted-foreground">{todayLabel} · decisions first, telemetry second.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div data-testid="status-main-system" className="flex items-center gap-2 border-4 border-border bg-card px-3 py-2 font-mono text-xs font-black uppercase shadow-[4px_4px_0px_0px_hsl(var(--border))]">
            <span className={`h-3 w-3 border-2 border-border ${health?.status === "ok" ? "bg-primary" : "bg-destructive"}`} />
            System {health?.status === "ok" ? "online" : "offline"}
          </div>
          <BrutalButton data-testid="button-refresh-signals" variant="default" className="px-3 py-2 text-xs" onClick={refreshAll}>
            <RefreshCw size={15} /> Refresh signals
          </BrutalButton>
        </div>
      </header>

      {(healthError || runtimeHealthError || runtimeConnectionsError) && (
        <InlineError
          testId="dashboard-runtime-error"
          explanation="One or more health probes are stale. The work lists below can still be used, but check runtime signals before dispatching new work."
          onRetry={refreshAll}
        />
      )}

      <section data-testid="dashboard-needs-you" className="border-4 border-destructive bg-destructive/5 p-4 shadow-[6px_6px_0px_0px_hsl(var(--destructive))] sm:p-6">
        <SectionIntro
          eyebrow="01 / human decision queue"
          title="Needs you now"
          count={pendingApprovals.length + blockedAgents.length}
          explanation="Approve safe actions, redirect blocked staff, or request changes. Nothing in this lane advances without a human decision."
          icon={<ShieldAlert size={16} />}
        />
        <div className="grid gap-5 lg:grid-cols-[1.35fr_0.65fr]">
          <div className="space-y-4">
            {approvalsError && <InlineError testId="approvals-error" explanation="Approval requests could not be loaded. Retry to see what is waiting for your sign-off." onRetry={() => refetchApprovals()} />}
            {!approvalsError && pendingApprovals.length === 0 && (
              <EmptyState title="No approvals waiting" explanation="The human decision queue is clear. Staff can continue on already-authorized work." />
            )}
            {pendingApprovals.slice(0, 4).map((approval) => (
              <ApprovalRow
                key={approval.id}
                approval={approval}
                projectName={projectNames.get(approval.projectId) ?? `Project ${approval.projectId}`}
                agentName={agentNames.get(approval.agentId) ?? `Agent ${approval.agentId}`}
                onResolve={resolveApproval}
                resolving={updateApproval.isPending}
              />
            ))}
            {pendingApprovals.length > 4 && <p className="font-mono text-xs font-bold text-muted-foreground">Showing 4 of {pendingApprovals.length}. Open approvals to review the rest.</p>}
            <ActionLink href="/approvals" testId="link-open-approvals">Open approval inbox</ActionLink>
          </div>
          <div className="border-4 border-border bg-card p-4">
            <div className="flex items-center gap-2 font-black uppercase"><CircleDot size={17} className="text-destructive" /> Blocked staff</div>
            <p className="mt-1 font-mono text-xs leading-relaxed text-muted-foreground">These operatives cannot make progress. Open the roster to change their state or assignment.</p>
            <div className="mt-4 space-y-3">
              {agentsError && <InlineError testId="agents-blocked-error" explanation="Staff status could not be loaded." onRetry={() => refetchAgents()} />}
              {!agentsError && blockedAgents.length === 0 && <EmptyState title="No staff blocked" explanation="There are no agents currently marked blocked." />}
              {blockedAgents.map((agent) => (
                <div data-testid={`blocked-agent-${agent.id}`} key={agent.id} className="flex items-center justify-between gap-3 border-b-2 border-border pb-3 last:border-0 last:pb-0">
                  <div className="min-w-0">
                    <div className="truncate font-black uppercase">{agent.name}</div>
                    <div className="truncate font-mono text-xs text-muted-foreground">{agent.currentTask || "No current task recorded"}</div>
                  </div>
                  <BrutalBadge variant="destructive">blocked</BrutalBadge>
                </div>
              ))}
            </div>
            <ActionLink href="/agents" testId="link-open-blocked-staff" >Open live roster</ActionLink>
          </div>
        </div>
      </section>

      <section data-testid="dashboard-active-work">
        <SectionIntro
          eyebrow="02 / execution lane"
          title="Active staff work"
          count={activeAgents.length + activeTasks.filter((task) => task.status === "active").length}
          explanation="See who is working, what they are working on, and the next task transitions you can make without leaving this page."
          icon={<Activity size={16} />}
        />
        <div className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
          <BrutalCard title="Staff on shift" action={<UserRound size={18} />}>
            {agentsError ? (
              <InlineError testId="active-agents-error" explanation="Active staff could not be loaded." onRetry={() => refetchAgents()} />
            ) : activeAgents.length === 0 ? (
              <EmptyState title="No active staff" explanation="No agents are working, reviewing, or waiting right now. Open the roster to inspect available units." />
            ) : (
              <div className="space-y-4">
                {activeAgents.slice(0, 6).map((agent: Agent) => (
                  <div data-testid={`active-agent-${agent.id}`} key={agent.id} className="border-b-4 border-border pb-4 last:border-0 last:pb-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate font-black uppercase">{agent.name}</h3>
                        <p className="mt-1 truncate font-mono text-xs text-muted-foreground">{agent.role} · {agent.phase}</p>
                      </div>
                      <BrutalBadge variant={statusVariant(agent.status)}>{agent.status}</BrutalBadge>
                    </div>
                    <p className="mt-3 font-mono text-sm leading-relaxed">{agent.currentTask || "No current task recorded."}</p>
                    <p className="mt-2 border-l-4 border-primary pl-2 font-mono text-xs text-muted-foreground">
                      Next: {agent.nextMove || "No next move recorded. Review the roster before assigning work."}
                    </p>
                  </div>
                ))}
                <ActionLink href="/agents" testId="link-active-staff-roster">Manage staff assignments</ActionLink>
              </div>
            )}
          </BrutalCard>

          <BrutalCard title="Task handoff" action={<ListChecks size={18} />}>
            {tasksError ? (
              <InlineError testId="tasks-error" explanation="The work queue could not be loaded. Retry before changing task state." onRetry={() => refetchTasks()} />
            ) : activeTasks.length === 0 ? (
              <EmptyState title="Queue is clear" explanation="There are no queued, active, or review tasks needing a handoff." />
            ) : (
              <div className="space-y-3">
                {activeTasks.slice(0, 7).map((task) => (
                  <div data-testid={`task-row-${task.id}`} key={task.id} className="border-4 border-border bg-card p-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="font-mono text-sm font-bold leading-relaxed">{task.title}</p>
                        <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                          {projectNames.get(task.projectId) ?? `Project ${task.projectId}`} · {task.agentId ? agentNames.get(task.agentId) ?? `Agent ${task.agentId}` : "unassigned"}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <BrutalBadge variant={statusVariant(task.priority)}>{task.priority}</BrutalBadge>
                        <BrutalBadge variant={statusVariant(task.status)}>{task.status}</BrutalBadge>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {task.status === "queued" && (
                        <BrutalButton data-testid={`button-start-task-${task.id}`} className="px-3 py-1 text-xs" disabled={updateTask.isPending} onClick={() => moveTask(task, "active")}>
                          <Radio size={14} /> Start task
                        </BrutalButton>
                      )}
                      {task.status !== "done" && (
                        <BrutalButton data-testid={`button-complete-task-${task.id}`} variant="default" className="px-3 py-1 text-xs" disabled={updateTask.isPending} onClick={() => moveTask(task, "done")}>
                          <CheckCircle2 size={14} /> Mark done
                        </BrutalButton>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </BrutalCard>
        </div>
      </section>

      <section data-testid="dashboard-runtime-blockers" className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <BrutalCard title="Runtime health / restart blockers" action={<HeartPulse size={18} />}>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div data-testid="metric-runtime-healthy" className="border-2 border-border bg-primary/10 p-3">
              <p className="font-mono text-[11px] font-black uppercase text-muted-foreground">Healthy</p>
              <p className="mt-1 font-mono text-2xl font-black text-primary">{healthyRuntimeCount}/{runtimeHealthList.length || "—"}</p>
              <p className="mt-1 font-mono text-[10px] text-muted-foreground">health records clear</p>
            </div>
            <div data-testid="metric-runtime-blockers" className="border-2 border-border bg-destructive/10 p-3">
              <p className="font-mono text-[11px] font-black uppercase text-muted-foreground">Blockers</p>
              <p className="mt-1 font-mono text-2xl font-black text-destructive">{runtimeBlockers.length}</p>
              <p className="mt-1 font-mono text-[10px] text-muted-foreground">need operator attention</p>
            </div>
            <div data-testid="metric-runtime-links" className="border-2 border-border bg-accent/10 p-3">
              <p className="font-mono text-[11px] font-black uppercase text-muted-foreground">Connections</p>
              <p className="mt-1 font-mono text-2xl font-black">{runtimeConnectionList.length}</p>
              <p className="mt-1 font-mono text-[10px] text-muted-foreground">available to dispatch</p>
            </div>
          </div>
          {runtimeHealthError ? (
            <InlineError testId="runtime-health-error" explanation="Runtime health details are unavailable. Retry before treating the lane as clear." onRetry={() => refetchRuntimeHealth()} />
          ) : runtimeHealthList.length === 0 ? (
            <EmptyState title="No health records returned" explanation="The API did not return runtime health records, so a safe restart decision cannot be made from this page." />
          ) : (
            <div className="space-y-3">
              {runtimeHealthList.map((runtime) => <RuntimeHealthRow key={runtime.id} runtime={runtime} />)}
            </div>
          )}
        </BrutalCard>

        <BrutalCard title="Connection watch" action={<Link2 size={18} />}>
          <p className="mb-4 font-mono text-xs leading-relaxed text-muted-foreground">Connections tell you whether a runtime can receive new work. A health record must still be clear before dispatch.</p>
          {runtimeConnectionsError ? (
            <InlineError testId="runtime-connections-error" explanation="Runtime connections could not be loaded. Retry to verify dispatch paths." onRetry={() => refetchRuntimeConnections()} />
          ) : runtimeConnectionList.length === 0 ? (
            <EmptyState title="No connections configured" explanation="There is no runtime connection available for dispatch. Configure one before launching new agent work." />
          ) : (
            <div className="space-y-3">
              {runtimeConnectionList.map((connection: RuntimeConnectionSafe) => (
                <div data-testid={`runtime-connection-${connection.id}`} key={connection.id} className="flex items-center justify-between gap-3 border-b-4 border-border pb-3 last:border-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="truncate font-black uppercase">{connection.name}</p>
                    <p className="mt-1 font-mono text-xs text-muted-foreground">{connection.provider} · {connection.hasCredentials ? "credentials present" : "credentials missing"}</p>
                  </div>
                  <BrutalBadge variant={statusVariant(connection.status)}>{connection.status}</BrutalBadge>
                </div>
              ))}
            </div>
          )}
        </BrutalCard>
      </section>

      <section data-testid="dashboard-next-moves" className="border-4 border-border bg-primary/10 p-4 shadow-[6px_6px_0px_0px_hsl(var(--border))] sm:p-6">
        <SectionIntro
          eyebrow="04 / operator guidance"
          title="Suggested next moves"
          count={(dashboard?.recommendation ? 1 : 0) + activeAgents.filter((agent) => Boolean(agent.nextMove)).length}
          explanation="These are recommendations from the current dashboard and staff records. Queue one as work, or open the relevant lane to inspect it."
          icon={<Sparkles size={16} />}
        />
        <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="border-4 border-border bg-card p-4">
            <div className="flex items-center gap-2 font-black uppercase"><Sparkles size={17} className="text-primary" /> Command recommendation</div>
            <p data-testid="text-dashboard-recommendation" className="mt-3 font-mono text-base font-bold leading-relaxed">{dashboard?.recommendation || "No recommendation was returned. Review active work and runtime blockers manually."}</p>
            <div className="mt-5 flex flex-col gap-3">
              <label htmlFor="dashboard-command" className="font-mono text-xs font-black uppercase">Queue a plain-language instruction</label>
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  id="dashboard-command"
                  data-testid="input-dashboard-command"
                  className="min-w-0 flex-1 border-4 border-border bg-card p-3 font-mono text-sm focus:outline-none focus:ring-4 focus:ring-primary/20"
                  placeholder="Example: prepare a cost review for the live project"
                  value={command}
                  onChange={(event) => setCommand(event.target.value)}
                />
                <BrutalButton
                  data-testid="button-queue-command"
                  disabled={!command.trim() || createTask.isPending || !projects?.length}
                  onClick={() => {
                    const projectId = projects?.[0]?.id;
                    if (projectId && command.trim()) createTask.mutate({ data: { title: command.trim(), projectId, priority: "high" } });
                  }}
                >
                  <ChevronRight size={16} /> Queue instruction
                </BrutalButton>
              </div>
              {!projects?.length && <p className="font-mono text-xs text-destructive">A project is required before an instruction can be queued.</p>}
              {createTask.isError && <p className="font-mono text-xs text-destructive">The instruction could not be queued. Try again after checking the work queue.</p>}
            </div>
          </div>
          <div className="border-4 border-border bg-card p-4">
            <div className="flex items-center gap-2 font-black uppercase"><Clock3 size={17} className="text-primary" /> Staff recommendations</div>
            <div className="mt-4 space-y-3">
              {agentsError && <InlineError testId="suggested-agents-error" explanation="Staff recommendations could not be loaded." onRetry={() => refetchAgents()} />}
              {!agentsError && activeAgents.filter((agent) => agent.nextMove).length === 0 && <EmptyState title="No staff next moves" explanation="No active agent has supplied a next move. Use the command box to create an explicit instruction." />}
              {activeAgents.filter((agent) => agent.nextMove).slice(0, 4).map((agent) => (
                <div data-testid={`suggested-move-${agent.id}`} key={agent.id} className="border-l-4 border-primary bg-muted/40 p-3">
                  <p className="font-black uppercase text-xs">{agent.name}</p>
                  <p className="mt-1 font-mono text-xs leading-relaxed">{agent.nextMove}</p>
                </div>
              ))}
            </div>
            <ActionLink href="/agents" testId="link-review-next-moves">Review all staff moves</ActionLink>
          </div>
        </div>
      </section>

      <section data-testid="dashboard-snapshot" className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <BrutalCard title="Monthly income" className="border-l-8 border-l-primary">
          <div data-testid="metric-monthly-income" className="font-mono text-3xl font-black text-primary">${((dashboard?.monthlyIncomeCents || 0) / 100).toFixed(2)}</div>
          <p className="mt-2 font-mono text-xs text-muted-foreground">Revenue generated this month.</p>
        </BrutalCard>
        <BrutalCard title="Runway" className="border-l-8 border-l-secondary">
          <div data-testid="metric-runway" className="font-mono text-3xl font-black text-secondary">{dashboard?.runwayDays ?? "—"} days</div>
          <p className="mt-2 font-mono text-xs text-muted-foreground">Estimated operating time remaining.</p>
        </BrutalCard>
        <BrutalCard title="Velocity" className="border-l-8 border-l-accent">
          <div data-testid="metric-velocity" className="font-mono text-3xl font-black text-accent">{dashboard?.velocityPercent ?? "—"}%</div>
          <p className="mt-2 font-mono text-xs text-muted-foreground">Task completion rate reported by the dashboard.</p>
        </BrutalCard>
        <BrutalCard title="Recent activity" className="border-l-8 border-l-primary">
          {dashboard?.recentActivity?.length ? (
            <div data-testid="list-recent-activity" className="space-y-2">
              {dashboard.recentActivity.slice(0, 3).map((activity, index) => (
                <p data-testid={`text-recent-activity-${index}`} key={`${activity}-${index}`} className="font-mono text-xs leading-relaxed"><span className="mr-2 font-black text-primary">&gt;</span>{activity}</p>
              ))}
            </div>
          ) : (
            <p className="font-mono text-xs text-muted-foreground">No recent activity was returned.</p>
          )}
        </BrutalCard>
      </section>

      {projectsError && <InlineError testId="projects-error" explanation="Project names are unavailable. Work actions remain visible, but project labels may be incomplete." onRetry={() => refetchProjects()} />}
    </div>
  );
}