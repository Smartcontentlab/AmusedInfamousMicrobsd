import { useGetAgentRun, useListApprovals, useListRuntimeHealth, useUpdateApproval, getListApprovalsQueryKey } from "@workspace/api-client-react";
import { BrutalCard, BrutalButton, BrutalBadge } from "../components/ui/brutal";
import { useQueryClient } from "@tanstack/react-query";
import { Check, X, Edit3, ArrowRight, ShieldAlert, Loader2, RefreshCw } from "lucide-react";

function ApprovalLiveState({ agentId, health }: { agentId: number; health: Array<{ id: number; status: string; nextAction: string; errorMessage: string | null }> }) {
   const { data: run, isLoading } = useGetAgentRun(agentId, { query: { queryKey: ["agent-run", agentId], refetchInterval: 5000 } });
   const runtime = run ? health.find((item) => item.id === run.connectionId) : undefined;
   return (
      <div className="mt-4 grid gap-3 border-2 border-border bg-background/60 p-3 sm:grid-cols-2" data-testid={`approval-live-state-${agentId}`}>
         <div>
            <div className="text-[11px] font-black uppercase text-muted-foreground">Live run</div>
            <div className="mt-1 flex items-center gap-2 font-mono text-sm font-bold">
               <BrutalBadge variant={run?.status === "failed" ? "destructive" : run ? "primary" : "default"}>{isLoading ? "checking" : run?.status || "no active run"}</BrutalBadge>
               {run?.lastEvent && <span className="truncate">{run.lastEvent}</span>}
            </div>
         </div>
         <div>
            <div className="text-[11px] font-black uppercase text-muted-foreground">Runtime next action</div>
            <div className="mt-1 font-mono text-xs">{runtime?.errorMessage || runtime?.nextAction || "No linked runtime snapshot."}</div>
         </div>
      </div>
   );
}

export function Approvals() {
   const { data: approvals, isLoading, isError, error, refetch } = useListApprovals({ query: { queryKey: getListApprovalsQueryKey(), refetchInterval: 10000 } });
   const { data: runtimeHealth } = useListRuntimeHealth({ query: { queryKey: ["runtime-health"], refetchInterval: 10000 } });
   const queryClient = useQueryClient();

   const updateApproval = useUpdateApproval({
      mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListApprovalsQueryKey() }) }
   });

   const handleAction = (id: number, status: 'approved' | 'rejected' | 'changes_requested' | 'handed_off') => {
      updateApproval.mutate({ approvalId: id, data: { status } });
   };

   if (isLoading) return <div className="space-y-4 p-2 font-mono font-bold"><div className="h-10 w-1/2 animate-pulse bg-muted" /><div className="h-48 animate-pulse border-4 border-border bg-muted/50" /><div className="h-32 animate-pulse border-4 border-border bg-muted/50" /></div>;
   if (isError) return <div className="border-4 border-destructive bg-destructive/10 p-8"><h1 className="text-2xl font-black uppercase">Clearance feed interrupted</h1><p className="mt-2 font-mono text-sm">{error instanceof Error ? error.message : "Approval requests are unavailable."}</p><BrutalButton data-testid="approvals-retry-button" variant="destructive" className="mt-5" onClick={() => refetch()}><RefreshCw size={16} /> Retry feed</BrutalButton></div>;

   const pending = approvals?.filter(a => a.status === 'pending') || [];
   const resolved = approvals?.filter(a => a.status !== 'pending') || [];

   return (
      <div className="space-y-8">
         <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="max-w-xl">
               <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter">Human Clearance</h1>
               <p className="text-muted-foreground font-mono mt-2 text-lg">High-risk agent actions requiring explicit founder authorization.</p>
            </div>
            <div className="bg-destructive text-destructive-foreground font-black uppercase text-xl px-4 py-2 border-4 border-border shadow-[4px_4px_0px_0px_hsl(var(--border))]">
               {pending.length} PENDING
            </div>
         </div>

         {pending.length > 0 && (
            <div className="space-y-6">
               <h2 className="text-2xl font-black uppercase tracking-tight flex items-center gap-3">
                  <ShieldAlert className="text-destructive" size={28} /> ACTION REQUIRED
               </h2>
               <div className="grid grid-cols-1 gap-6">
                  {pending.map(approval => (
                     <BrutalCard key={approval.id} className={approval.risk === 'high' ? 'border-destructive bg-destructive/5' : ''}>
                        <div className="flex flex-col lg:flex-row gap-6">
                           <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                 <BrutalBadge variant={approval.risk === 'high' ? 'destructive' : approval.risk === 'medium' ? 'secondary' : 'primary'}>
                                    {approval.risk} RISK
                                 </BrutalBadge>
                                 <span className="font-mono text-sm font-bold text-muted-foreground uppercase">{new Date(approval.createdAt).toLocaleString()}</span>
                              </div>
                              <h3 className="text-2xl font-black uppercase tracking-tight mb-2">{approval.title}</h3>
                              <p className="font-mono text-lg mb-4 p-4 bg-card border-4 border-border shadow-inner">
                                 {approval.action}
                              </p>
                              <div className="text-sm font-medium leading-relaxed bg-muted/50 p-4 border-l-4 border-border">
                                 <span className="font-bold uppercase text-xs block mb-1">Context / Details:</span>
                                 {approval.details}
                              </div>
                              <ApprovalLiveState agentId={approval.agentId} health={runtimeHealth || []} />
                           </div>
                           
                           <div className="w-full lg:w-64 flex flex-col gap-3 shrink-0 justify-center">
                               <BrutalButton data-testid={`approval-approve-${approval.id}`} variant="primary" disabled={updateApproval.isPending} onClick={() => handleAction(approval.id, 'approved')} className="flex items-center justify-center gap-2 py-4">
                                  {updateApproval.isPending ? <Loader2 size={20} className="animate-spin" /> : <Check size={20} />} APPROVE
                              </BrutalButton>
                               <BrutalButton data-testid={`approval-reject-${approval.id}`} variant="destructive" disabled={updateApproval.isPending} onClick={() => handleAction(approval.id, 'rejected')} className="flex items-center justify-center gap-2 py-4">
                                 <X size={20} /> REJECT
                              </BrutalButton>
                               <BrutalButton data-testid={`approval-changes-${approval.id}`} variant="secondary" disabled={updateApproval.isPending} onClick={() => handleAction(approval.id, 'changes_requested')} className="flex items-center justify-center gap-2 py-4">
                                 <Edit3 size={20} /> REQUEST CHANGES
                              </BrutalButton>
                               <BrutalButton data-testid={`approval-handoff-${approval.id}`} variant="default" disabled={updateApproval.isPending} onClick={() => handleAction(approval.id, 'handed_off')} className="flex items-center justify-center gap-2 py-4">
                                 <ArrowRight size={20} /> HAND OFF
                              </BrutalButton>
                               {updateApproval.isError && <p className="font-mono text-xs text-destructive">Action failed. Retry when the link is restored.</p>}
                           </div>
                        </div>
                     </BrutalCard>
                  ))}
               </div>
            </div>
         )}

          {pending.length === 0 && (
             <div data-testid="approvals-empty" className="p-12 border-4 border-dashed border-border bg-muted/30 text-center flex flex-col items-center justify-center gap-4">
               <ShieldAlert className="text-muted-foreground opacity-50" size={48} />
               <div className="font-mono font-bold text-muted-foreground text-xl uppercase tracking-widest">NO PENDING CLEARANCES</div>
               <p className="text-sm">All agent actions are currently operating within autonomous bounds.</p>
            </div>
         )}

         {resolved.length > 0 && (
            <div className="mt-16 space-y-6">
               <h2 className="text-2xl font-black uppercase tracking-tight text-muted-foreground">Clearance History</h2>
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {resolved.map(approval => (
                     <BrutalCard key={approval.id} className="opacity-75 hover:opacity-100 bg-muted/30">
                        <div className="flex justify-between items-start mb-2">
                           <BrutalBadge variant="default" className="bg-background">
                              {approval.status.replace('_', ' ')}
                           </BrutalBadge>
                           <span className="font-mono text-xs font-bold text-muted-foreground uppercase">{new Date(approval.resolvedAt || approval.createdAt).toLocaleDateString()}</span>
                        </div>
                        <h3 className="font-black uppercase tracking-tight text-lg mb-2">{approval.title}</h3>
                        <p className="font-mono text-sm text-muted-foreground line-clamp-2">
                           {approval.action}
                        </p>
                     </BrutalCard>
                  ))}
               </div>
            </div>
         )}
      </div>
   );
}
