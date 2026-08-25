import React from "react";
import { cn } from "@/lib/utils";

export function BrutalCard({ title, children, className, action }: { title?: React.ReactNode, children: React.ReactNode, className?: string, action?: React.ReactNode }) {
   return (
      <div className={cn("border-4 border-border bg-card shadow-[6px_6px_0px_0px_hsl(var(--border))] flex flex-col transition-all hover:translate-x-1 hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_hsl(var(--border))]", className)}>
         {title && (
            <div className="border-b-4 border-border px-4 py-3 bg-muted/50 flex justify-between items-center">
               <h3 className="font-black uppercase tracking-tight text-lg">{title}</h3>
               {action && <div>{action}</div>}
            </div>
         )}
         <div className="p-4 flex-1 flex flex-col">{children}</div>
      </div>
   );
}

export function BrutalButton({ children, className, variant = 'primary', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'accent' | 'destructive' | 'default' | 'outline' }) {
   const variants = {
      primary: "bg-primary text-primary-foreground border-4 border-border shadow-[4px_4px_0px_0px_hsl(var(--border))] hover:translate-x-1 hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_hsl(var(--border))] active:translate-x-0 active:translate-y-0 active:shadow-none",
      secondary: "bg-secondary text-secondary-foreground border-4 border-border shadow-[4px_4px_0px_0px_hsl(var(--border))] hover:translate-x-1 hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_hsl(var(--border))] active:translate-x-0 active:translate-y-0 active:shadow-none",
      accent: "bg-accent text-accent-foreground border-4 border-border shadow-[4px_4px_0px_0px_hsl(var(--border))] hover:translate-x-1 hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_hsl(var(--border))] active:translate-x-0 active:translate-y-0 active:shadow-none",
      destructive: "bg-destructive text-destructive-foreground border-4 border-border shadow-[4px_4px_0px_0px_hsl(var(--border))] hover:translate-x-1 hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_hsl(var(--border))] active:translate-x-0 active:translate-y-0 active:shadow-none",
      default: "bg-card text-foreground border-4 border-border shadow-[4px_4px_0px_0px_hsl(var(--border))] hover:bg-muted hover:translate-x-1 hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_hsl(var(--border))] active:translate-x-0 active:translate-y-0 active:shadow-none",
      outline: "bg-transparent text-foreground border-4 border-border hover:bg-muted hover:translate-x-1 hover:-translate-y-1 hover:shadow-[4px_4px_0px_0px_hsl(var(--border))] active:translate-x-0 active:translate-y-0 active:shadow-none",
   };
   
   return (
      <button 
         className={cn("font-bold uppercase px-4 py-2 transition-all disabled:opacity-50 disabled:pointer-events-none focus:outline-none focus:ring-4 focus:ring-primary/20", variants[variant], className)}
         {...props}
      >
         {children}
      </button>
   );
}

export function BrutalBadge({ children, className, variant = 'default' }: { children: React.ReactNode, className?: string, variant?: 'primary' | 'secondary' | 'accent' | 'destructive' | 'default' }) {
   const variants = {
      primary: "bg-primary text-primary-foreground border-2 border-border",
      secondary: "bg-secondary text-secondary-foreground border-2 border-border",
      accent: "bg-accent text-accent-foreground border-2 border-border",
      destructive: "bg-destructive text-destructive-foreground border-2 border-border",
      default: "bg-card text-foreground border-2 border-border",
   };
   
   return (
      <span className={cn("text-xs font-black uppercase px-2 py-0.5 inline-flex items-center justify-center", variants[variant], className)}>
         {children}
      </span>
   );
}
