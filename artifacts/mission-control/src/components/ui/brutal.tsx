import React from "react";

export function BrutalCard({ children, className = "", title, badge }: any) {
  return (
    <div className={`border-4 border-border bg-card shadow-[4px_4px_0px_0px_hsl(var(--border))] flex flex-col ${className}`}>
       {(title || badge) && (
         <div className="border-b-4 border-border px-4 py-3 flex justify-between items-center bg-muted/50">
           {title && <h3 className="font-bold uppercase tracking-tight">{title}</h3>}
           {badge && <span className="text-xs font-bold bg-primary text-primary-foreground px-2 py-1 border-2 border-border shadow-[2px_2px_0px_0px_hsl(var(--border))]">{badge}</span>}
         </div>
       )}
       <div className="p-4 flex-1 flex flex-col">
         {children}
       </div>
    </div>
  )
}

export function BrutalButton({ children, variant = "primary", className = "", disabled, ...props }: any) {
   const bg = disabled ? "bg-muted text-muted-foreground cursor-not-allowed opacity-50" : 
              variant === "primary" ? "bg-primary text-primary-foreground hover:-translate-y-1 hover:-translate-x-1" : 
              variant === "secondary" ? "bg-secondary text-secondary-foreground hover:-translate-y-1 hover:-translate-x-1" : 
              variant === "destructive" ? "bg-destructive text-destructive-foreground hover:-translate-y-1 hover:-translate-x-1" : 
              variant === "accent" ? "bg-accent text-accent-foreground hover:-translate-y-1 hover:-translate-x-1" :
              "bg-card text-foreground hover:-translate-y-1 hover:-translate-x-1 hover:bg-muted";
              
   return (
     <button disabled={disabled} className={`border-4 border-border font-bold uppercase px-4 py-2 shadow-[4px_4px_0px_0px_hsl(var(--border))] transition-all active:shadow-none active:translate-y-[4px] active:translate-x-[4px] ${bg} ${className}`} {...props}>
       {children}
     </button>
   )
}

export function BrutalBadge({ children, variant = "default", className = "" }: any) {
   const bg = variant === "primary" ? "bg-primary text-primary-foreground" : 
              variant === "secondary" ? "bg-secondary text-secondary-foreground" : 
              variant === "destructive" ? "bg-destructive text-destructive-foreground" : 
              variant === "accent" ? "bg-accent text-accent-foreground" : 
              "bg-muted text-muted-foreground";
   return (
     <span className={`px-2 py-1 text-xs font-bold uppercase border-2 border-border shadow-[2px_2px_0px_0px_hsl(var(--border))] ${bg} ${className}`}>
        {children}
     </span>
   )
}
