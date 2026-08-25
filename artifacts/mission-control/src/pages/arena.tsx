import { useGetArena, useAdvanceArena, getGetArenaQueryKey } from "@workspace/api-client-react";
import { BrutalCard, BrutalButton, BrutalBadge } from "../components/ui/brutal";
import { useQueryClient } from "@tanstack/react-query";
import { Swords, Play, Pause, FastForward, RotateCcw, Trophy, Monitor, Cpu, Code2, Banknote, MapPin, Zap } from "lucide-react";

export function Arena() {
   const { data: arena, isLoading } = useGetArena();
   const queryClient = useQueryClient();

   const advance = useAdvanceArena({
      mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetArenaQueryKey() }) }
   });

   const handleAction = (action: 'start' | 'pause' | 'advance' | 'reset') => {
      advance.mutate({ data: { action } });
   };

   if (isLoading) return <div className="p-8 font-mono font-bold animate-pulse text-2xl uppercase">Connecting to Arena Server...</div>;

   return (
      <div className="space-y-8 pb-12">
         <div className="flex justify-between items-start md:items-center">
            <div className="max-w-3xl">
              <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter flex items-center gap-4">
                 <Swords className="text-destructive drop-shadow-md" size={48} /> BuildOff Arena
              </h1>
              <p className="text-muted-foreground font-mono mt-4 text-lg border-l-4 border-destructive pl-4">
                 The ultimate testing ground. Watch agents compete in real-time to maximize revenue and hit win conditions before the timer runs out.
              </p>
            </div>
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
               <BrutalButton variant="destructive" onClick={() => handleAction('start')} disabled={arena?.status === 'live' || arena?.status === 'complete'} className="flex items-center gap-2 flex-1 md:flex-none justify-center">
                  <Play size={18} /> START MATCH
               </BrutalButton>
               <BrutalButton variant="secondary" onClick={() => handleAction('pause')} disabled={arena?.status !== 'live'} className="flex items-center gap-2 flex-1 md:flex-none justify-center">
                  <Pause size={18} /> PAUSE
               </BrutalButton>
               <BrutalButton variant="accent" onClick={() => handleAction('advance')} className="flex items-center gap-2 bg-accent text-accent-foreground flex-1 md:flex-none justify-center">
                  <FastForward size={18} /> ADVANCE TICK
               </BrutalButton>
               <BrutalButton variant="default" onClick={() => handleAction('reset')} className="flex items-center gap-2 md:ml-auto flex-1 md:flex-none justify-center">
                  <RotateCcw size={18} /> RESET ARENA
               </BrutalButton>
            </div>
         </BrutalCard>

         {/* The House / Contestants */}
         <div className="mt-12 space-y-6">
            <h2 className="text-3xl font-black uppercase tracking-tighter border-b-4 border-border pb-2 flex justify-between items-end">
               Contestant Houses
               <span className="text-base font-mono text-muted-foreground">LIVE FEED</span>
            </h2>
            
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
               {arena?.scores?.sort((a, b) => b.score - a.score).map((score, idx) => (
                  <div key={score.agentId} className={`border-8 ${idx === 0 && arena.status !== 'ready' ? 'border-accent shadow-[8px_8px_0_hsl(var(--accent))]' : 'border-border shadow-[8px_8px_0_hsl(var(--border))]'} bg-card relative overflow-hidden transition-all hover:-translate-y-1`}>
                     
                     {/* Leader Banner */}
                     {idx === 0 && arena.status !== 'ready' && (
                        <div className="absolute top-4 -right-12 bg-accent text-accent-foreground font-black uppercase text-xs py-1 px-12 rotate-45 border-y-4 border-border shadow-sm z-10">
                           LEADER
                        </div>
                     )}

                     {/* Room Header */}
                     <div className="flex border-b-8 border-border">
                        <div className={`p-6 flex-1 flex flex-col justify-center ${idx === 0 && arena.status !== 'ready' ? 'bg-accent/10' : 'bg-muted/30'}`}>
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