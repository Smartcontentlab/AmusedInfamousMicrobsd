import { useListAgents, useListProjects, useCreateAgent, useUpdateAgent, getListAgentsQueryKey } from "@workspace/api-client-react";
import { BrutalCard, BrutalButton, BrutalBadge } from "../components/ui/brutal";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { UserPlus, Users } from "lucide-react";

export function Agents() {
   const { data: agents, isLoading: agentsLoading } = useListAgents();
   const { data: projects, isLoading: projectsLoading } = useListProjects();
   const queryClient = useQueryClient();

   const createAgent = useCreateAgent({
      mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListAgentsQueryKey() }) }
   });
   const updateAgent = useUpdateAgent({
      mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListAgentsQueryKey() }) }
   });

   const [showNew, setShowNew] = useState(false);
   const [newAgent, setNewAgent] = useState({ name: '', role: '', projectId: '' });

   const handleCreate = () => {
      if (newAgent.name && newAgent.role) {
         createAgent.mutate({ data: { 
            name: newAgent.name, 
            role: newAgent.role, 
            projectId: newAgent.projectId ? parseInt(newAgent.projectId) : undefined 
         }});
         setShowNew(false);
         setNewAgent({ name: '', role: '', projectId: '' });
      }
   };

   if (agentsLoading || projectsLoading) return <div className="p-8 font-mono font-bold animate-pulse text-2xl uppercase">Scanning Roster...</div>;

   return (
      <div className="space-y-8">
         <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="max-w-xl">
              <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter">Operative Roster</h1>
              <p className="text-muted-foreground font-mono mt-2 text-lg">Assign roles, manage skills, and monitor current tasks for all AI agents.</p>
            </div>
            <BrutalButton onClick={() => setShowNew(!showNew)} className="flex items-center gap-2">
              <UserPlus size={18} /> Spawn Agent
            </BrutalButton>
         </div>

         {showNew && (
           <BrutalCard title="Instantiate New Agent" className="bg-primary/10 border-dashed border-primary">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 <div>
                    <label className="block font-bold text-sm mb-2 uppercase">Callsign</label>
                    <input 
                      className="w-full border-4 border-border bg-card p-3 font-mono focus:outline-none focus:ring-4 focus:ring-primary/20" 
                      value={newAgent.name} 
                      onChange={e => setNewAgent({...newAgent, name: e.target.value})} 
                      placeholder="e.g. Unit-01" 
                    />
                 </div>
                 <div>
                    <label className="block font-bold text-sm mb-2 uppercase">Designated Role</label>
                    <input 
                      className="w-full border-4 border-border bg-card p-3 font-mono focus:outline-none focus:ring-4 focus:ring-primary/20" 
                      value={newAgent.role} 
                      onChange={e => setNewAgent({...newAgent, role: e.target.value})} 
                      placeholder="e.g. Frontend Developer" 
                    />
                 </div>
                 <div>
                    <label className="block font-bold text-sm mb-2 uppercase">Initial Assignment</label>
                    <select 
                      className="w-full border-4 border-border p-3 font-mono bg-card cursor-pointer focus:outline-none focus:ring-4 focus:ring-primary/20" 
                      value={newAgent.projectId} 
                      onChange={e => setNewAgent({...newAgent, projectId: e.target.value})}
                    >
                       <option value="">-- UNASSIGNED --</option>
                       {projects?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                 </div>
              </div>
              <div className="mt-6 flex gap-3">
                 <BrutalButton onClick={handleCreate} disabled={!newAgent.name || !newAgent.role}>Instantiate</BrutalButton>
                 <BrutalButton variant="default" onClick={() => setShowNew(false)}>Cancel</BrutalButton>
              </div>
           </BrutalCard>
         )}

         <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {agents?.map(agent => (
               <BrutalCard key={agent.id} className="relative group">
                  <div className="absolute top-4 right-4 flex gap-2">
                     <BrutalBadge variant={agent.status === 'working' ? 'primary' : agent.status === 'blocked' ? 'destructive' : agent.status === 'offline' ? 'default' : 'secondary'}>
                        {agent.status}
                     </BrutalBadge>
                  </div>
                  <div className="flex gap-5 items-center border-b-4 border-border pb-5 mb-5">
                     <div className="w-20 h-20 border-4 border-border bg-accent flex items-center justify-center shadow-[4px_4px_0px_0px_hsl(var(--border))] group-hover:-translate-y-1 transition-transform">
                        <Users size={40} className="text-accent-foreground" />
                     </div>
                     <div>
                        <h2 className="text-3xl font-black uppercase tracking-tight">{agent.name}</h2>
                        <p className="font-mono font-bold text-muted-foreground uppercase">{agent.role}</p>
                     </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6 mb-6">
                     <div>
                        <label className="block font-bold text-xs uppercase text-muted-foreground border-b-4 border-border pb-1 mb-2">Current Task</label>
                        <div className="font-mono text-sm leading-relaxed">{agent.currentTask || "Idle / Awaiting Instructions"}</div>
                     </div>
                     <div>
                        <label className="block font-bold text-xs uppercase text-muted-foreground border-b-4 border-border pb-1 mb-2">Skill Modules</label>
                        <div className="font-mono text-2xl font-black text-primary">{agent.skillCount} ACTIVE</div>
                     </div>
                  </div>

                  <div className="bg-muted p-4 border-4 border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-auto">
                     <span className="font-bold text-sm uppercase">Reassign Directive:</span>
                     <select 
                        className="border-4 border-border p-2 text-sm font-mono font-bold bg-card w-full sm:w-64 cursor-pointer focus:outline-none"
                        value={agent.projectId || ''}
                        onChange={(e) => updateAgent.mutate({ agentId: agent.id, data: { projectId: e.target.value ? parseInt(e.target.value) : undefined } })}
                     >
                        <option value="">-- UNASSIGNED --</option>
                        {projects?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                     </select>
                  </div>
               </BrutalCard>
            ))}

            {agents?.length === 0 && (
               <div className="col-span-full p-12 border-4 border-dashed border-border text-center font-mono font-bold text-muted-foreground text-lg">
                  NO AGENTS INSTANTIATED. SPAWN AN AGENT TO BEGIN.
               </div>
            )}
         </div>
      </div>
   );
}
