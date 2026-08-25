import { useListAgents, useListProjects, useCreateAgent, useUpdateAgent, getListAgentsQueryKey, useListSkills, useListAgentCapabilities, useAttachAgentCapability, useDetachAgentCapability, getListAgentCapabilitiesQueryKey, Agent, Project, Skill } from "@workspace/api-client-react";
import { BrutalCard, BrutalButton, BrutalBadge } from "../components/ui/brutal";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { UserPlus, Users, Power, PowerOff, Monitor, Cpu, Workflow, Lightbulb, Play, Pause } from "lucide-react";

function AgentCard({ agent, projects, skills }: { agent: Agent, projects: Project[], skills: Skill[] }) {
   const queryClient = useQueryClient();
   const { data: capabilities, isLoading: capLoading } = useListAgentCapabilities(agent.id);
   
   const updateAgent = useUpdateAgent({
      mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListAgentsQueryKey() }) }
   });
   
   const attachSkill = useAttachAgentCapability({
      mutation: { 
         onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListAgentCapabilitiesQueryKey(agent.id) });
            queryClient.invalidateQueries({ queryKey: getListAgentsQueryKey() });
         }
      }
   });
   
   const detachSkill = useDetachAgentCapability({
      mutation: { 
         onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListAgentCapabilitiesQueryKey(agent.id) });
            queryClient.invalidateQueries({ queryKey: getListAgentsQueryKey() });
         }
      }
   });

   const togglePause = () => {
      const newStatus = agent.status === 'working' ? 'offline' : 'working';
      updateAgent.mutate({ agentId: agent.id, data: { status: newStatus } });
   };

   // Find skills that aren't already attached
   const availableSkills = skills.filter(s => !capabilities?.some(c => c.skillId === s.id));

   return (
      <BrutalCard className="relative group flex flex-col h-full bg-card">
         <div className="absolute top-4 right-4 flex gap-2">
            <BrutalBadge variant={agent.status === 'working' ? 'primary' : agent.status === 'blocked' ? 'destructive' : agent.status === 'offline' ? 'default' : 'secondary'}>
               {agent.status}
            </BrutalBadge>
         </div>
         
         <div className="flex gap-5 items-center border-b-4 border-border pb-5 mb-5">
            <div className="w-16 h-16 border-4 border-border bg-accent flex items-center justify-center shadow-[4px_4px_0px_0px_hsl(var(--border))] group-hover:-translate-y-1 transition-transform shrink-0">
               <Cpu size={32} className="text-accent-foreground" />
            </div>
            <div className="overflow-hidden">
               <h2 className="text-2xl font-black uppercase tracking-tight truncate">{agent.name}</h2>
               <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <p className="font-mono font-bold text-xs text-muted-foreground uppercase">{agent.role}</p>
                  <span className="text-muted-foreground/50 text-xs">///</span>
                  <p className="font-mono font-bold text-xs text-primary uppercase">{agent.provider || 'default'}</p>
               </div>
            </div>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="p-3 bg-muted/30 border-4 border-border space-y-2">
               <div className="flex items-center gap-2 text-xs font-bold uppercase text-muted-foreground border-b-4 border-border pb-1">
                  <Monitor size={14} /> Room / Compute
               </div>
               <div className="font-mono text-sm font-bold">{agent.room || 'UNASSIGNED'}</div>
               <div className="font-mono text-xs">{agent.computerStatus || 'NO STATUS'}</div>
            </div>
            
            <div className="p-3 bg-muted/30 border-4 border-border space-y-2">
               <div className="flex items-center gap-2 text-xs font-bold uppercase text-muted-foreground border-b-4 border-border pb-1">
                  <Lightbulb size={14} /> Venture
               </div>
               <div className="font-mono text-sm font-bold truncate" title={agent.businessIdea || ''}>{agent.businessIdea || 'AWAITING IDEA'}</div>
               <div className="font-mono text-xs uppercase text-secondary">{agent.phase || 'IDLE'}</div>
            </div>
         </div>

         <div className="mb-6">
            <div className="flex items-center gap-2 text-xs font-bold uppercase text-muted-foreground border-b-4 border-border pb-1 mb-2">
               <Workflow size={14} /> Current Operation
            </div>
            <div className="font-mono text-sm leading-relaxed p-3 border-4 border-border bg-card shadow-inner truncate" title={agent.currentTask || "Idle / Awaiting Instructions"}>
               {agent.currentTask || "Idle / Awaiting Instructions"}
            </div>
            {agent.nextMove && (
               <div className="font-mono text-xs mt-2 text-muted-foreground flex gap-2">
                  <span className="font-bold uppercase">NEXT:</span>
                  <span className="truncate" title={agent.nextMove}>{agent.nextMove}</span>
               </div>
            )}
         </div>

         <div className="mb-6 flex-1">
            <div className="flex justify-between items-end border-b-4 border-border pb-1 mb-3">
               <label className="block font-bold text-xs uppercase text-muted-foreground">Capabilities</label>
               <div className="font-mono text-xs font-black">{agent.skillCount} ATTACHED</div>
            </div>
            
            <div className="space-y-2 mb-3 max-h-32 overflow-y-auto pr-2">
               {capLoading ? (
                  <div className="text-xs font-mono text-muted-foreground animate-pulse">Loading modules...</div>
               ) : capabilities?.length ? (
                  capabilities.map(cap => (
                     <div key={cap.id} className="flex justify-between items-center bg-card border-2 border-border p-2">
                        <div className="font-mono text-xs font-bold truncate">{cap.name}</div>
                        <button 
                           onClick={() => detachSkill.mutate({ agentId: agent.id, skillId: cap.skillId })}
                           className="text-destructive hover:bg-destructive hover:text-destructive-foreground px-2 font-black border-2 border-transparent hover:border-destructive transition-colors text-xs"
                           title="Detach Skill"
                        >
                           X
                        </button>
                     </div>
                  ))
               ) : (
                  <div className="text-xs font-mono text-muted-foreground border-2 border-dashed border-border p-2 text-center">NO MODULES ATTACHED</div>
               )}
            </div>

            {availableSkills.length > 0 && (
               <div className="flex gap-2">
                  <select 
                     id={`skill-select-${agent.id}`}
                     className="flex-1 border-4 border-border p-1 text-xs font-mono bg-card cursor-pointer focus:outline-none"
                     defaultValue=""
                  >
                     <option value="" disabled>ATTACH MODULE...</option>
                     {availableSkills.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                     ))}
                  </select>
                  <BrutalButton 
                     variant="accent" 
                     className="py-1 px-3 text-xs"
                     onClick={() => {
                        const select = document.getElementById(`skill-select-${agent.id}`) as HTMLSelectElement;
                        if (select && select.value) {
                           attachSkill.mutate({ agentId: agent.id, data: { skillId: parseInt(select.value) } });
                           select.value = "";
                        }
                     }}
                  >
                     +
                  </BrutalButton>
               </div>
            )}
         </div>

         <div className="bg-muted/50 p-4 border-4 border-border flex flex-col gap-3 mt-auto">
            <div className="flex justify-between items-center">
               <span className="font-bold text-xs uppercase">Power State</span>
               <BrutalButton variant={agent.status === 'working' ? 'default' : 'primary'} className="py-1 px-3 flex items-center gap-2 text-xs" onClick={togglePause}>
                  {agent.status === 'working' ? <><Pause size={12}/> PAUSE</> : <><Play size={12}/> RESUME</>}
               </BrutalButton>
            </div>
            <div className="flex flex-col gap-1">
               <span className="font-bold text-xs uppercase">Assignment</span>
               <select 
                  className="border-4 border-border p-2 text-sm font-mono font-bold bg-card w-full cursor-pointer focus:outline-none"
                  value={agent.projectId || ''}
                  onChange={(e) => updateAgent.mutate({ agentId: agent.id, data: { projectId: e.target.value ? parseInt(e.target.value) : undefined } })}
               >
                  <option value="">-- UNASSIGNED --</option>
                  {projects?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
               </select>
            </div>
         </div>
      </BrutalCard>
   );
}

export function Agents() {
   const { data: agents, isLoading: agentsLoading } = useListAgents();
   const { data: projects, isLoading: projectsLoading } = useListProjects();
   const { data: skills, isLoading: skillsLoading } = useListSkills();
   const queryClient = useQueryClient();

   const createAgent = useCreateAgent({
      mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListAgentsQueryKey() }) }
   });

   const [showNew, setShowNew] = useState(false);
   const [newAgent, setNewAgent] = useState({ name: '', role: '', projectId: '', provider: '' });

   const handleCreate = () => {
      if (newAgent.name && newAgent.role) {
         createAgent.mutate({ data: { 
            name: newAgent.name, 
            role: newAgent.role, 
            projectId: newAgent.projectId ? parseInt(newAgent.projectId) : undefined,
            provider: newAgent.provider || undefined
         }});
         setShowNew(false);
         setNewAgent({ name: '', role: '', projectId: '', provider: '' });
      }
   };

   if (agentsLoading || projectsLoading || skillsLoading) return <div className="p-8 font-mono font-bold animate-pulse text-2xl uppercase">Scanning Roster...</div>;

   return (
      <div className="space-y-8">
         <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="max-w-xl">
              <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter">Operative Roster</h1>
              <p className="text-muted-foreground font-mono mt-2 text-lg">Assign roles, manage capabilities, and monitor state for all autonomous actors.</p>
            </div>
            <BrutalButton onClick={() => setShowNew(!showNew)} className="flex items-center gap-2">
              <UserPlus size={18} /> Spawn Operative
            </BrutalButton>
         </div>

         {showNew && (
           <BrutalCard title="Instantiate New Agent" className="bg-primary/10 border-dashed border-primary">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
                      placeholder="e.g. Architect" 
                    />
                 </div>
                 <div>
                    <label className="block font-bold text-sm mb-2 uppercase">LLM Provider</label>
                    <input 
                      className="w-full border-4 border-border bg-card p-3 font-mono focus:outline-none focus:ring-4 focus:ring-primary/20" 
                      value={newAgent.provider} 
                      onChange={e => setNewAgent({...newAgent, provider: e.target.value})} 
                      placeholder="e.g. anthropic" 
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

         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 items-stretch">
            {agents?.map(agent => (
               <AgentCard key={agent.id} agent={agent} projects={projects || []} skills={skills || []} />
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