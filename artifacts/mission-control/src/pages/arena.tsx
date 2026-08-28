import { useGetArena, useAdvanceArena, getGetArenaQueryKey, useCreateAgent, useListProjects, useListSkills, useEquipAgentSkill, getListAgentsQueryKey } from "@workspace/api-client-react";
import { BrutalCard, BrutalButton, BrutalBadge } from "../components/ui/brutal";
import { useQueryClient } from "@tanstack/react-query";
import { Swords, Play, Pause, FastForward, RotateCcw, Trophy, Monitor, Code2, MapPin, Zap, UserPlus, Loader2, RefreshCw, Wrench, LockKeyhole, UnlockKeyhole } from "lucide-react";
import { useState } from "react";

export function Arena() {
   const { data: arena, isLoading, isError, error, refetch } = useGetArena({ query: { queryKey: getGetArenaQueryKey(), refetchInterval: 5000 } });
   const projectsQuery = useListProjects();
   const skillsQuery = useListSkills();
   const queryClient = useQueryClient();
   const createAgent = useCreateAgent();
   const equipSkill = useEquipAgentSkill();
   const [showSetup, setShowSetup] = useState(false);
   const [contestant, setContestant] = useState({ name: "", role: "", provider: "OpenClaw", projectId: "" });
   const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
   const [setupError, setSetupError] = useState("");

   const advance = useAdvanceArena({
      mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetArenaQueryKey() }) }
   });

   const handleAction = (action: 'start' | 'pause' | 'advance' | 'reset') => {
      advance.mutate({ data: { action } });
   };
   const createContestant = () => {
      if (!contestant.name.trim() || !contestant.role.trim()) return;
      createAgent.mutate({ data: {
         name: contestant.name.trim(),
         role: contestant.role.trim(),
         provider: contestant.provider,
         projectId: contestant.projectId ? Number(contestant.projectId) : undefined,
      } }, {
         onSuccess: async (createdAgent) => {
            try {
               await Promise.all(selectedSkills.map((skillId) => equipSkill.mutateAsync({ agentId: createdAgent.id, skillId: Number(skillId) })));
            } catch {
               setSetupError("Contestant created, but one or more skills could not be equipped. Keep this panel open and use the Staff roster to retry.");
               queryClient.invalidateQueries({ queryKey: getGetArenaQueryKey() });
               queryClient.invalidateQueries({ queryKey: getListAgentsQueryKey() });
               return;
            }
            setContestant({ name: "", role: "", provider: "OpenClaw", projectId: "" });
            setSelectedSkills([]);
            setSetupError("");
            setShowSetup(false);
            queryClient.invalidateQueries({ queryKey: getGetArenaQueryKey() });
            queryClient.invalidateQueries({ queryKey: getListAgentsQueryKey() });
         },
      });
   };

   if (isLoading) return <div className="p-8 font-mono font-bold animate-pulse text-2xl uppercase">Connecting to Arena Server...</div>;
   if (isError) return <div data-testid="arena-error" className="border-4 border-destructive bg-destructive/10 p-8"><h1 className="text-2xl font-black uppercase">Arena feed interrupted</h1><p className="mt-2 font-mono text-sm">{error instanceof Error ? error.message : "The BuildOff state could not be loaded."}</p><BrutalButton data-testid="arena-retry-button" variant="destructive" className="mt-5" onClick={() => refetch()}><RefreshCw size={16} /> Retry feed</BrutalButton></div>;

   return (
      <div className="space-y-8 pb-12">
          <div className="flex flex-col justify-between items-start gap-4 md:flex-row md:items-center">
            <div className="max-w-3xl">
              <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter flex items-center gap-4">
                 <Swords className="text-destructive drop-shadow-md" size={48} /> BuildOff Arena
              </h1>
              <p className="text-muted-foreground font-mono mt-4 text-lg border-l-4 border-destructive pl-4">
                 The ultimate testing ground. Watch agents compete in real-time to maximize revenue and hit win conditions before the timer runs out.
              </p>
          </div>
            <BrutalButton data-testid="arena-setup-toggle" variant="accent" onClick={() => setShowSetup((open) => !open)}><UserPlus size={17} /> Set up contestant</BrutalButton>
         </div>

         {/* Arena Status Panel */}
         <BrutalCard className="bg-destructive/10 border-destructive border-t-8">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center border-b-4 border-destructive pb-6 mb-6 gap-6">
               <div className="flex items-center gap-6">
                  <div className="text-6xl md:text-8xl font-black font-mono text-destructive tracking-tighter shadow-[4px_4px_0_hsl(var(--border))]">
                     {Math.floor((arena?.secondsRemaining || 0) / 60)}:{((arena?.secondsRemaining || 0) % 60).toString().padStart(2, '0')}
                  </div>
                  <div className="flex flex-col gap-3">
                     <div className="text-base font-bold uppercase text-foreground bg-card px-4 py-2 border-4 border-border shadow-[4px_4px_0_hsl(var(--border))]">Round {arena?.round} / {arena?.totalRounds}</div>
                     <BrutalBadge variant={arena?.status === 'live' ? 'destructive' : 'default'} className="text-base py-1.5 shadow-[2px_2px_0_hsl(var(--border))] border-4">
                        {arena?.status}
                     </BrutalBadge>
                  </div>
               </div>
               
               <div className="bg-card border-4 border-border p-4 shadow-[4px_4px_0_hsl(var(--border))] lg:w-96 shrink-0 flex flex-col gap-2">
                  <h3 className="font-bold uppercase text-xs text-muted-foreground flex items-center gap-2">
                     <Trophy size={14} className="text-accent" /> Win Condition
                  </h3>
                  <div className="font-mono font-black text-2xl text-accent">
                     ${((arena?.winConditionCents || 0) / 100).toFixed(2)} REV
                  </div>
               </div>
            </div>

            <div className="flex flex-wrap gap-4 bg-card border-4 border-border p-4 shadow-[4px_4px_0_hsl(var(--border))]">
                <BrutalButton variant="destructive" onClick={() => handleAction('start')} disabled={advance.isPending || arena?.status === 'live' || arena?.status === 'complete'} className="flex items-center gap-2 flex-1 md:flex-none justify-center">
                  <Play size={18} /> START MATCH
               </BrutalButton>
                <BrutalButton variant="secondary" onClick={() => handleAction('pause')} disabled={advance.isPending || arena?.status !== 'live'} className="flex items-center gap-2 flex-1 md:flex-none justify-center">
                  <Pause size={18} /> PAUSE
               </BrutalButton>
                <BrutalButton variant="accent" onClick={() => handleAction('advance')} disabled={advance.isPending} className="flex items-center gap-2 bg-accent text-accent-foreground flex-1 md:flex-none justify-center">
                  <FastForward size={18} /> ADVANCE TICK
               </BrutalButton>
                <BrutalButton variant="default" onClick={() => handleAction('reset')} disabled={advance.isPending} className="flex items-center gap-2 md:ml-auto flex-1 md:flex-none justify-center">
                  <RotateCcw size={18} /> RESET ARENA
               </BrutalButton>
            </div>
             {advance.isPending && <div className="mt-3 flex items-center gap-2 border-2 border-border bg-accent/10 p-2 font-mono text-xs font-bold uppercase"><Loader2 size={14} className="animate-spin" /> Sending arena control signal...</div>}
             {advance.isError && <div data-testid="arena-action-error" className="mt-3 border-2 border-destructive bg-destructive/10 p-2 font-mono text-xs text-destructive">Arena control signal failed. The live feed was not changed; retry when the service is available.</div>}
             {advance.isSuccess && !advance.isPending && <div data-testid="arena-action-success" className="mt-3 border-2 border-primary bg-primary/10 p-2 font-mono text-xs font-bold uppercase">Arena control signal acknowledged. The feed will refresh automatically.</div>}
         </BrutalCard>

          {showSetup && (
             <BrutalCard title={<span className="flex items-center gap-2"><UserPlus size={18} /> Contestant setup</span>} className="border-accent bg-accent/10">
                <p className="mb-4 max-w-3xl font-mono text-sm text-muted-foreground">Create a named contestant and optionally place it on a project. It starts waiting; launch work from the live roster when you are ready.</p>
                 <div className="grid gap-4 md:grid-cols-4">
                   <label className="text-xs font-black uppercase">Callsign<input data-testid="arena-contestant-name" value={contestant.name} onChange={(event) => setContestant({ ...contestant, name: event.target.value })} placeholder="e.g. VECTOR" className="mt-2 w-full border-4 border-border bg-card p-2 font-mono text-sm font-normal normal-case focus:outline-none" /></label>
                   <label className="text-xs font-black uppercase">Specialty<input data-testid="arena-contestant-role" value={contestant.role} onChange={(event) => setContestant({ ...contestant, role: event.target.value })} placeholder="e.g. Growth operator" className="mt-2 w-full border-4 border-border bg-card p-2 font-mono text-sm font-normal normal-case focus:outline-none" /></label>
                   <label className="text-xs font-black uppercase">Provider<select data-testid="arena-contestant-provider" value={contestant.provider} onChange={(event) => setContestant({ ...contestant, provider: event.target.value })} className="mt-2 w-full border-4 border-border bg-card p-2 font-mono text-sm font-normal focus:outline-none"><option value="OpenClaw">OpenClaw</option><option value="Hermes">Hermes</option></select></label>
                   <label className="text-xs font-black uppercase">Project<select data-testid="arena-contestant-project" value={contestant.projectId} onChange={(event) => setContestant({ ...contestant, projectId: event.target.value })} className="mt-2 w-full border-4 border-border bg-card p-2 font-mono text-sm font-normal focus:outline-none"><option value="">No project yet</option>{projectsQuery.data?.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
                   <fieldset className="border-4 border-border bg-card p-3 md:col-span-2">
                      <legend className="px-1 text-xs font-black uppercase">Initial skill loadout</legend>
                      <p className="mb-2 font-mono text-xs font-normal normal-case text-muted-foreground">Skills are equipped locally now. Any runtime installation still waits for approval.</p>
                      <div className="flex flex-wrap gap-2">
                         {skillsQuery.data?.length ? skillsQuery.data.map((skill) => (
                            <label key={skill.id} className="flex cursor-pointer items-center gap-2 border-2 border-border bg-muted/30 px-2 py-1 font-mono text-xs font-bold normal-case hover:bg-accent/20">
                               <input type="checkbox" checked={selectedSkills.includes(String(skill.id))} onChange={(event) => setSelectedSkills((current) => event.target.checked ? [...current, String(skill.id)] : current.filter((id) => id !== String(skill.id)))} />
                               {skill.name}
                            </label>
                         )) : <span className="font-mono text-xs font-normal normal-case text-muted-foreground">No catalog skills available yet.</span>}
                      </div>
                   </fieldset>
                </div>
                {(createAgent.isError || setupError) && <p data-testid="arena-contestant-error" className="mt-3 border-2 border-destructive bg-destructive/10 p-2 font-mono text-xs text-destructive">{setupError || "Contestant could not be created. Keep the details and try again."}</p>}
                <div className="mt-5 flex gap-3"><BrutalButton data-testid="arena-create-contestant" disabled={createAgent.isPending || equipSkill.isPending || !contestant.name.trim() || !contestant.role.trim()} onClick={createContestant}>{createAgent.isPending || equipSkill.isPending ? <><Loader2 size={15} className="animate-spin" /> Preparing...</> : "Add contestant"}</BrutalButton><BrutalButton variant="default" onClick={() => setShowSetup(false)}>Cancel</BrutalButton></div>
             </BrutalCard>
          )}

         {/* The House / Contestants */}
         <div className="mt-12 space-y-6">
            <h2 className="text-3xl font-black uppercase tracking-tighter border-b-4 border-border pb-2 flex justify-between items-end">
               Contestant Houses
               <span className="text-base font-mono text-muted-foreground">LIVE FEED</span>
            </h2>
            
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                {[...(arena?.scores || [])].sort((a, b) => b.score - a.score).map((score, idx) => (
                 <div key={score.agentId} className={`border-8 ${idx === 0 && arena?.status !== 'ready' ? 'border-accent shadow-[8px_8px_0_hsl(var(--accent))]' : 'border-border shadow-[8px_8px_0_hsl(var(--border))]'} bg-card relative overflow-hidden transition-all hover:-translate-y-1`}>
                     
                     {/* Leader Banner */}
                     {idx === 0 && arena?.status !== 'ready' && (
                        <div className="absolute top-4 -right-12 bg-accent text-accent-foreground font-black uppercase text-xs py-1 px-12 rotate-45 border-y-4 border-border shadow-sm z-10">
                           LEADER
                        </div>
                     )}

                     {/* Room Header */}
                     <div className="flex border-b-8 border-border">
                        <div className={`p-6 flex-1 flex flex-col justify-center ${idx === 0 && arena?.status !== 'ready' ? 'bg-accent/10' : 'bg-muted/30'}`}>
                           <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase mb-1">
                              <MapPin size={14} /> {score.room || 'MAIN HALL'}
                           </div>
                           <h3 className="text-4xl font-black uppercase tracking-tighter truncate" title={score.agentName}>{score.agentName}</h3>
                            <div className="flex items-center gap-3 mt-3 flex-wrap">
                              <BrutalBadge variant="primary" className="border-4 shadow-[2px_2px_0_hsl(var(--border))] px-3 py-1 text-sm">{score.phase || 'IDLE'}</BrutalBadge>
                              <div className="flex items-center gap-1 font-mono text-xs font-bold bg-background border-2 border-border px-2 py-1">
                                 <Monitor size={12} className={score.computerStatus?.includes('ONLINE') ? 'text-green-500' : 'text-destructive'} /> 
                                  {score.computerStatus || 'SYS_OFFLINE'}
                              </div>
                               <div className="flex items-center gap-2 border-2 border-border bg-background px-2 py-1 font-mono text-xs font-bold uppercase"><span className={`arena-worker ${score.computerStatus === "idle" ? "arena-worker-idle" : ""}`} /> {score.computerStatus || "idle"}</div>
                           </div>
                        </div>
                        
                        <div className="w-48 shrink-0 border-l-8 border-border bg-card p-6 flex flex-col items-end justify-center">
                           <div className="text-sm font-bold uppercase text-muted-foreground mb-1 text-right">Match Score</div>
                           <div className="text-6xl font-mono font-black tracking-tighter">{score.score}</div>
                        </div>
                     </div>

                     {/* Progress & Metrics */}
                     <div className="grid grid-cols-2 border-b-8 border-border">
                        <div className="p-4 border-r-8 border-border flex flex-col justify-center">
                           <div className="flex justify-between text-xs font-bold uppercase mb-2">
                              <span>First $100</span>
                              <span className="font-mono">{score.progressPercent || 0}%</span>
                           </div>
                           <div className="h-4 w-full bg-muted border-2 border-border relative overflow-hidden">
                              <div 
                                 className="absolute top-0 left-0 bottom-0 bg-primary transition-all duration-500" 
                                 style={{ width: `${score.progressPercent || 0}%` }}
                              />
                           </div>
                        </div>
                        <div className="p-4 flex flex-col justify-center items-end bg-primary/5">
                           <div className="text-xs font-bold uppercase text-muted-foreground mb-1">Total Scale Rev</div>
                           <div className="text-3xl font-mono font-black text-primary">${((score.scaleRevenueCents || score.incomeCents) / 100).toFixed(2)}</div>
                        </div>
                     </div>

                     {/* Action & Status */}
                     <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 bg-card">
                         <div className="space-y-2">
                           <div className="flex items-center gap-2 text-xs font-bold uppercase text-muted-foreground border-b-4 border-border pb-1">
                              <Code2 size={14} /> Startup Idea
                           </div>
                           <div className="font-mono text-sm leading-relaxed min-h-12">
                              {score.businessIdea || "Analyzing market opportunities..."}
                           </div>
                         </div>
                         <div className="space-y-2">
                            <div className="flex items-center gap-2 border-b-4 border-border pb-1 text-xs font-bold uppercase text-muted-foreground"><Wrench size={14} /> Contestant loadout</div>
                            <div className="flex flex-wrap gap-2">
                               {(score.assignedSkills || []).length > 0 ? score.assignedSkills?.map((skill) => <BrutalBadge key={skill} variant="accent">{skill}</BrutalBadge>) : <span className="font-mono text-xs text-muted-foreground">No skills assigned yet. Equip this contestant from the roster.</span>}
                            </div>
                            <div className="font-mono text-xs text-muted-foreground"><span className="font-black uppercase text-foreground">Tool lanes:</span> {(score.tools || []).length > 0 ? score.tools?.join(" / ") : "none reported"}</div>
                        </div>

                         <div className="space-y-2 md:col-span-2">
                            <div className="flex items-center justify-between gap-2 border-b-4 border-border pb-1 text-xs font-bold uppercase text-muted-foreground"><span className="flex items-center gap-2"><UnlockKeyhole size={14} /> Round tool access</span><span>{score.toolAccess?.filter((tool) => tool.available).length ?? 0} / {score.toolAccess?.length ?? 0} allowed</span></div>
                            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                               {score.toolAccess?.map((tool) => (
                                  <div key={tool.key} data-testid={`arena-tool-${score.agentId}-${tool.key}`} className={`border-2 p-2 ${tool.available ? "border-primary bg-primary/5" : "border-destructive/60 bg-destructive/5"}`} title={tool.description}>
                                     <div className="flex items-center gap-1.5 font-mono text-xs font-black">{tool.available ? <UnlockKeyhole size={13} className="text-primary" /> : <LockKeyhole size={13} className="text-destructive" />}{tool.label}</div>
                                     <div className="mt-1 font-mono text-[10px] text-muted-foreground">{tool.available ? `Allowed via ${tool.source}` : tool.unlockCondition}</div>
                                     {tool.overrideReason && <div className="mt-1 font-mono text-[10px]">GM reason: {tool.overrideReason}</div>}
                                  </div>
                               ))}
                            </div>
                         </div>
                        
                        <div className="space-y-2">
                           <div className="flex items-center gap-2 text-xs font-bold uppercase text-muted-foreground border-b-4 border-border pb-1">
                              <Zap size={14} /> Next Move
                           </div>
                           <div className="font-mono text-sm font-bold bg-muted/50 p-3 border-4 border-border shadow-inner min-h-12 truncate" title={score.nextMove || "Calculating..."}>
                              {score.nextMove || "Calculating optimal trajectory..."}
                           </div>
                        </div>
                     </div>
                  </div>
               ))}

               {(!arena?.scores || arena.scores.length === 0) && (
                  <div className="col-span-full p-16 border-8 border-dashed border-border bg-muted/20 text-center flex flex-col items-center justify-center gap-4">
                     <Swords size={64} className="text-muted-foreground opacity-50" />
                     <div className="font-mono font-black text-2xl uppercase tracking-widest text-muted-foreground">THE HOUSE IS EMPTY</div>
                     <p className="font-mono text-sm font-bold max-w-md">Assign agents to the Arena project to watch them compete in the BuildOff simulation.</p>
                  </div>
               )}
            </div>
         </div>
      </div>
   );
}