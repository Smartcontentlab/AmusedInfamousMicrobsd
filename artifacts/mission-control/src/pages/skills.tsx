import {
  getListAgentCapabilitiesQueryKey,
  getListAgentsQueryKey,
  getListSkillsQueryKey,
  getGetSkillFacetsQueryKey,
  useEquipAgentSkill,
  useGetSkillFacets,
  useListAgents,
  useListSkills,
  useRefreshSkillCatalog,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { AlertTriangle, ExternalLink, Loader2, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { BrutalBadge, BrutalButton, BrutalCard } from "../components/ui/brutal";

const PAGE_SIZE = 60;

function riskVariant(risk: string): "primary" | "secondary" | "destructive" | "default" {
  if (risk === "low") return "primary";
  if (risk === "medium") return "secondary";
  if (risk === "high") return "destructive";
  return "default";
}

function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

export function Skills() {
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [source, setSource] = useState("");
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [agentId, setAgentId] = useState("");

  const query = useDebounced(search, 300);
  useEffect(() => setPage(0), [query, category, source]);

  const params = {
    ...(query ? { q: query } : {}),
    ...(category ? { category } : {}),
    ...(source ? { source } : {}),
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  };

  const skillsQuery = useListSkills(params, { query: { queryKey: getListSkillsQueryKey(params) } });
  const facetsQuery = useGetSkillFacets({ query: { queryKey: getGetSkillFacetsQueryKey() } });
  const agentsQuery = useListAgents({ query: { queryKey: getListAgentsQueryKey() } });

  const refreshCatalog = useRefreshSkillCatalog({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListSkillsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetSkillFacetsQueryKey() });
      },
    },
  });
  const equipSkill = useEquipAgentSkill();

  const skills = skillsQuery.data ?? [];
  const agents = agentsQuery.data ?? [];
  const facets = facetsQuery.data;
  const selectedSkill = skills.find((skill) => skill.id === selectedId) ?? skills[0];

  const equip = () => {
    if (!selectedSkill || !agentId) return;
    equipSkill.mutate(
      { agentId: Number(agentId), skillId: selectedSkill.id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListAgentCapabilitiesQueryKey(Number(agentId)) });
          queryClient.invalidateQueries({ queryKey: getListAgentsQueryKey() });
        },
      },
    );
  };

  return (
    <div className="space-y-4 py-2">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold uppercase tracking-tighter">Skill library</h1>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            {facets ? `${facets.total.toLocaleString()} skills across ${facets.sources.length} sources` : "Loading library..."}
          </p>
        </div>
        <BrutalButton
          onClick={() => refreshCatalog.mutate()}
          disabled={refreshCatalog.isPending}
          className="flex items-center gap-2"
        >
          {refreshCatalog.isPending ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          {refreshCatalog.isPending ? "Syncing..." : "Refresh catalog"}
        </BrutalButton>
      </div>

      {refreshCatalog.data && (
        <div className="rounded-lg border border-border bg-muted/40 px-3 py-2">
          <p className="font-mono text-[11px] font-bold uppercase">
            Imported {refreshCatalog.data.imported} · updated {refreshCatalog.data.updated}
          </p>
          {refreshCatalog.data.errors.map((error) => (
            <p key={error} className="mt-0.5 flex items-start gap-1 font-mono text-[11px] text-destructive">
              <AlertTriangle size={12} className="mt-0.5 shrink-0" /> {error}
            </p>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search size={14} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search 7,000+ skills..."
            className="w-full rounded-lg border border-border bg-card py-1.5 pl-7 pr-2 text-xs outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <select
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          className="rounded-lg border border-border bg-card px-2 py-1.5 font-mono text-[11px] uppercase outline-none"
        >
          <option value="">All categories</option>
          {facets?.categories.map((item) => (
            <option key={item.name} value={item.name}>
              {item.name} ({item.count})
            </option>
          ))}
        </select>
        <select
          value={source}
          onChange={(event) => setSource(event.target.value)}
          className="rounded-lg border border-border bg-card px-2 py-1.5 font-mono text-[11px] uppercase outline-none"
        >
          <option value="">All sources</option>
          {facets?.sources.map((item) => (
            <option key={item.name} value={item.name}>
              {item.name} ({item.count})
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,320px)]">
        <BrutalCard
          title={<span className="text-sm">Results</span>}
          action={
            <span className="font-mono text-[11px] font-bold text-muted-foreground">
              {skillsQuery.isFetching ? "searching..." : `${skills.length} shown`}
            </span>
          }
        >
          {skills.length === 0 && !skillsQuery.isFetching ? (
            <p className="py-8 text-center font-mono text-xs uppercase text-muted-foreground">
              Nothing matched. Try a different search, or refresh the catalog.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {skills.map((skill) => (
                <button
                  key={skill.id}
                  onClick={() => setSelectedId(skill.id)}
                  className={`rounded-lg border px-2 py-1.5 text-left transition-colors ${
                    selectedSkill?.id === skill.id ? "border-primary bg-primary/10" : "border-border bg-card hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="min-w-0 flex-1 truncate text-xs font-bold uppercase">{skill.name}</span>
                    <BrutalBadge variant={riskVariant(skill.sideEffectRisk)}>{skill.sideEffectRisk}</BrutalBadge>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">{skill.description}</p>
                  <p className="mt-1 font-mono text-[10px] uppercase text-muted-foreground">{skill.category}</p>
                </button>
              ))}
            </div>
          )}

          <div className="mt-3 flex items-center justify-between gap-2">
            <BrutalButton variant="default" disabled={page === 0} onClick={() => setPage((value) => Math.max(0, value - 1))}>
              Previous
            </BrutalButton>
            <span className="font-mono text-[11px] uppercase text-muted-foreground">Page {page + 1}</span>
            <BrutalButton variant="default" disabled={skills.length < PAGE_SIZE} onClick={() => setPage((value) => value + 1)}>
              Next
            </BrutalButton>
          </div>
        </BrutalCard>

        <BrutalCard title={<span className="text-sm">Detail</span>}>
          {!selectedSkill ? (
            <p className="py-8 text-center font-mono text-xs uppercase text-muted-foreground">Select a skill.</p>
          ) : (
            <div className="space-y-2">
              <h2 className="text-base font-bold uppercase tracking-tight">{selectedSkill.name}</h2>
              <p className="text-xs text-muted-foreground">{selectedSkill.description}</p>

              <div className="flex flex-wrap gap-1">
                <BrutalBadge variant="secondary">{selectedSkill.category}</BrutalBadge>
                <BrutalBadge>{selectedSkill.sourceName}</BrutalBadge>
                <BrutalBadge variant={riskVariant(selectedSkill.sideEffectRisk)}>{selectedSkill.sideEffectRisk} risk</BrutalBadge>
              </div>

              {selectedSkill.requiresApproval && (
                <p className="flex items-start gap-1 rounded-lg border border-border bg-destructive/10 px-2 py-1 font-mono text-[10px] uppercase">
                  <ShieldCheck size={12} className="mt-0.5 shrink-0" /> Installing this needs your approval first
                </p>
              )}

              {selectedSkill.sourceUrl && (
                <a
                  href={selectedSkill.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 font-mono text-[11px] uppercase text-primary underline"
                >
                  <ExternalLink size={12} /> View source
                </a>
              )}

              <div className="border-t-2 border-border/40 pt-2">
                <p className="mb-1 font-mono text-[10px] font-bold uppercase text-muted-foreground">Equip to staff</p>
                <div className="flex gap-1">
                  <select
                    value={agentId}
                    onChange={(event) => setAgentId(event.target.value)}
                    className="min-w-0 flex-1 rounded-lg border border-border bg-background px-1.5 py-1 font-mono text-[11px] outline-none"
                  >
                    <option value="">Choose staff...</option>
                    {agents.map((agent) => (
                      <option key={agent.id} value={agent.id}>
                        {agent.name}
                      </option>
                    ))}
                  </select>
                  <BrutalButton variant="primary" disabled={!agentId || equipSkill.isPending} onClick={equip}>
                    Equip
                  </BrutalButton>
                </div>
                {equipSkill.isSuccess && <p className="mt-1 font-mono text-[10px] uppercase text-primary">Sent to the staff member.</p>}
                {equipSkill.isError && <p className="mt-1 font-mono text-[10px] uppercase text-destructive">That could not be equipped.</p>}
              </div>
            </div>
          )}
        </BrutalCard>
      </div>
    </div>
  );
}
