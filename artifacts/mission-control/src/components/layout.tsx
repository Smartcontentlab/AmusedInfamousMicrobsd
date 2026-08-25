import { Link, useLocation } from "wouter";
import { LayoutDashboard, Folder, Users, Zap, Swords } from "lucide-react";
import React from "react";

function NavItem({ href, icon: Icon, label, active }: any) {
   return (
      <Link href={href} className={`flex items-center gap-3 px-4 py-3 border-4 font-bold uppercase transition-all ${active ? 'border-border bg-primary text-primary-foreground shadow-[4px_4px_0px_0px_hsl(var(--border))]' : 'border-transparent text-muted-foreground hover:border-border hover:bg-card hover:text-foreground hover:shadow-[4px_4px_0px_0px_hsl(var(--border))]'}`}>
         <Icon size={20} />
         <span>{label}</span>
      </Link>
   )
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="min-h-screen flex bg-background font-sans text-foreground">
      {/* Sidebar */}
      <aside className="w-64 border-r-4 border-border bg-sidebar flex flex-col shadow-[4px_0_0_0_hsl(var(--border))] z-10 relative shrink-0">
         <div className="p-6 border-b-4 border-border bg-card">
            <h1 className="text-3xl font-black uppercase tracking-tighter text-primary">MC//SYS</h1>
            <p className="text-xs font-mono text-muted-foreground font-bold mt-1">OPERATIONS HUB</p>
         </div>
         <nav className="flex-1 flex flex-col p-4 gap-2">
           <NavItem href="/" icon={LayoutDashboard} label="Overview" active={location === "/"} />
           <NavItem href="/projects" icon={Folder} label="Projects" active={location === "/projects"} />
           <NavItem href="/agents" icon={Users} label="Agents" active={location === "/agents"} />
           <NavItem href="/skills" icon={Zap} label="Skills" active={location === "/skills"} />
           <NavItem href="/arena" icon={Swords} label="Arena" active={location === "/arena"} />
         </nav>
      </aside>
      
      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
         {/* Header */}
         <header className="h-16 border-b-4 border-border bg-card flex items-center px-6 shadow-[0_4px_0_0_hsl(var(--border))] z-0 shrink-0">
           <div className="font-mono text-sm tracking-tight font-bold flex items-center gap-2">
             <div className="w-3 h-3 rounded-none border-2 border-border bg-accent animate-pulse" />
             LIVE LINK ACTIVE
           </div>
         </header>
         
         {/* Scrollable Canvas */}
         <div className="flex-1 overflow-auto p-8 bg-[radial-gradient(hsl(var(--muted-foreground)/0.3)_2px,transparent_2px)] [background-size:24px_24px]">
           <div className="max-w-7xl mx-auto">
             {children}
           </div>
         </div>
      </main>
    </div>
  );
}
