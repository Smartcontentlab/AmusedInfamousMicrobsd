import React from "react";
import { cn } from "@/lib/utils";

export function BrutalCard({ title, children, className, action }: { title?: React.ReactNode, children: React.ReactNode, className?: string, action?: React.ReactNode }) {
   return (
      <div className={cn("flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md", className)}>
         {title && (
            <div className="flex items-center justify-between border-b border-border bg-muted/40 px-3 py-2">
               <h3 className="text-sm font-bold uppercase tracking-tight">{title}</h3>
               {action && <div>{action}</div>}
            </div>
         )}
         <div className="flex flex-1 flex-col p-3">{children}</div>
      </div>
   );
}

export function BrutalButton({ children, className, variant = 'primary', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'accent' | 'destructive' | 'default' | 'outline' }) {
   const variants = {
      primary: "bg-primary text-primary-foreground border border-transparent shadow-sm hover:brightness-110",
      secondary: "bg-secondary text-secondary-foreground border border-transparent shadow-sm hover:brightness-105",
      accent: "bg-accent text-accent-foreground border border-transparent shadow-sm hover:brightness-105",
      destructive: "bg-destructive text-destructive-foreground border border-transparent shadow-sm hover:brightness-110",
      default: "bg-card text-foreground border border-border shadow-sm hover:bg-muted",
      outline: "bg-transparent text-foreground border border-border hover:bg-muted",
   };

   return (
      <button
         className={cn("inline-flex items-center justify-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold uppercase transition-all active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-ring/30", variants[variant], className)}
         {...props}
      >
         {children}
      </button>
   );
}

export function BrutalBadge({ children, className, variant = 'default' }: { children: React.ReactNode, className?: string, variant?: 'primary' | 'secondary' | 'accent' | 'destructive' | 'default' }) {
   const variants = {
      primary: "bg-primary/15 text-primary",
      secondary: "bg-secondary/25 text-foreground",
      accent: "bg-accent/40 text-accent-foreground",
      destructive: "bg-destructive/15 text-destructive",
      default: "bg-muted text-muted-foreground",
   };

   return (
      <span className={cn("inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase", variants[variant], className)}>
         {children}
      </span>
   );
}
