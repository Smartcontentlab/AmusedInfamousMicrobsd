import { Link, useLocation } from "wouter";
import { LayoutDashboard, Folder, Users, Zap, Swords, CheckSquare } from "lucide-react";
import React from "react";
import { useListRuntimeHealth } from "@workspace/api-client-react";

function NavItem({ href, icon: Icon, label, active }: any) {
   return (
      <Link href={href} className={`flex shrink-0 items-center gap-2 px-3 py-2 border-4 font-bold uppercase transition-all md:gap-3 md:px-4 md:py-3 ${active ? 'border-border bg-primary text-primary-foreground shadow-[4px_4px_0px_0px_hsl(var(--border))]' : 'border-transparent text-muted-foreground hover:border-border hover:bg-card hover:text-foreground hover:shadow-[4px_4px_0px_0px_hsl(var(--border))]'}`}>
         <Icon size={20} />
          <span className="text-xs md:text-base">{label}</span>
      </Link>
   )
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const runtimeHealth = useListRuntimeHealth({ query: { queryKey: ["runtime-health"], refetchInterval: 10000 } });
  const healthItems = Array.isArray(runtimeHealth.data) ? runtimeHealth.data : [];
  const healthy = healthItems.filter((item) => item.status === "healthy").length;

  return (
     <div className="min-h-[100dvh] flex flex-col bg-background font-sans text-foreground md:flex-row">
      {/* Sidebar */}
      <aside className="z-10 flex w-full shrink-0 flex-col border-b-4 border-border bg-sidebar shadow-[0_4px_0_0_hsl(var(--border))] md:w-64 md:border-r-4 md:border-b-0 md:shadow-[4px_0_0_0_hsl(var(--border))]">
          <div className="flex items-center justify-between border-b-4 border-border bg-card px-4 py-3 md:block md:p-6">
             <h1 className="text-2xl font-black uppercase tracking-tighter text-primary md:text-3xl">MC//SYS</h1>
             <p className="text-xs font-mono text-muted-foreground font-bold md:mt-1">OPERATIONS HUB</p>
         </div>
          <nav className="flex gap-2 overflow-x-auto p-2 md:flex-1 md:flex-col md:p-4">
           <NavItem href="/" icon={LayoutDashboard} label="Overview" active={location === "/"} />
           <NavItem href="/projects" icon={Folder} label="Projects" active={location === "/projects"} />
           <NavItem href="/agents" icon={Users} label="Staff + approvals" active={location === "/agents"} />
           <NavItem href="/skills" icon={Zap} label="Skills" active={location === "/skills"} />
           <NavItem href="/approvals" icon={CheckSquare} label="Approvals" active={location === "/approvals"} />
           <NavItem href="/arena" icon={Swords} label="Arena" active={location === "/arena"} />
         </nav>
      </aside>
      
      {/* Main Content */}
      <main className="flex flex-1 flex-col overflow-hidden md:h-screen">
         {/* Header */}
           <header className="flex min-h-14 shrink-0 flex-wrap items-center justify-between gap-3 border-b-4 border-border bg-card px-4 py-2 shadow-[0_4px_0_0_hsl(var(--border))] md:min-h-16 md:px-6">
            <div className="flex items-center gap-2 font-mono text-sm font-bold tracking-tight">
              <div className={`h-3 w-3 rounded-none border-2 border-border ${runtimeHealth.isError ? "bg-destructive" : "bg-accent"} ${runtimeHealth.isLoading ? "" : "animate-pulse"}`} />
              {runtimeHealth.isError ? "RUNTIME LINK DEGRADED" : "LIVE LINK ACTIVE"}
            </div>
            <div data-testid="layout-runtime-status" className="flex items-center gap-2 border-2 border-border bg-muted/40 px-2 py-1 font-mono text-[11px] font-black uppercase">
              <span className="text-muted-foreground">runtime</span>
              <span className={runtimeHealth.isError ? "text-destructive" : "text-primary"}>{runtimeHealth.isLoading ? "probing" : `${healthy}/${healthItems.length || "—"} healthy`}</span>
            </div>
         </header>
         
         {/* Scrollable Canvas */}
          <div className="flex-1 overflow-auto p-4 bg-[radial-gradient(hsl(var(--muted-foreground)/0.3)_2px,transparent_2px)] [background-size:24px_24px] md:p-8">
           <div className="max-w-7xl mx-auto">
             {children}
           </div>
         </div>
      </main>
    </div>
  );
}
