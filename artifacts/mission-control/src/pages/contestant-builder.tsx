import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, Circle, Minus, Plus, Save, X } from "lucide-react";
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer } from "recharts";
import {
  getGetArenaRaceQueryKey,
  getListAgentCapabilitiesQueryKey,
  useDetachAgentCapability,
  useEquipAgentSkill,
  useGetArenaRace,
  useListAgentCapabilities,
  useListModels,
  useSetContestantProfile,
  useUpdateAgent,
} from "@workspace/api-client-react";
import type { AgentTraits } from "@workspace/api-client-react";
import { BrutalBadge, BrutalButton } from "@/components/ui/brutal";
import { PixelPerson } from "@/components/house/pixel-person";
import { SkillSearchPicker } from "@/components/skill-search-picker";
import { ModelPicker } from "@/components/model-picker";
import { ARCHETYPES, TRAIT_BUDGET, TRAIT_KEYS, findArchetype, traitTotal } from "@/lib/archetypes";

const TRAIT_COLORS: Record<keyof AgentTraits, string> = {
  speed: "bg-primary",
  creativity: "bg-accent",
  rigor: "bg-secondary",
  charisma: "bg-[hsl(230_15%_59%)]",
  thrift: "bg-foreground/70",
};

function Panel({ title, action, children, className = "" }: { title: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-border bg-card shadow-sm ${className}`}>
      <header className="flex items-center justify-between border-b border-border px-3 py-2">
        <h2 className="font-mono text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{title}</h2>
        {action}
      </header>
      <div className="p-3">{children}</div>
    </section>
  );
}

function StatTile({ label, value, meter }: { label: string; value: string; meter: number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-2 text-center shadow-sm">
      <p className="text-base font-bold tabular-nums">{value}</p>
      <p className="font-mono text-[10px] uppercase text-muted-foreground">{label}</p>
      <div className="mx-auto mt-1.5 h-1 w-10 overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-primary" style={{ width: `${Math.min(100, Math.max(0, meter))}%` }} />
      </div>
    </div>
  );
}

export function ContestantBuilder() {
  const params = useParams<{ id: string }>();
  const agentId = Number(params.id);
  const queryClient = useQueryClient();

  const race = useGetArenaRace({ query: { queryKey: getGetArenaRaceQueryKey() } });
  const models = useListModels({ query: { queryKey: ["models"] } });
  const contestant = race.data?.contestants.find((entry) => entry.id === agentId);

  const capabilitiesKey = getListAgentCapabilitiesQueryKey(agentId);
  const capabilities = useListAgentCapabilities(agentId, { query: { queryKey: capabilitiesKey } });
  const refreshLoadout = () => {
    queryClient.invalidateQueries({ queryKey: capabilitiesKey });
    queryClient.invalidateQueries({ queryKey: getGetArenaRaceQueryKey() });
  };
  const equip = useEquipAgentSkill({ mutation: { onSuccess: refreshLoadout } });
  const detach = useDetachAgentCapability({ mutation: { onSuccess: refreshLoadout } });
  const updateAgent = useUpdateAgent({ mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetArenaRaceQueryKey() }) } });
  const saveProfile = useSetContestantProfile({ mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetArenaRaceQueryKey() }) } });

  const [tab, setTab] = useState<"skills" | "presets">("skills");
  const [seedQuery, setSeedQuery] = useState<string | undefined>(undefined);
  const [traits, setTraits] = useState<AgentTraits | null>(null);
  const [personality, setPersonality] = useState("");
  const [catchphrase, setCatchphrase] = useState("");

  // Load the saved profile once, then let the operator edit a local draft.
  useEffect(() => {
    if (!contestant || traits) return;
    setTraits(contestant.traits);
    setPersonality(contestant.personality ?? "");
    setCatchphrase(contestant.catchphrase ?? "");
  }, [contestant, traits]);

  const equipped = capabilities.data ?? [];
  const archetype = findArchetype(contestant?.role);
  const spent = traits ? traitTotal(traits) : 0;
  const dirty =
    !!contestant &&
    !!traits &&
    (JSON.stringify(traits) !== JSON.stringify(contestant.traits) ||
      personality !== (contestant.personality ?? "") ||
      catchphrase !== (contestant.catchphrase ?? ""));

  const archetypeCoverage = useMemo(() => {
    if (!archetype) return 0;
    const names = equipped.map((skill) => `${skill.name} ${skill.category}`.toLowerCase());
    return archetype.skills.filter((wanted) => names.some((name) => name.includes(wanted.split(" ")[0]))).length;
  }, [archetype, equipped]);

  if (race.isLoading) return <p className="py-8 font-mono text-xs uppercase text-muted-foreground">Loading contestant...</p>;
  if (!contestant || !traits)
    return (
      <div className="py-8">
        <p className="font-mono text-xs uppercase text-destructive">That contestant could not be found.</p>
        <Link href="/arena" className="mt-2 inline-block font-mono text-xs uppercase underline">Back to the game show</Link>
      </div>
    );

  const step = (key: keyof AgentTraits, delta: number) => {
    const next = traits[key] + delta;
    if (next < 1 || next > 5) return;
    if (delta > 0 && spent >= TRAIT_BUDGET) return;
    setTraits({ ...traits, [key]: next });
  };

  const applyArchetype = (name: string) => {
    const preset = ARCHETYPES.find((entry) => entry.name === name);
    if (!preset) return;
    updateAgent.mutate({ agentId, data: { role: preset.name } });
    setTraits(preset.traits);
    setTab("skills");
  };

  const modelStatus = contestant.model ? models.data?.models.find((option) => option.id === contestant.model)?.status : undefined;
  const checks = [
    { label: "Personality written", ok: personality.trim().length > 0, detail: personality.trim() ? "OK" : "Missing" },
    {
      label: "Model responds",
      ok: modelStatus === "available",
      detail: !contestant.model ? "None set" : modelStatus === "available" ? "OK" : modelStatus === "checking" ? "Checking" : "Not responding",
    },
    { label: "Skills equipped", ok: equipped.length >= 3, detail: `${equipped.length}/3` },
    { label: "Trait budget", ok: spent <= TRAIT_BUDGET, detail: `${spent}/${TRAIT_BUDGET}` },
    { label: "Fits archetype", ok: !!archetype && archetypeCoverage >= 2, detail: archetype ? `${archetypeCoverage} match` : "None set" },
  ];

  const radarData = TRAIT_KEYS.map((trait) => ({ trait: trait.label, value: traits[trait.key] }));

  return (
    <div className="space-y-3 py-1">
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/arena" className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Back to the game show">
          <ArrowLeft size={16} />
        </Link>
        <span className="flex size-8 items-end justify-center overflow-hidden rounded-md bg-muted"><PixelPerson seed={contestant.name} size={20} /></span>
        <h1 className="text-xl font-bold tracking-tight">{contestant.name}</h1>
        {archetype && <BrutalBadge variant="primary">{archetype.name}</BrutalBadge>}
        <BrutalBadge variant="secondary">{contestant.provider}</BrutalBadge>
        <div className="ml-auto flex items-center gap-2">
          {dirty && <span className="font-mono text-[10px] uppercase text-muted-foreground">Unsaved changes</span>}
          {saveProfile.isError && <span className="font-mono text-[10px] uppercase text-destructive">Save failed</span>}
          <BrutalButton
            disabled={!dirty || spent > TRAIT_BUDGET || saveProfile.isPending}
            onClick={() => saveProfile.mutate({ agentId, data: { traits, personality, catchphrase } })}
          >
            <Save size={13} /> {saveProfile.isPending ? "Saving..." : "Save"}
          </BrutalButton>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)_minmax(0,280px)]">
        {/* Loadout */}
        <section className="rounded-xl border border-border bg-card shadow-sm">
          <div className="flex gap-1 border-b border-border p-1.5">
            {(["skills", "presets"] as const).map((value) => (
              <button
                key={value}
                onClick={() => setTab(value)}
                className={`flex-1 rounded-lg py-1.5 text-xs font-semibold capitalize ${tab === value ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                {value}
              </button>
            ))}
          </div>

          {tab === "skills" ? (
            <div className="space-y-3 p-3">
              <SkillSearchPicker
                excludeIds={equipped.map((skill) => skill.skillId)}
                selectedId={null}
                seedQuery={seedQuery}
                onSelect={(skillId) => {
                  if (skillId !== null) equip.mutate({ agentId, skillId });
                }}
              />

              {archetype && (
                <div>
                  <p className="mb-1 font-mono text-[10px] uppercase text-muted-foreground">Suggested for {archetype.name}</p>
                  <div className="flex flex-wrap gap-1">
                    {archetype.skills.map((skill) => (
                      <button
                        key={skill}
                        onClick={() => setSeedQuery(skill)}
                        className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground hover:border-primary hover:text-primary"
                      >
                        {skill}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <p className="mb-1 font-mono text-[10px] uppercase text-muted-foreground">Equipped ({equipped.length})</p>
                {equipped.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border px-2 py-3 text-center text-[11px] text-muted-foreground">
                    Nothing equipped yet. Search above or tap a suggestion.
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {equipped.map((skill) => (
                      <li key={skill.skillId} className="group flex items-start gap-2 rounded-lg border border-border px-2 py-1.5">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold">{skill.name}</p>
                          <p className="font-mono text-[10px] uppercase text-muted-foreground">{skill.category}</p>
                        </div>
                        <button
                          onClick={() => detach.mutate({ agentId, skillId: skill.skillId })}
                          aria-label={`Remove ${skill.name}`}
                          className="text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100"
                        >
                          <X size={13} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ) : (
            <div className="max-h-[560px] space-y-1.5 overflow-auto p-3">
              {ARCHETYPES.map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => applyArchetype(preset.name)}
                  className={`w-full rounded-lg border px-2 py-1.5 text-left transition-colors ${
                    archetype?.name === preset.name ? "border-primary bg-primary/10" : "border-border hover:bg-muted/50"
                  }`}
                >
                  <p className="text-xs font-semibold">{preset.name}</p>
                  <p className="text-[11px] text-muted-foreground">{preset.blurb}</p>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Stage */}
        <section className="flex flex-col rounded-xl border border-border bg-gradient-to-b from-card to-muted/60 shadow-sm">
          <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 pb-2 pt-6">
            <div className="flex h-52 w-44 items-end justify-center rounded-2xl bg-card/70 pb-3 shadow-md"><PixelPerson seed={contestant.name} size={112} /></div>
            <input
              value={catchphrase}
              onChange={(event) => setCatchphrase(event.target.value)}
              placeholder="Give them a catchphrase..."
              className="w-full max-w-sm bg-transparent text-center text-sm italic text-muted-foreground outline-none placeholder:text-muted-foreground/60"
            />
            <textarea
              value={personality}
              onChange={(event) => setPersonality(event.target.value)}
              rows={3}
              placeholder="Personality: how they think, what they rush, what they avoid..."
              className="w-full max-w-md resize-none rounded-lg border border-border bg-card/80 p-2 text-xs outline-none focus:ring-2 focus:ring-ring/30"
            />
          </div>

          <div className="m-3 rounded-xl border border-border bg-card p-3 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <p className="font-mono text-[11px] font-bold uppercase text-muted-foreground">Trait budget</p>
              <p className={`font-mono text-[11px] font-bold tabular-nums ${spent > TRAIT_BUDGET ? "text-destructive" : ""}`}>
                {spent} / {TRAIT_BUDGET} max
              </p>
            </div>

            <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
              {TRAIT_KEYS.map((trait) => (
                <div key={trait.key} className={TRAIT_COLORS[trait.key]} style={{ width: `${(traits[trait.key] / TRAIT_BUDGET) * 100}%` }} />
              ))}
            </div>

            <div className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-5">
              {TRAIT_KEYS.map((trait) => (
                <div key={trait.key} className="flex items-center justify-between gap-1 rounded-lg bg-muted/50 px-2 py-1 sm:flex-col">
                  <span className="flex items-center gap-1 font-mono text-[10px] uppercase text-muted-foreground">
                    <span className={`size-2 rounded-full ${TRAIT_COLORS[trait.key]}`} /> {trait.label}
                  </span>
                  <div className="flex items-center gap-1">
                    <button onClick={() => step(trait.key, -1)} disabled={traits[trait.key] <= 1} aria-label={`Lower ${trait.label}`} className="rounded p-0.5 hover:bg-card disabled:opacity-30">
                      <Minus size={11} />
                    </button>
                    <span className="w-3 text-center text-sm font-bold tabular-nums">{traits[trait.key]}</span>
                    <button onClick={() => step(trait.key, 1)} disabled={traits[trait.key] >= 5 || spent >= TRAIT_BUDGET} aria-label={`Raise ${trait.label}`} className="rounded p-0.5 hover:bg-card disabled:opacity-30">
                      <Plus size={11} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground">Every point of strength is spent from a shared pool, so each contestant has real weaknesses.</p>
          </div>
        </section>

        {/* Readout */}
        <div className="space-y-3">
          <Panel title="Readiness">
            <ul className="space-y-1.5">
              {checks.map((check) => (
                <li key={check.label} className="flex items-center gap-2 text-xs">
                  {check.ok ? <Check size={13} className="text-accent-strong" /> : <Circle size={11} className="text-muted-foreground" />}
                  <span className="flex-1">{check.label}</span>
                  <span className={`font-mono text-[10px] uppercase ${check.ok ? "text-accent-strong" : "text-muted-foreground"}`}>{check.detail}</span>
                </li>
              ))}
            </ul>
          </Panel>

          <div className="grid grid-cols-3 gap-2">
            <StatTile label="Skills" value={String(equipped.length)} meter={(equipped.length / 8) * 100} />
            <StatTile label="Budget" value={`${spent}`} meter={(spent / TRAIT_BUDGET) * 100} />
            <StatTile label="To prize" value={`${contestant.percentToPrize}%`} meter={contestant.percentToPrize} />
          </div>

          <Panel title="Trait shape">
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData} outerRadius="72%">
                  <PolarGrid stroke="hsl(var(--border))" />
                  <PolarAngleAxis dataKey="trait" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <PolarRadiusAxis domain={[0, 5]} tick={false} axisLine={false} />
                  <Radar dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} isAnimationActive={false} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <Panel title="Model">
            <ModelPicker agentId={agentId} model={contestant.model} invalidateKey={getGetArenaRaceQueryKey()} />
          </Panel>
        </div>
      </div>
    </div>
  );
}
