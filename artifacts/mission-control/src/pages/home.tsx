import { useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Hexagon, Inbox as InboxIcon, Send } from "lucide-react";
import {
  getGetInboxQueryKey,
  useCreateDirectMessage,
  useGetDashboard,
  useGetInbox,
  useListTasks,
} from "@workspace/api-client-react";
import { BrutalCard } from "@/components/ui/brutal";
import { PersonalTodosWidget } from "@/components/personal-todos-widget";
import { WeatherWidget } from "@/components/weather-widget";

function greeting(date: Date) {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

const TASK_STATUSES = [
  { key: "queued", label: "Queued", className: "bg-muted-foreground" },
  { key: "active", label: "Active", className: "bg-primary" },
  { key: "review", label: "Review", className: "bg-secondary" },
  { key: "done", label: "Done", className: "bg-accent" },
];

function AtlasBar() {
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const queryClient = useQueryClient();
  const createMessage = useCreateDirectMessage({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetInboxQueryKey() });
        setSent(true);
        setTimeout(() => setSent(false), 2500);
      },
    },
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const body = message.trim();
    if (!body) return;
    createMessage.mutate({ data: { body } });
    setMessage("");
  };

  return (
    <div className="mx-auto w-full max-w-3xl">
      <form
        onSubmit={submit}
        className="flex items-center gap-3 border-4 border-border bg-card p-2 pl-4 shadow-[6px_6px_0px_0px_hsl(var(--border))] focus-within:ring-4 focus-within:ring-primary/20"
      >
        <Hexagon size={22} className="shrink-0 text-primary" />
        <input
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Ask Atlas anything, or tell it what to delegate..."
          className="min-w-0 flex-1 bg-transparent py-2 text-base font-medium outline-none placeholder:text-muted-foreground"
        />
        <button
          type="submit"
          disabled={!message.trim() || createMessage.isPending}
          className="flex shrink-0 items-center gap-2 border-4 border-border bg-primary px-4 py-2 font-bold uppercase text-primary-foreground shadow-[3px_3px_0px_0px_hsl(var(--border))] transition-all hover:translate-x-0.5 hover:-translate-y-0.5 disabled:opacity-40"
        >
          <Send size={16} />
          <span className="hidden sm:inline">Send</span>
        </button>
      </form>
      <p className="mt-2 text-center font-mono text-[11px] uppercase text-muted-foreground">
        {sent ? "Sent to Atlas — waiting on a runtime link to reply" : "Atlas routes work to your staff agents"}
      </p>
    </div>
  );
}

function InboxWidget() {
  const inbox = useGetInbox({ query: { queryKey: getGetInboxQueryKey(), refetchInterval: 30000 } });
  const needsYou = inbox.data?.needsYou.length ?? 0;
  const needsApproval = inbox.data?.needsApproval.length ?? 0;
  const unread = inbox.data?.directMessages.filter((message) => !message.readAt).length ?? 0;

  const rows = [
    { label: "Needs you", value: needsYou, highlight: needsYou > 0 },
    { label: "Needs approval", value: needsApproval, highlight: needsApproval > 0 },
    { label: "Unread messages", value: unread, highlight: unread > 0 },
  ];

  return (
    <BrutalCard
      title="Inbox"
      action={
        <Link href="/inbox" className="flex items-center gap-1 font-mono text-xs font-black uppercase text-primary hover:underline">
          Open <ArrowRight size={14} />
        </Link>
      }
      className="h-full"
    >
      <div className="flex flex-1 flex-col justify-center gap-2">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between border-2 border-border bg-muted/30 px-3 py-2">
            <span className="font-mono text-xs font-bold uppercase text-muted-foreground">{row.label}</span>
            <span className={`text-2xl font-black tabular-nums ${row.highlight ? "text-primary" : "text-muted-foreground"}`}>
              {row.value}
            </span>
          </div>
        ))}
      </div>
    </BrutalCard>
  );
}

function WorkloadWidget() {
  const tasks = useListTasks();
  const items = tasks.data ?? [];
  const total = items.length;

  return (
    <BrutalCard
      title="Workload"
      action={<span className="font-mono text-xs font-black text-muted-foreground">{total} tasks</span>}
      className="h-full"
    >
      {total === 0 ? (
        <p className="flex flex-1 items-center justify-center font-mono text-xs uppercase text-muted-foreground">No tasks yet.</p>
      ) : (
        <div className="flex flex-1 flex-col justify-center gap-3">
          <div className="flex h-8 w-full border-4 border-border">
            {TASK_STATUSES.map((status) => {
              const count = items.filter((task) => task.status === status.key).length;
              if (count === 0) return null;
              return (
                <div
                  key={status.key}
                  className={`${status.className} border-r-4 border-border last:border-r-0`}
                  style={{ width: `${(count / total) * 100}%` }}
                  title={`${status.label}: ${count}`}
                />
              );
            })}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {TASK_STATUSES.map((status) => (
              <div key={status.key} className="flex items-center gap-2">
                <span className={`size-3 shrink-0 border-2 border-border ${status.className}`} />
                <span className="font-mono text-[11px] font-bold uppercase text-muted-foreground">{status.label}</span>
                <span className="ml-auto font-mono text-sm font-black tabular-nums">
                  {items.filter((task) => task.status === status.key).length}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </BrutalCard>
  );
}

export function Home() {
  const dashboard = useGetDashboard();
  const inbox = useGetInbox({ query: { queryKey: getGetInboxQueryKey() } });
  const now = new Date();
  const waiting = (inbox.data?.needsYou.length ?? 0) + (inbox.data?.needsApproval.length ?? 0);

  return (
    <div className="space-y-8 py-6">
      <div className="text-center">
        <p className="font-mono text-xs font-black uppercase tracking-widest text-muted-foreground">Mission control</p>
        <h1 className="mt-2 text-3xl font-black tracking-tighter">{greeting(now)}.</h1>
        <p className="mt-3 font-mono text-sm text-muted-foreground">
          {dashboard.data
            ? `${dashboard.data.activeAgentCount} agents active · ${waiting} waiting on you`
            : "Syncing operations..."}
        </p>
      </div>

      <AtlasBar />

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        <WeatherWidget />
        <div className="md:col-span-1 xl:col-span-1">
          <InboxWidget />
        </div>
        <div className="md:col-span-1 xl:col-span-1">
          <WorkloadWidget />
        </div>
        <div className="md:col-span-1 xl:col-span-1">
          <PersonalTodosWidget />
        </div>
      </div>

      {dashboard.data?.recommendation && (
        <div className="mx-auto max-w-3xl border-4 border-border bg-primary/10 p-4 shadow-[6px_6px_0px_0px_hsl(var(--border))]">
          <p className="font-mono text-[11px] font-black uppercase tracking-wider text-primary">Atlas suggests</p>
          <p className="mt-1 text-sm font-medium">{dashboard.data.recommendation}</p>
        </div>
      )}

      <div className="flex justify-center">
        <Link
          href="/inbox"
          className="flex items-center gap-2 border-4 border-border bg-card px-5 py-3 font-bold uppercase shadow-[4px_4px_0px_0px_hsl(var(--border))] transition-all hover:translate-x-1 hover:-translate-y-1"
        >
          <InboxIcon size={18} /> Open inbox
        </Link>
      </div>
    </div>
  );
}
