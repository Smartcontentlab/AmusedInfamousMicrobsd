import { useListSkills, useCreateSkill, getListSkillsQueryKey } from "@workspace/api-client-react";
import { BrutalCard, BrutalButton, BrutalBadge } from "../components/ui/brutal";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Zap, Link as LinkIcon } from "lucide-react";
import { Link } from "wouter";

export function Skills() {
   const { data: skills, isLoading } = useListSkills();
   const queryClient = useQueryClient();

   const createSkill = useCreateSkill({
      mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListSkillsQueryKey() }) }
   });

   const [showNew, setShowNew] = useState(false);
   const [newSkill, setNewSkill] = useState({ name: '', description: '', category: '' });

   const handleCreate = () => {
      if (newSkill.name && newSkill.description && newSkill.category) {
         createSkill.mutate({ data: newSkill });
         setShowNew(false);
         setNewSkill({ name: '', description: '', category: '' });
      }
   };

   if (isLoading) return <div className="p-8 font-mono font-bold animate-pulse text-2xl uppercase">Downloading Skill Packs...</div>;

   return (
      <div className="space-y-8">
         <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="max-w-xl">
              <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter">Skill Repository</h1>
              <p className="text-muted-foreground font-mono mt-2 text-lg">Reusable capabilities that can be loaded into any agent to expand their operational capacity.</p>
            </div>
            <BrutalButton onClick={() => setShowNew(!showNew)} className="flex items-center gap-2">
              <Zap size={18} /> Compile Skill
            </BrutalButton>
         </div>

         <div className="border-4 border-accent bg-accent/10 p-4 shadow-[4px_4px_0px_0px_hsl(var(--accent))] flex items-center gap-4 font-mono font-bold text-sm">
            <LinkIcon className="text-accent shrink-0" />
            <p>Skill modules compiled here act as templates. They must be explicitly attached to individual agents via the <Link href="/agents" className="underline text-accent hover:text-foreground transition-colors">Operative Roster</Link> to take effect.</p>
         </div>

         {showNew && (
           <BrutalCard title="Compile New Skill Pack" className="bg-accent/10 border-dashed border-accent">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 <div>
                    <label className="block font-bold text-sm mb-2 uppercase">Skill Name</label>
                    <input 
                      className="w-full border-4 border-border bg-card p-3 font-mono focus:outline-none focus:ring-4 focus:ring-accent/20" 
                      value={newSkill.name} 
                      onChange={e => setNewSkill({...newSkill, name: e.target.value})} 
                      placeholder="e.g. TailwindCSS Mastery" 
                    />
                 </div>
                 <div>
                    <label className="block font-bold text-sm mb-2 uppercase">Category</label>
                    <input 
                      className="w-full border-4 border-border bg-card p-3 font-mono focus:outline-none focus:ring-4 focus:ring-accent/20" 
                      value={newSkill.category} 
                      onChange={e => setNewSkill({...newSkill, category: e.target.value})} 
                      placeholder="e.g. Frontend" 
                    />
                 </div>
                 <div className="md:col-span-3">
                    <label className="block font-bold text-sm mb-2 uppercase">Execution Protocol (Plain Language)</label>
                    <textarea 
                      className="w-full border-4 border-border bg-card p-3 font-mono focus:outline-none focus:ring-4 focus:ring-accent/20" 
                      rows={3} 
                      value={newSkill.description} 
                      onChange={e => setNewSkill({...newSkill, description: e.target.value})} 
                      placeholder="Explain what the agent is capable of doing once this skill is equipped..." 
                    />
                 </div>
              </div>
              <div className="mt-6 flex gap-3">
                 <BrutalButton onClick={handleCreate} variant="secondary" disabled={!newSkill.name || !newSkill.description || !newSkill.category}>Compile & Store</BrutalButton>
                 <BrutalButton variant="default" onClick={() => setShowNew(false)}>Cancel</BrutalButton>
              </div>
           </BrutalCard>
         )}

         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {skills?.map(skill => (
               <BrutalCard key={skill.id} className="flex flex-col h-full group">
                  <div className="flex justify-between items-start mb-4">
                     <h3 className="font-black text-2xl uppercase tracking-tight pr-2">{skill.name}</h3>
                     <BrutalBadge variant={skill.enabled ? 'accent' : 'default'}>{skill.enabled ? 'ACTIVE' : 'OFFLINE'}</BrutalBadge>
                  </div>
                  <div className="text-xs font-bold text-muted-foreground uppercase border-b-4 border-border pb-2 mb-4">
                     CLASS: {skill.category}
                  </div>
                  <p className="font-mono text-sm flex-1 leading-relaxed text-foreground/80 bg-muted/30 p-3 border-4 border-border shadow-inner">
                     {skill.description}
                  </p>
                  
                  <div className="mt-4 pt-4 border-t-4 border-border text-center">
                     <Link href="/agents" className="text-xs font-black uppercase text-muted-foreground hover:text-accent flex items-center justify-center gap-2 transition-colors">
                        Manage Attachments <LinkIcon size={12} />
                     </Link>
                  </div>
               </BrutalCard>
            ))}

            {skills?.length === 0 && (
               <div className="col-span-full p-12 border-4 border-dashed border-border text-center font-mono font-bold text-muted-foreground text-lg">
                  NO SKILLS COMPILED IN REPOSITORY.
               </div>
            )}
         </div>
      </div>
   );
}