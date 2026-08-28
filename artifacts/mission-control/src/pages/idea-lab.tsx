import {
  getListAgentsQueryKey,
  getListApprovalsQueryKey,
  getListMissionPlansQueryKey,
  getListProjectsQueryKey,
  getListTasksQueryKey,
  useCreateMissionPlan,
  useListMissionPlans,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, ClipboardList, FileText, Lightbulb, Loader2, ShieldAlert, Sparkles, Users } from "lucide-react";
import { Link } from "wouter";
import type { ComponentType } from "react";
import { useState } from "react";
import { BrutalBadge, BrutalButton, BrutalCard } from "../components/ui/brutal";

const messageFor = (error: unknown, fallback: string) =>
  error && typeof error === "object" && "message" in error
    ? String((error as { message?: unknown }).message || fallback)
    : fallback;

type PlanningOutput = {
  icon: ComponentType<{ size?: number; className?: string }>;
  title: string;
  detail: string;
};

const planningOutputs: PlanningOutput[] = [
  { icon: Lightbulb, title: "Project brief", detail: "Your original words become the project directive." },
  { icon: Users, title: "Lead operative", detail: "A waiting owner is assigned so work has a clear home." },
  { icon: ClipboardList, title: "Starter loop", detail: "Three small tasks are queued instead of one vague ambition." },
  { icon: ShieldAlert, title: "Human checkpoint", detail: "A pending approval pauses outside action until you decide." },
];

export function IdeaLab() {
  const queryClient = useQueryClient();
  const plansQuery = useListMissionPlans({
    query: { queryKey: getListMissionPlansQueryKey(), refetchOnMount: "always" },
  });
  const createPlan = useCreateMissionPlan({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListMissionPlansQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListAgentsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListApprovalsQueryKey() });
      },
    },
  });
  const [brainDump, setBrainDump] = useState("");
  const [projectName, setProjectName] = useState("");
  const [leadName, setLeadName] = useState("");
  const [leadRole, setLeadRole] = useState("");
  const [showDetails, setShowDetails] = useState(false);

  const submit = () => {
    if (brainDump.trim().length < 12) return;
    createPlan.mutate({
      data: {
        brainDump: brainDump.trim(),
        ...(projectName.trim() ? { projectName: projectName.trim() } : {}),
        ...(leadName.trim() ? { leadName: leadName.trim() } : {}),
        ...(leadRole.trim() ? { leadRole: leadRole.trim() } : {}),
      },
    }, {
      onSuccess: () => {
        setBrainDump("");
        setProjectName("");
        setLeadName("");
        setLeadRole("");
        setShowDetails(false);
      },
    });
  };

  const plans = plansQuery.data ?? [];

  return (
    <div className="space-y-8">
      <header className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
        <div className="max-w-3xl">
          <div className="mb-2 flex items-center gap-2 font-mono text-xs font-black uppercase tracking-widest text-primary">
            <Lightbulb size={15} /> main-agent planning desk
          </div>
          <h1 className="text-4xl font-black uppercase tracking-tighter md:text-5xl">Idea Lab</h1>
          <p className="mt-2 font-mono text-lg text-muted-foreground">
            Drop in the rough thought. The main agent will shape it into a project, a lead, a starter loop, and a checkpoint for you to approve.
          </p>
        </div>
        <div className="border-4 border-border bg-accent/20 px-4 py-3 font-mono text-xs font-black uppercase shadow-[4px_4px_0px_0px_hsl(var(--border))]">
          <Sparkles className="mr-2 inline text-accent-foreground" size={16} /> Human stays in control
        </div>
      </header>

      <div className="grid gap-8 xl:grid-cols-[1.15fr_.85fr]">
        <BrutalCard
          title={<span className="flex items-center gap-2"><FileText size={18} /> Brain dump</span>}
          className="border-primary bg-primary/5"
        >
          <p className="mb-4 max-w-2xl font-mono text-sm text-muted-foreground">
            Write what you are thinking in plain language. Include the customer, the problem, or the outcome if you know it. Messy is useful here.
          </p>
          <textarea
            data-testid="idea-brain-dump"
            aria-describedby="idea-brain-dump-help"
            value={brainDump}
            onChange={(event) => setBrainDump(event.target.value)}
            rows={8}
            placeholder="Example: I want a lightweight way for independent creators to understand which sponsorship invoices are late and what to chase first..."
            className="w-full resize-y border-4 border-border bg-card p-4 font-mono text-sm leading-relaxed focus:outline-none focus:ring-4 focus:ring-primary/20"
          />
          <div id="idea-brain-dump-help" className="mt-3 flex flex-wrap items-center justify-between gap-3 font-mono text-xs text-muted-foreground">
            <span data-testid="idea-brain-dump-validation">{brainDump.trim().length}/12 minimum characters</span>
            <button type="button" data-testid="idea-details-toggle" onClick={() => setShowDetails((open) => !open)} className="font-black uppercase underline">
              {showDetails ? "Hide optional shaping" : "Add optional names"}
            </button>
          </div>
          {showDetails && (
            <div className="mt-4 grid gap-4 border-4 border-border bg-muted/40 p-4 md:grid-cols-3">
              <label className="text-xs font-black uppercase">Project name<input data-testid="idea-project-name" value={projectName} onChange={(event) => setProjectName(event.target.value)} placeholder="Auto-name if blank" className="mt-2 w-full border-4 border-border bg-card p-2 font-mono text-sm font-normal normal-case focus:outline-none" /></label>
              <label className="text-xs font-black uppercase">Lead callsign<input data-testid="idea-lead-name" value={leadName} onChange={(event) => setLeadName(event.target.value)} placeholder="SCOUT" className="mt-2 w-full border-4 border-border bg-card p-2 font-mono text-sm font-normal normal-case focus:outline-none" /></label>
              <label className="text-xs font-black uppercase">Lead role<input data-testid="idea-lead-role" value={leadRole} onChange={(event) => setLeadRole(event.target.value)} placeholder="Idea lead" className="mt-2 w-full border-4 border-border bg-card p-2 font-mono text-sm font-normal normal-case focus:outline-none" /></label>
            </div>
          )}
          {createPlan.isError && <div data-testid="idea-plan-error" className="mt-4 border-4 border-destructive bg-destructive/10 p-3 font-mono text-sm text-destructive">{messageFor(createPlan.error, "The idea could not be shaped. Keep the draft and try again.")}</div>}
          {createPlan.data && (
            <div data-testid="idea-plan-success" className="mt-4 border-4 border-primary bg-primary/10 p-4 font-mono text-sm">
              <div className="flex items-center gap-2 font-black uppercase"><Check size={17} /> Plan saved. Nothing dispatches until you approve the checkpoint.</div>
              <p className="mt-2">{createPlan.data.summary}</p>
              <Link href="/approvals" className="mt-3 inline-flex items-center gap-2 font-black uppercase underline">Review checkpoint <ShieldAlert size={15} /></Link>
            </div>
          )}
          <BrutalButton
            data-testid="idea-shape-button"
            className="mt-5 w-full sm:w-auto"
            disabled={createPlan.isPending || brainDump.trim().length < 12}
            onClick={submit}
          >
            {createPlan.isPending ? <><Loader2 size={16} className="animate-spin" /> Shaping plan...</> : <><Sparkles size={16} /> Shape this idea</>}
          </BrutalButton>
        </BrutalCard>

        <BrutalCard title="What gets created" className="h-fit">
          <div className="space-y-3">
            {planningOutputs.map(({ icon: ItemIcon, title, detail }) => {
              return <div key={title} className="flex gap-3 border-b-2 border-border pb-3 last:border-0 last:pb-0"><ItemIcon className="mt-0.5 shrink-0 text-primary" size={18} /><div><div className="font-black uppercase">{title}</div><p className="mt-1 font-mono text-xs text-muted-foreground">{detail}</p></div></div>;
            })}
          </div>
          <div className="mt-5 border-l-4 border-accent bg-accent/10 p-3 font-mono text-xs">
            The plan is deliberately conservative: it organizes the next loop, but it never contacts people, publishes, spends money, or changes an outside service by itself.
          </div>
        </BrutalCard>
      </div>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b-4 border-border pb-2">
          <div><h2 className="text-2xl font-black uppercase tracking-tight">Saved idea plans</h2><p className="mt-1 font-mono text-sm text-muted-foreground">Every plan remains visible after reload so you can pick up the next loop later.</p></div>
          <span data-testid="idea-plan-count" className="font-mono text-xs font-black uppercase text-muted-foreground">{plans.length} recorded</span>
        </div>
        {plansQuery.isLoading && <div className="flex items-center gap-2 border-4 border-dashed border-border p-6 font-mono text-sm"><Loader2 size={16} className="animate-spin" /> Reading the planning desk...</div>}
        {plansQuery.isError && <div className="border-4 border-destructive bg-destructive/10 p-5 font-mono text-sm text-destructive">Saved plans are unavailable right now. Your existing projects and approvals are unchanged.</div>}
        {!plansQuery.isLoading && !plansQuery.isError && plans.length === 0 && <div data-testid="idea-plans-empty" className="border-4 border-dashed border-border bg-muted/30 p-10 text-center font-mono text-sm text-muted-foreground">NO IDEAS SHAPED YET. YOUR NEXT ROUGH NOTE CAN START THE FIRST LOOP.</div>}
        <div data-testid="idea-plans-list" className="grid gap-5 lg:grid-cols-2">
          {plans.map((plan) => (
            <div key={plan.id} data-testid={`idea-plan-${plan.id}`} className="border-4 border-border bg-card p-4 shadow-[4px_4px_0px_0px_hsl(var(--border))]">
              <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-xl font-black uppercase">{plan.projectName}</h3><p className="mt-1 font-mono text-xs text-muted-foreground">{new Date(plan.createdAt).toLocaleString()}</p></div><BrutalBadge variant="secondary">CHECKPOINT PENDING</BrutalBadge></div>
              <p className="mt-4 border-l-4 border-primary bg-muted/40 p-3 font-mono text-sm leading-relaxed">{plan.brainDump}</p>
              <div className="mt-4 grid grid-cols-2 gap-3 text-xs font-mono"><div className="border-2 border-border p-2"><span className="font-black uppercase text-muted-foreground">Owner</span><div className="mt-1 font-bold">{plan.agentName} / {plan.agentRole}</div></div><div className="border-2 border-border p-2"><span className="font-black uppercase text-muted-foreground">Starter tasks</span><div className="mt-1 font-bold">{plan.taskIds.length} queued</div></div></div>
              <div className="mt-4 flex flex-wrap gap-3"><Link href="/projects" className="border-2 border-border px-3 py-2 text-xs font-black uppercase hover:bg-muted">Open project</Link><Link href="/approvals" className="border-2 border-destructive bg-destructive/10 px-3 py-2 text-xs font-black uppercase text-destructive hover:bg-destructive hover:text-destructive-foreground">Review approval</Link></div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}