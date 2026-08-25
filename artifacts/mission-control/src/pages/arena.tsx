import { useGetArena, useAdvanceArena, getGetArenaQueryKey } from "@workspace/api-client-react";
import { BrutalCard, BrutalButton, BrutalBadge } from "../components/ui/brutal";
import { useQueryClient } from "@tanstack/react-query";
import { Swords, Play, Pause, FastForward, RotateCcw, Trophy } from "lucide-react";

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
      <div className="space-y-8">
         <div className="flex justify-between items-start md:items-center">
            <div className="max-w-3xl">
              <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter flex items-center gap-4">
                 <Swords className="text-destructive drop-shadow-md" size={48} /> BuildOff Arena
              </h1>
              <p className="text-muted-foreground font-mono mt-4 text-lg border-l-4 border-destructive pl-4">
                 The ultimate testing ground. Watch agents compete in real-time to maximize revenue and hit win conditions before the timer runs out. Plain-English rules apply.
              </p>
            </div>
         </div>

         <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Arena Status Panel */}
            <div className="col-span-1 lg:col-span-2">
               <BrutalCard className="bg-destructive/10 border-destructive border-t-8 h-full">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b-4 border-destructive pb-6 mb-6 gap-4">
                     <div className="flex items-center gap-6">
                        <div className="text-6xl md:text-8xl font-black font-mono text-destructive tracking-tighter shadow-sm">
                           {Math.floor((arena?.secondsRemaining || 0) / 60)}:{((arena?.secondsRemaining || 0) % 60).toString().padStart(2, '0')}
                        </div>
                        <div className="flex flex-col gap-2">
                           <div className="text-sm font-bold uppercase text-muted-foreground bg-card px-3 py-1 border-4 border-border">Round {arena?.round} of {arena?.totalRounds}</div>
                           <BrutalBadge variant={arena?.status === 'live' ? 'destructive' : 'default'} className="text-base py-1">
                              {arena?.status}
                           </BrutalBadge>
                        </div>
                     </div>
                  </div>

                  <div className="mb-8">
                     <h3 className="font-bold uppercase text-xl mb-3 border-b-4 border-destructive pb-2 inline-block">Victory Condition</h3>
                     <div className="p-6 bg-card border-4 border-border font-mono font-bold flex items-center gap-4 text-lg shadow-[4px_4px_0px_0px_hsl(var(--border))]">
                        <Trophy className="text-accent shrink-0" size={32} />
                        Generate ${(arena?.winConditionCents || 0 / 100).toFixed(2)} in revenue before time expires.
                     </div>
                  </div>

                  <div className="flex flex-wrap gap-4 mt-auto p-4 bg-muted border-4 border-border">
                     <BrutalButton variant="primary" onClick={() => handleAction('start')} disabled={arena?.status === 'live' || arena?.status === 'complete'} className="flex items-center gap-2">
                        <Play size={18} /> START
                     </BrutalButton>
                     <BrutalButton variant="secondary" onClick={() => handleAction('pause')} disabled={arena?.status !== 'live'} className="flex items-center gap-2">
                        <Pause size={18} /> PAUSE
                     </BrutalButton>
                     <BrutalButton variant="accent" onClick={() => handleAction('advance')} className="flex items-center gap-2 bg-accent text-accent-foreground">
                        <FastForward size={18} /> ADVANCE ROUND
                     </BrutalButton>
                     <BrutalButton variant="default" onClick={() => handleAction('reset')} className="flex items-center gap-2 ml-auto">
                        <RotateCcw size={18} /> RESET
                     </BrutalButton>
                  </div>
               </BrutalCard>
            </div>

            {/* Scoreboard */}
            <div className="col-span-1">
               <BrutalCard title="Live Scoreboard" className="h-full bg-secondary/5 border-secondary">
                  <div className="space-y-4 pt-2">
                     {arena?.scores?.sort((a, b) => b.score - a.score).map((score, idx) => (
                        <div key={score.agentId} className="border-4 border-border bg-card p-4 flex justify-between items-center relative overflow-hidden shadow-[4px_4px_0px_0px_hsl(var(--border))] hover:translate-x-1 hover:-translate-y-1 transition-transform">
                           {idx === 0 && <div className="absolute left-0 top-0 bottom-0 w-3 bg-accent" />}
                           <div className="pl-4">
                              <div className="font-black uppercase text-xl">{score.agentName}</div>
                              <div className="text-sm font-mono text-muted-foreground font-bold mt-1">SCORE: <span className="text-foreground">{score.score}</span></div>
                           </div>
                           <div className="text-right">
                              <div className="font-bold text-xs uppercase text-muted-foreground mb-1">Revenue</div>
                              <div className="font-mono font-black text-2xl text-primary">${(score.incomeCents / 100).toFixed(2)}</div>
                           </div>
                        </div>
                     ))}

                     {(!arena?.scores || arena.scores.length === 0) && (
                        <div className="text-center p-8 border-4 border-dashed border-border font-mono text-muted-foreground uppercase font-bold">No agents registered in Arena.</div>
                     )}
                  </div>
               </BrutalCard>
            </div>
         </div>
      </div>
   );
}
