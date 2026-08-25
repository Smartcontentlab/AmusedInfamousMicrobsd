import { useListProjects, useCreateProject, useUpdateProject, getListProjectsQueryKey, useListAgents, useListApprovals } from "@workspace/api-client-react";
import { BrutalCard, BrutalButton, BrutalBadge } from "../components/ui/brutal";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Users, ShieldAlert } from "lucide-react";

export function Projects() {
  const { data: projects, isLoading: pLoading } = useListProjects();
  const { data: agents, isLoading: aLoading } = useListAgents();
  const { data: approvals, isLoading: apLoading } = useListApprovals();
  
  const queryClient = useQueryClient();
  
  const createProject = useCreateProject({
     mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() }) }
  });
  const updateProject = useUpdateProject({
     mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() }) }
  });

  const [showNew, setShowNew] = useState(false);
  const [newProj, setNewProj] = useState({ name: '', description: '' });

  const handleCreate = () => {
     if (newProj.name) {
       createProject.mutate({ data: { name: newProj.name, description: newProj.description, status: 'planning' } });
       setShowNew(false);
       setNewProj({ name: '', description: '' });
     }
  };

  if (pLoading || aLoading || apLoading) return <div className="p-8 font-mono font-bold animate-pulse text-2xl uppercase">Loading Portfolio...</div>;

  return (
     <div className="space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
           <div>
             <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter">Project Portfolio</h1>
             <p className="text-muted-foreground font-mono mt-2 text-lg">Manage active deployments, staff assignments, and revenue streams.</p>
           </div>
           <BrutalButton onClick={() => setShowNew(!showNew)} className="flex items-center gap-2">
             <Plus size={18} /> New Project
           </BrutalButton>
        </div>

        {showNew && (
           <BrutalCard title="Deploy New Project" className="bg-secondary/10 border-dashed border-secondary">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div>
                    <label className="block font-bold text-sm mb-2 uppercase">Project Designation</label>
                    <input 
                      className="w-full border-4 border-border bg-card text-foreground p-3 font-mono focus:outline-none focus:ring-4 focus:ring-secondary/20" 
                      value={newProj.name} 
                      onChange={e => setNewProj({...newProj, name: e.target.value})} 
                      placeholder="e.g. Project Apollo" 
                    />
                 </div>
                 <div>
                    <label className="block font-bold text-sm mb-2 uppercase">Objective (Plain Text)</label>
                    <input 
                      className="w-full border-4 border-border bg-card text-foreground p-3 font-mono focus:outline-none focus:ring-4 focus:ring-secondary/20" 
                      value={newProj.description} 
                      onChange={e => setNewProj({...newProj, description: e.target.value})} 
                      placeholder="What does this project do?" 
                    />
                 </div>
              </div>
              <div className="mt-6 flex gap-3">
                 <BrutalButton onClick={handleCreate} disabled={!newProj.name}>Initialize</BrutalButton>
                 <BrutalButton variant="default" onClick={() => setShowNew(false)}>Cancel</BrutalButton>
              </div>
           </BrutalCard>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
           {projects?.map(project => {
              const projectAgents = agents?.filter(a => a.projectId === project.id) || [];
              const pendingApprovals = approvals?.filter(a => a.projectId === project.id && a.status === 'pending') || [];
              
              return (
                 <BrutalCard key={project.id} className="group flex flex-col h-full">
                    <div className="flex justify-between items-start mb-4">
                       <h2 className="text-2xl font-black uppercase tracking-tight truncate pr-4">{project.name}</h2>
                       <BrutalBadge variant={project.status === 'live' ? 'primary' : project.status === 'paused' ? 'destructive' : 'secondary'}>
                          {project.status}
                       </BrutalBadge>
                    </div>
                    
                    <p className="font-mono text-sm mb-6 h-16 overflow-hidden text-ellipsis text-muted-foreground leading-relaxed">
                       {project.description || "No specific directive provided."}
                    </p>
                    
                    <div className="grid grid-cols-2 gap-4 mb-6">
                       <div className="border-4 border-border bg-muted/30 p-3">
                          <div className="text-xs font-bold uppercase text-muted-foreground mb-1 flex items-center gap-1"><Users size={14}/> Staff Assigned</div>
                          <div className="text-2xl font-black font-mono">{projectAgents.length}</div>
                          {projectAgents.length > 0 && (
                             <div className="text-xs font-mono text-muted-foreground mt-1 truncate">
                                {projectAgents.map(a => a.name).join(', ')}
                             </div>
                          )}
                       </div>
                       
                       <div className={`border-4 p-3 ${pendingApprovals.length > 0 ? 'border-destructive bg-destructive/10' : 'border-border bg-muted/30'}`}>
                          <div className={`text-xs font-bold uppercase mb-1 flex items-center gap-1 ${pendingApprovals.length > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                             <ShieldAlert size={14}/> Clearances
                          </div>
                          <div className={`text-2xl font-black font-mono ${pendingApprovals.length > 0 ? 'text-destructive' : ''}`}>{pendingApprovals.length}</div>
                          <div className={`text-xs font-mono mt-1 ${pendingApprovals.length > 0 ? 'text-destructive font-bold animate-pulse' : 'text-muted-foreground'}`}>
                             {pendingApprovals.length > 0 ? 'ACTION REQUIRED' : 'ALL CLEAR'}
                          </div>
                       </div>
                    </div>
                    
                    <div className="flex justify-between items-end border-t-4 border-border pt-4 mt-auto">
                       <div>
                          <div className="text-xs font-bold uppercase text-muted-foreground mb-1">Generated Income</div>
                          <div className="text-2xl font-black text-primary font-mono">${(project.incomeCents / 100).toFixed(2)}</div>
                       </div>
                       <div className="flex flex-col items-end">
                          <label className="text-xs font-bold uppercase text-muted-foreground mb-1">Status Shift</label>
                          <select 
                             className="border-4 border-border p-2 text-sm font-bold bg-card uppercase cursor-pointer hover:bg-muted transition-colors focus:outline-none"
                             value={project.status}
                             onChange={(e) => updateProject.mutate({ projectId: project.id, data: { status: e.target.value as any } })}
                          >
                             <option value="planning">PLANNING</option>
                             <option value="building">BUILDING</option>
                             <option value="review">REVIEW</option>
                             <option value="live">LIVE</option>
                             <option value="paused">PAUSED</option>
                          </select>
                       </div>
                    </div>
                 </BrutalCard>
              );
           })}
           
           {projects?.length === 0 && (
             <div className="col-span-full p-12 border-4 border-dashed border-border text-center font-mono font-bold text-muted-foreground text-lg">
                NO ACTIVE PROJECTS. DEPLOY A NEW PROJECT TO COMMENCE OPERATIONS.
             </div>
           )}
        </div>
     </div>
  );
}