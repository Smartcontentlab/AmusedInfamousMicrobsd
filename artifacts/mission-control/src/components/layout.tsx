import { Link, useLocation } from "wouter";
import { LayoutDashboard, Folder, Zap, Swords, Inbox } from "lucide-react";
import React from "react";
import { useListRuntimeHealth } from "@workspace/api-client-react";

const NAV_ITEMS = [
  { href: "/", icon: LayoutDashboard, label: "Home" },
  { href: "/inbox", icon: Inbox, label: "Inbox" },
  { href: "/projects", icon: Folder, label: "Projects" },
  { href: "/skills", icon: Zap, label: "Skills" },
  { href: "/arena", icon: Swords, label: "Game show" },
];

function NavItem({ href, icon: Icon, label, active }: { href: string; icon: React.ElementType; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold uppercase transition-all md:text-sm ${
        active
          ? "border-border bg-primary text-primary-foreground shadow-sm"
          : "border-transparent text-muted-foreground hover:border-border hover:bg-card hover:text-foreground hover:shadow-md"
      }`}
    >
      <Icon size={18} />
      <span>{label}</span>
    </Link>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const runtimeHealth = useListRuntimeHealth({ query: { queryKey: ["runtime-health"], refetchInterval: 10000 } });
  const healthItems = Array.isArray(runtimeHealth.data) ? runtimeHealth.data : [];
  const healthy = healthItems.filter((item) => item.status === "healthy").length;

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background font-sans text-foreground">
      <header className="z-10 shrink-0 border-b border-border bg-card shadow-sm">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-2 md:px-6">
          <div className="flex min-w-0 max-w-full flex-1 items-center gap-4">
            <Link href="/" className="shrink-0">
              <h1 className="text-xl font-bold uppercase tracking-tighter text-primary md:text-2xl">MC//SYS</h1>
            </Link>
            <nav className="flex min-w-0 gap-1 overflow-x-auto">

              {NAV_ITEMS.map((item) => (
                <NavItem
                  key={item.href}
                  {...item}
                  active={item.href === "/" ? location === "/" : location === item.href || location.startsWith(`${item.href}/`)}
                />
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 font-mono text-xs font-bold tracking-tight">
              <div
                className={`h-3 w-3 rounded-lg border border-border ${runtimeHealth.isError ? "bg-destructive" : "bg-accent"} ${runtimeHealth.isLoading ? "" : "animate-pulse"}`}
              />
              <span className="hidden sm:inline">{runtimeHealth.isError ? "LINK DEGRADED" : "LIVE LINK"}</span>
            </div>
            <div
              data-testid="layout-runtime-status"
              className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-2 py-1 font-mono text-[11px] font-bold uppercase"
            >
              <span className="text-muted-foreground">runtime</span>
              <span className={runtimeHealth.isError ? "text-destructive" : "text-primary"}>
                {runtimeHealth.isLoading ? "probing" : `${healthy}/${healthItems.length || "—"}`}
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-auto bg-[radial-gradient(hsl(var(--muted-foreground)/0.3)_2px,transparent_2px)] p-4 [background-size:24px_24px] md:p-8">
        <div className="mx-auto max-w-[1600px]">{children}</div>
      </main>
    </div>
  );
}
