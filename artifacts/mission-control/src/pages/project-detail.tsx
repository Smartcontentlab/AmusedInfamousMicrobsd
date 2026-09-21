import { useState } from "react";
import { Link, useParams } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ChevronDown, ChevronRight, Plus, Repeat, X } from "lucide-react";
import {
  getGetProjectDetailQueryKey,
  useCreateAgentLoop,
  useDeleteAgentLoop,
  useGetProjectDetail,
  useUpdateAgentLoop,
  useUpdateTask,
} from "@workspace/api-client-react";
import type { ProjectStaffMember } from "@workspace/api-client-react";
import { BrutalBadge, BrutalCard } from "@/components/ui/brutal";
import { ModelPicker } from "@/components/model-picker";

const COLUMNS = [
  { key: "queued", label: "Queued" },
  { key: "active", label: "Active" },
  { key: "review", label: "Review" },
  { key: "done", label: "Done" },
];

const STATUS_TONE: Record<string, "primary" | "secondary" | "destructive" | "default"> = {
  working: "primary",
  reviewing: "secondary",
  waiting: "default",
  blocked: "destructive",
  offline: "destructive",
};

function LoopList({ staff, projectId }: { staff: ProjectStaffMember; projectId: number }) {
  const [name, setName] = useState("");
  const [cadence, setCadence] = useState("daily");
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: getGetProjectDetailQueryKey(projectId) });

  const createLoop = useCreateAgentLoop({ mutation: { onSuccess: invalidate } });
  const updateLoop = useUpdateAgentLoop({ mutation: { onSuccess: invalidate } });
  const deleteLoop = useDeleteAgentLoop({ mutation: { onSuccess: invalidate } });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    createLoop.mutate({ agentId: staff.id, data: { name: name.trim(), cadence } });
    setName("");
  };

  return (
    <div className="mt-2 border-t-2 border-border/40 pt-2">
      <p className="mb-1 flex items-center gap-1 font-mono text-[10px] font-bold uppercase text-muted-foreground">
        <Repeat size={11} /> Loops
      </p>

      {staff.loops.length === 0 && <p className="mb-1 font-mono text-[10px] text-muted-foreground">No repeating work yet.</p>}

      <ul className="space-y-1">
        {staff.loops.map((loop) => (
          <li key={loop.id} className="group flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={loop.enabled}
              onChange={() => updateLoop.mutate({ loopId: loop.id, data: { enabled: !loop.enabled } })}
              className="size-3 shrink-0 accent-primary"
              aria-label={`Toggle ${loop.name}`}
            />
            <span className={`flex-1 text-[11px] font-medium ${loop.enabled ? "" : "text-muted-foreground line-through"}`}>
              {loop.name}
            </span>
            <span className="shrink-0 font-mono text-[10px] uppercase text-muted-foreground">{loop.cadence}</span>
            <button
              onClick={() => deleteLoop.mutate({ loopId: loop.id })}
              aria-label={`Delete ${loop.name}`}
              className="shrink-0 text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100"
            >
              <X size={11} />
            </button>
          </li>
        ))}
      </ul>

      <form onSubmit={submit} className="mt-1.5 flex gap-1">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Add a loop..."
          className="min-w-0 flex-1 rounded-lg border border-border bg-background px-1.5 py-1 text-[11px] outline-none focus:ring-2 focus:ring-primary/20"
        />
        <select
          value={cadence}
          onChange={(event) => setCadence(event.target.value)}
          className="shrink-0 rounded-lg border border-border bg-background px-1 py-1 font-mono text-[10px] uppercase outline-none"
        >
          <option value="hourly">Hourly</option>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="on demand">On demand</option>
        </select>
        <button
          type="submit"
          disabled={!name.trim()}
          aria-label="Add loop"
          className="shrink-0 rounded-lg border border-border bg-primary px-1.5 text-primary-foreground disabled:opacity-40"
        >
          <Plus size={12} />
        </button>
      </form>
    </div>
  );
}

function StaffCard({ staff, projectId }: { staff: ProjectStaffMember; projectId: number }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-border bg-card">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-2 px-2 py-1.5 text-left hover:bg-muted/40">
        {open ? <ChevronDown size={13} className="shrink-0" /> : <ChevronRight size={13} className="shrink-0" />}
        <span className="flex-1 truncate text-xs font-bold uppercase tracking-tight">{staff.name}</span>
        <BrutalBadge variant={STATUS_TONE[staff.status] ?? "default"}>{staff.status}</BrutalBadge>
      </button>

      {open && (
        <div className="border-t-2 border-border px-2 pb-2 pt-1.5">
          <p className="text-[11px] font-bold uppercase text-muted-foreground">{staff.role}</p>
          {staff.currentTask && (
            <p className="mt-1 text-[11px]">
              <span className="font-mono text-[10px] uppercase text-muted-foreground">Now: </span>
              {staff.currentTask}
            </p>
          )}
          {staff.nextMove && (
            <p className="mt-0.5 text-[11px]">
              <span className="font-mono text-[10px] uppercase text-muted-foreground">Next: </span>
              {staff.nextMove}
            </p>
          )}

          <div className="mt-1.5 flex flex-wrap gap-1">
            <span className="border border-border bg-muted/50 px-1 py-0.5 font-mono text-[10px] uppercase">{staff.provider}</span>
            <span className="border border-border bg-muted/50 px-1 py-0.5 font-mono text-[10px] uppercase">
              {staff.doneTaskCount}/{staff.openTaskCount + staff.doneTaskCount} tasks
            </span>
            <span className="border border-border bg-muted/50 px-1 py-0.5 font-mono text-[10px] uppercase">{staff.skillCount} skills</span>
          </div>

          {staff.capabilities.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {staff.capabilities.map((capability) => (
                <span key={capability} className="bg-secondary/20 px-1 py-0.5 font-mono text-[10px] uppercase">
                  {capability}
                </span>
              ))}
            </div>
          )}

          <ModelPicker agentId={staff.id} model={staff.model} invalidateKey={getGetProjectDetailQueryKey(projectId)} />
          <LoopList staff={staff} projectId={projectId} />
        </div>
      )}
    </div>
  );
}

export function ProjectDetail() {
  const params = useParams<{ id: string }>();
  const projectId = Number(params.id);
  const queryClient = useQueryClient();
  const detail = useGetProjectDetail(projectId, {
    query: { queryKey: getGetProjectDetailQueryKey(projectId), refetchInterval: 20000 },
  });
  const updateTask = useUpdateTask({
    mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetProjectDetailQueryKey(projectId) }) },
  });

  if (detail.isLoading) return <p className="py-8 font-mono text-xs uppercase text-muted-foreground">Loading project...</p>;
  if (detail.isError || !detail.data)
    return (
      <div className="py-8">
        <p className="font-mono text-xs uppercase text-destructive">That project could not be loaded.</p>
        <Link href="/projects" className="mt-2 inline-block font-mono text-xs uppercase underline">
          Back to projects
        </Link>
      </div>
    );

  const { project, description, staff, tasks, approvals, progress } = detail.data;
  const pendingApprovals = approvals.filter((approval) => approval.status === "pending");

  return (
    <div className="space-y-4 py-2">
      <div>
        <Link href="/projects" className="mb-1 inline-flex items-center gap-1 font-mono text-[11px] uppercase text-muted-foreground hover:text-foreground">
          <ArrowLeft size={12} /> Projects
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold uppercase tracking-tighter">{project.name}</h1>
          <BrutalBadge variant={project.status === "live" ? "primary" : project.status === "paused" ? "destructive" : "secondary"}>
            {project.status}
          </BrutalBadge>
          <span className="ml-auto font-mono text-xs font-bold text-muted-foreground">
            ${(project.incomeCents / 100).toLocaleString()}
          </span>
        </div>
        {description && <p className="mt-1 max-w-3xl text-xs text-muted-foreground">{description}</p>}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
        <div className="space-y-3">
          <BrutalCard
            title={<span className="text-sm">Staff on this project</span>}
            action={<span className="font-mono text-[11px] font-bold text-muted-foreground">{staff.length}</span>}
          >
            {staff.length === 0 ? (
              <p className="py-3 text-center font-mono text-[11px] uppercase text-muted-foreground">No staff assigned.</p>
            ) : (
              <div className="space-y-1.5">
                {staff.map((member) => (
                  <StaffCard key={member.id} staff={member} projectId={projectId} />
                ))}
              </div>
            )}
          </BrutalCard>

          <BrutalCard title={<span className="text-sm">Progress</span>}>
            <div className="mb-2 flex items-baseline justify-between">
              <span className="text-2xl font-bold tabular-nums">{progress.percentComplete}%</span>
              <span className="font-mono text-[11px] uppercase text-muted-foreground">
                {progress.doneTasks}/{progress.totalTasks} done
              </span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-lg border border-border bg-muted">
              <div className="h-full bg-primary" style={{ width: `${progress.percentComplete}%` }} />
            </div>
            <div className="mt-2 grid grid-cols-2 gap-1">
              {[
                { label: "Queued", value: progress.queuedTasks },
                { label: "Active", value: progress.activeTasks },
                { label: "Review", value: progress.reviewTasks },
                { label: "Done", value: progress.doneTasks },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between border border-border bg-muted/30 px-1.5 py-0.5">
                  <span className="font-mono text-[10px] uppercase text-muted-foreground">{row.label}</span>
                  <span className="font-mono text-[11px] font-bold tabular-nums">{row.value}</span>
                </div>
              ))}
            </div>
          </BrutalCard>

          {pendingApprovals.length > 0 && (
            <BrutalCard
              title={<span className="text-sm">Waiting on you</span>}
              action={<span className="font-mono text-[11px] font-bold text-primary">{pendingApprovals.length}</span>}
            >
              <div className="space-y-1.5">
                {pendingApprovals.map((approval) => (
                  <div key={approval.id} className="rounded-lg border border-border bg-primary/5 px-2 py-1.5">
                    <p className="text-[11px] font-bold uppercase">{approval.title}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{approval.action}</p>
                  </div>
                ))}
                <Link href="/inbox" className="block pt-1 font-mono text-[10px] uppercase text-primary underline">
                  Handle in inbox
                </Link>
              </div>
            </BrutalCard>
          )}
        </div>

        <BrutalCard
          title={<span className="text-sm">Board</span>}
          action={<span className="font-mono text-[11px] font-bold text-muted-foreground">{tasks.length} tasks</span>}
        >
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {COLUMNS.map((column) => {
              const columnTasks = tasks.filter((task) => task.status === column.key);
              return (
                <div key={column.key} className="flex flex-col rounded-lg border border-border bg-muted/20">
                  <div className="flex items-center justify-between border-b-2 border-border bg-muted/60 px-1.5 py-1">
                    <span className="font-mono text-[10px] font-bold uppercase">{column.label}</span>
                    <span className="font-mono text-[10px] font-bold tabular-nums">{columnTasks.length}</span>
                  </div>
                  <div className="flex-1 space-y-1 p-1">
                    {columnTasks.length === 0 && (
                      <p className="px-1 py-2 text-center font-mono text-[10px] uppercase text-muted-foreground">Empty</p>
                    )}
                    {columnTasks.map((task) => {
                      const owner = staff.find((member) => member.id === task.agentId);
                      return (
                        <div key={task.id} className="rounded-lg border border-border bg-card px-1.5 py-1">
                          <p className="text-[11px] font-bold leading-snug">{task.title}</p>
                          <div className="mt-1 flex items-center gap-1">
                            {owner && <span className="font-mono text-[10px] uppercase text-muted-foreground">{owner.name}</span>}
                            <select
                              value={task.status}
                              onChange={(event) => updateTask.mutate({ taskId: task.id, data: { status: event.target.value as never } })}
                              aria-label={`Move ${task.title}`}
                              className="ml-auto border border-border bg-background px-0.5 font-mono text-[10px] uppercase outline-none"
                            >
                              {COLUMNS.map((option) => (
                                <option key={option.key} value={option.key}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </BrutalCard>
      </div>
    </div>
  );
}
