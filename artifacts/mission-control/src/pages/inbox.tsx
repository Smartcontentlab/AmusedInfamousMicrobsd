import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckSquare, MessageSquare, Send } from "lucide-react";
import {
  getGetInboxQueryKey,
  useCreateDirectMessage,
  useGetInbox,
  useMarkDirectMessageRead,
  useUpdateApproval,
} from "@workspace/api-client-react";
import type { InboxAttentionItem } from "@workspace/api-client-react";
import { BrutalBadge, BrutalButton, BrutalCard } from "@/components/ui/brutal";

function ProjectTag({ projectName, agentName }: { projectName?: string | null; agentName?: string | null }) {
  if (!projectName && !agentName) return null;
  return (
    <div className="flex flex-wrap items-center gap-1">
      {projectName && <BrutalBadge variant="secondary">{projectName}</BrutalBadge>}
      {agentName && <BrutalBadge>{agentName}</BrutalBadge>}
    </div>
  );
}

function relativeTime(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function AttentionCard({ item, children }: { item: InboxAttentionItem; children?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            {item.risk && (
              <BrutalBadge variant={item.risk === "high" ? "destructive" : item.risk === "medium" ? "primary" : "default"}>
                {item.risk} risk
              </BrutalBadge>
            )}
            <span className="font-mono text-[11px] uppercase text-muted-foreground">{relativeTime(item.createdAt)}</span>
          </div>
          <h3 className="text-base font-bold uppercase tracking-tight">{item.title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{item.detail}</p>
        </div>
        <ProjectTag projectName={item.projectName} agentName={item.agentName} />
      </div>
      {children && <div className="mt-3 flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  count,
  accent,
  children,
}: {
  title: string;
  icon: React.ElementType;
  count: number;
  accent?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-3 border-b border-border pb-2">
        <Icon size={22} className={accent ? "text-primary" : "text-muted-foreground"} />
        <h2 className="text-xl font-bold uppercase tracking-tight">{title}</h2>
        <span
          className={`ml-auto rounded-lg border border-border px-2 py-0.5 font-mono text-sm font-bold tabular-nums ${
            count > 0 && accent ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          }`}
        >
          {count}
        </span>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function EmptyRow({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-border/40 px-4 py-6 text-center font-mono text-xs uppercase text-muted-foreground">
      {children}
    </p>
  );
}

export function Inbox() {
  const [reply, setReply] = useState("");
  const queryClient = useQueryClient();
  const inbox = useGetInbox({ query: { queryKey: getGetInboxQueryKey(), refetchInterval: 20000 } });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: getGetInboxQueryKey() });

  const updateApproval = useUpdateApproval({ mutation: { onSuccess: invalidate } });
  const markRead = useMarkDirectMessageRead({ mutation: { onSuccess: invalidate } });
  const sendMessage = useCreateDirectMessage({ mutation: { onSuccess: invalidate } });

  const needsYou = inbox.data?.needsYou ?? [];
  const needsApproval = inbox.data?.needsApproval ?? [];
  const messages = inbox.data?.directMessages ?? [];

  const submitReply = (event: React.FormEvent) => {
    event.preventDefault();
    const body = reply.trim();
    if (!body) return;
    sendMessage.mutate({ data: { body } });
    setReply("");
  };

  return (
    <div className="space-y-8 py-2">
      <div>
        <h1 className="text-2xl font-bold uppercase tracking-tighter">Inbox</h1>
        <p className="mt-1 font-mono text-sm text-muted-foreground">Everything Atlas needs from you, in one channel.</p>
      </div>

      <Section title="Needs you" icon={AlertTriangle} count={needsYou.length} accent>
        {needsYou.length === 0 ? (
          <EmptyRow>Nothing is blocked. You are clear.</EmptyRow>
        ) : (
          needsYou.map((item) => <AttentionCard key={`${item.kind}-${item.id}`} item={item} />)
        )}
      </Section>

      <Section title="Needs approval" icon={CheckSquare} count={needsApproval.length} accent>
        {needsApproval.length === 0 ? (
          <EmptyRow>No approvals waiting.</EmptyRow>
        ) : (
          needsApproval.map((item) => (
            <AttentionCard key={`approval-${item.id}`} item={item}>
              <BrutalButton
                variant="primary"
                disabled={updateApproval.isPending}
                onClick={() => updateApproval.mutate({ approvalId: item.id, data: { status: "approved" } })}
              >
                Approve
              </BrutalButton>
              <BrutalButton
                variant="outline"
                disabled={updateApproval.isPending}
                onClick={() => updateApproval.mutate({ approvalId: item.id, data: { status: "rejected" } })}
              >
                Reject
              </BrutalButton>
            </AttentionCard>
          ))
        )}
      </Section>

      <Section title="Direct messages" icon={MessageSquare} count={messages.filter((message) => !message.readAt).length}>
        <BrutalCard>
          <form onSubmit={submitReply} className="flex gap-2">
            <input
              value={reply}
              onChange={(event) => setReply(event.target.value)}
              placeholder="Message Atlas..."
              className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm font-medium outline-none focus:ring-4 focus:ring-primary/20"
            />
            <button
              type="submit"
              disabled={!reply.trim() || sendMessage.isPending}
              className="flex shrink-0 items-center gap-2 rounded-xl border border-border bg-primary px-4 py-2 font-bold uppercase text-primary-foreground shadow-sm disabled:opacity-40"
            >
              <Send size={16} />
            </button>
          </form>

          <div className="mt-4 space-y-2">
            {messages.length === 0 ? (
              <EmptyRow>No messages yet.</EmptyRow>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`rounded-lg border p-3 ${message.readAt ? "border-border/40 bg-background" : "border-border bg-primary/5"}`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold uppercase text-primary">{message.sender}</span>
                    <span className="font-mono text-[11px] uppercase text-muted-foreground">{relativeTime(message.createdAt)}</span>
                    <div className="ml-auto flex items-center gap-2">
                      <ProjectTag projectName={message.projectName} agentName={message.agentName} />
                      {!message.readAt && (
                        <button
                          onClick={() => markRead.mutate({ messageId: message.id })}
                          className="font-mono text-[11px] font-bold uppercase text-muted-foreground hover:text-foreground"
                        >
                          Mark read
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="mt-1 text-sm">{message.body}</p>
                </div>
              ))
            )}
          </div>
        </BrutalCard>
      </Section>
    </div>
  );
}
