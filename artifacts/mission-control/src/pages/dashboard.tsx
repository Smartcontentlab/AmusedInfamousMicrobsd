import { useGetDashboard, useHealthCheck, useListTasks, useListAgents, useListProjects, useCreateTask, getListTasksQueryKey, useListApprovals } from "@workspace/api-client-react";
import { BrutalCard, BrutalButton, BrutalBadge } from "../components/ui/brutal";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Activity, AlertTriangle, ShieldCheck, ShieldAlert, ArrowRight } from "lucide-react";
import { Link } from "wouter";

export function Dashboard() {
  const { data: dashboard, isLoading: dashLoading } = useGetDashboard();
  const { data: health, isLoading: healthLoading } = useHealthCheck();
  const { data: tasks, isLoading: tasksLoading } = useListTasks();
  const { data: agents, isLoading: agentsLoading } = useListAgents();
  const { data: projects, isLoading: projectsLoading } = useListProjects();
  const { data: approvals, isLoading: approvalsLoading } = useListApprovals();

  const queryClient = useQueryClient();
  const createTask = useCreateTask({
     mutation: {
       onSuccess: () => {
         setCommand("");
         queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
       }
     }
  });

  const [command, setCommand] = useState("");

  if (dashLoading || healthLoading || tasksLoading || agentsLoading || projectsLoading || approvalsLoading) {
     return <div className="p-8 font-mono font-bold animate-pulse text-2xl uppercase">Initiating Systems...</div>;
  }

  const pendingApprovals = approvals?.filter(a => a.status === 'pending') || [];

  return (
    <div className="space-y-8">
       {/* Header / Health */}
       <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
         <div>
           <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter shadow-sm">Command Overview</h1>
           <p className="text-muted-foreground font-mono mt-2 text-lg">Real-time status of all autonomous units.</p>
         </div>
         <div className="flex items-center gap-3 border-4 border-border bg-card px-4 py-3 shadow-[4px_4px_0px_0px_hsl(var(--border))]">
            <span className="font-bold uppercase text-sm">Main System:</span>
            {health?.status === 'ok' ? (
               <span className="flex items-center gap-2 text-green-600 font-bold"><ShieldCheck size={20}/> ONLINE</span>
            ) : (
               <span className="flex items-center gap-2 text-destructive font-bold"><AlertTriangle size={20}/> OFFLINE</span>
            )}
         </div>
       </div>

       {/* Human Clearances Banner */}
       {pendingApprovals.length > 0 && (
          <div className="border-4 border-destructive bg-destructive/10 p-6 shadow-[6px_6px_0px_0px_hsl(var(--destructive))] flex flex-col md:flex-row justify-between items-center gap-6">
             <div className="flex items-center gap-4">
                <ShieldAlert size={40} className="text-destructive animate-pulse shrink-0" />
                <div>
                   <h2 className="text-2xl font-black uppercase text-destructive tracking-tight">Human Clearance Required</h2>
                   <p className="font-mono text-sm font-bold text-foreground/80 mt-1">
                      {pendingApprovals.length} high-risk agent {pendingApprovals.length === 1 ? 'action is' : 'actions are'} paused awaiting your explicit authorization.
                   </p>
                </div>
             </div>
             <Link href="/approvals" className="shrink-0 bg-destructive text-destructive-foreground font-black uppercase px-6 py-3 border-4 border-border shadow-[4px_4px_0px_0px_hsl(var(--border))] hover:translate-x-1 hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_hsl(var(--border))] transition-all flex items-center gap-2">
                Review Clearances <ArrowRight size={20} />
             </Link>
          </div>
       )}

       {/* Metrics */}
       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <BrutalCard title="Monthly Income" className="border-l-8 border-l-primary">
            <div className="text-4xl font-black font-mono text-primary">${((dashboard?.monthlyIncomeCents || 0) / 100).toFixed(2)}</div>
            <p className="text-xs mt-3 text-muted-foreground font-bold uppercase">Total revenue generated</p>
          </BrutalCard>
          <BrutalCard title="Runway" className="border-l-8 border-l-secondary">
            <div className="text-4xl font-black font-mono text-secondary">{dashboard?.runwayDays} DAYS</div>
            <p className="text-xs mt-3 text-muted-foreground font-bold uppercase">Estimated survival time</p>
          </BrutalCard>
          <BrutalCard title="Velocity" className="border-l-8 border-l-accent">
            <div className="text-4xl font-black font-mono text-accent">{dashboard?.velocityPercent}%</div>
            <p className="text-xs mt-3 text-muted-foreground font-bold uppercase">Task completion rate</p>
          </BrutalCard>
          <BrutalCard title="Active Agents" className="border-l-8 border-l-[#8b5cf6]">
            <div className="text-4xl font-black font-mono text-[#8b5cf6]">{dashboard?.activeAgentCount}</div>
            <p className="text-xs mt-3 text-muted-foreground font-bold uppercase">Units currently deployed</p>
          </BrutalCard>
       </div>

       {/* Directive */}
       <div className="border-4 border-border bg-primary/10 p-6 shadow-[6px_6px_0px_0px_hsl(var(--border))] relative overflow-hidden">
          <div className="absolute top-0 right-0 bg-primary text-primary-foreground px-4 py-1 font-bold text-sm border-b-4 border-l-4 border-border">AI DIRECTIVE</div>
          <h2 className="text-2xl font-bold mb-3 flex items-center gap-3 uppercase"><Activity size={28}/> System Recommendation</h2>
          <p className="font-mono text-lg font-medium max-w-4xl">{dashboard?.recommendation}</p>
       </div>

       <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Command Panel */}
          <div className="lg:col-span-2 space-y-6">
             <BrutalCard title="Main Agent Command Panel">
                <div className="text-sm mb-4 space-y-2">
                   <p className="font-bold text-muted-foreground uppercase">Issue direct plain-language instructions to the global orchestrator.</p>
                   <p className="font-mono bg-muted/50 p-2 border-l-4 border-border">
                      <span className="text-primary font-bold">NOTE:</span> The orchestrator handles translation to sub-tasks automatically. Any tasks flagged as destructive or high-risk will automatically pause execution and route to your <Link href="/approvals" className="underline font-bold">Approvals</Link> inbox for human sign-off before proceeding.
                   </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                   <input 
                     className="flex-1 border-4 border-border p-3 font-mono focus:outline-none focus:ring-4 focus:ring-primary/20 bg-card text-foreground" 
                     placeholder="e.g. 'Audit all active projects for cost inefficiencies'"
                     value={command}
                     onChange={(e) => setCommand(e.target.value)}
                   />
                   <BrutalButton 
                     onClick={() => {
                        if (command) {
                          const projId = projects && projects.length > 0 ? projects[0].id : 1;
                          createTask.mutate({ data: { title: command, projectId: projId, priority: 'high' } });
                        }
                     }}
                     disabled={createTask.isPending}
                  >
                     Execute Protocol
                   </BrutalButton>
                </div>
                
                {/* Recent Activity */}
                <div className="mt-8">
                   <h4 className="font-bold text-sm uppercase border-b-4 border-border pb-2 mb-4 bg-muted/50 p-2">Recent Activity Stream</h4>
                   <ul className="space-y-4">
                     {dashboard?.recentActivity?.map((act, i) => (
                       <li key={i} className="font-mono text-sm flex gap-3 items-start p-2 hover:bg-muted/50 transition-colors">
                         <span className="text-primary mt-1">▶</span> 
                         <span className="flex-1">{act}</span>
                       </li>
                     ))}
                   </ul>
                </div>
             </BrutalCard>
             
             <BrutalCard title="Work Queue (Active Tasks)">
                <div className="space-y-3">
                   {tasks?.slice(0, 5).map(task => (
                      <div key={task.id} className="border-4 border-border p-3 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                         <div className="font-mono text-sm font-bold">{task.title}</div>
                         <div className="flex gap-2 shrink-0">
                            <BrutalBadge variant={task.priority === 'high' ? 'destructive' : 'default'}>{task.priority}</BrutalBadge>
                            <BrutalBadge variant={task.status === 'active' ? 'primary' : 'default'}>{task.status}</BrutalBadge>
                         </div>
                      </div>
                   ))}
                   {(!tasks || tasks.length === 0) && (
                      <div className="text-muted-foreground font-mono p-4 text-center border-4 border-dashed border-border">NO TASKS IN QUEUE</div>
                   )}
                </div>
             </BrutalCard>
          </div>

          {/* Agent Health List */}
          <div>
             <BrutalCard title="Agent Live Status">
                <div className="space-y-4">
                   {agents?.map(agent => (
                     <div key={agent.id} className="flex justify-between items-center border-b-4 border-border pb-4 last:border-0 last:pb-0">
                        <div className="overflow-hidden pr-2">
                           <div className="font-black uppercase text-lg truncate">{agent.name}</div>
                           <div className="text-xs font-mono text-muted-foreground font-bold mt-1 truncate">{agent.role}</div>
                        </div>
                        <BrutalBadge variant={agent.status === 'working' ? 'primary' : agent.status === 'blocked' ? 'destructive' : agent.status === 'offline' ? 'default' : 'secondary'}>
                           {agent.status}
                        </BrutalBadge>
                     </div>
                   ))}
                   {(!agents || agents.length === 0) && (
                     <div className="text-muted-foreground font-mono p-4 text-center border-4 border-dashed border-border">NO AGENTS DEPLOYED</div>
                   )}
                </div>
             </BrutalCard>
          </div>
       </div>
    </div>
  );
}