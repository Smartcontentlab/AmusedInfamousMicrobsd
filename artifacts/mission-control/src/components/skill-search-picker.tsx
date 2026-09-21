import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { getListSkillsQueryKey, useListSkills } from "@workspace/api-client-react";

const RESULT_LIMIT = 25;

function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

/**
 * Searches the whole catalog server-side. The library holds thousands of skills,
 * so a plain dropdown of everything is not usable.
 */
export function SkillSearchPicker({
  excludeIds,
  selectedId,
  onSelect,
  inputId,
  testId,
}: {
  excludeIds: number[];
  selectedId: number | null;
  onSelect: (skillId: number | null, skillName?: string) => void;
  inputId?: string;
  testId?: string;
}) {
  const [search, setSearch] = useState("");
  const query = useDebounced(search, 300);

  const params = { ...(query ? { q: query } : {}), limit: RESULT_LIMIT };
  const skillsQuery = useListSkills(params, { query: { queryKey: getListSkillsQueryKey(params) } });

  const excluded = new Set(excludeIds);
  const results = (skillsQuery.data ?? []).filter((skill) => !excluded.has(skill.id));
  const selected = results.find((skill) => skill.id === selectedId);

  return (
    <div className="min-w-0 flex-1">
      <div className="relative">
        <Search size={13} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          id={inputId}
          data-testid={testId}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search the skill library..."
          className="w-full rounded-lg border border-border bg-background py-1.5 pl-7 pr-2 font-mono text-[11px] outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>

      {selected && (
        <p className="mt-1 font-mono text-[10px] uppercase text-primary">
          Selected: {selected.name}
        </p>
      )}

      <div className="mt-1 max-h-40 overflow-auto rounded-lg border border-border bg-card">
        {skillsQuery.isFetching && results.length === 0 && (
          <p className="px-2 py-2 font-mono text-[10px] uppercase text-muted-foreground">Searching...</p>
        )}
        {!skillsQuery.isFetching && results.length === 0 && (
          <p className="px-2 py-2 font-mono text-[10px] uppercase text-muted-foreground">
            {query ? "Nothing matched that search." : "No skills available."}
          </p>
        )}
        {results.map((skill) => (
          <button
            key={skill.id}
            type="button"
            onClick={() => onSelect(skill.id === selectedId ? null : skill.id, skill.name)}
            className={`flex w-full items-center gap-2 border-b border-border/40 px-2 py-1 text-left last:border-b-0 ${
              skill.id === selectedId ? "bg-primary/15" : "hover:bg-muted/50"
            }`}
          >
            <span className="min-w-0 flex-1 truncate text-[11px] font-bold">{skill.name}</span>
            <span className="shrink-0 font-mono text-[9px] uppercase text-muted-foreground">{skill.category}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
