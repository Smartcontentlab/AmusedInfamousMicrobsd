import type { RuntimeConnection } from "@workspace/db";

export type CatalogSource = {
  key: "voltagent" | "skilldb";
  name: string;
  repositoryUrl: string;
  skillsPath: string;
};

export type ImportedCatalogEntry = {
  externalId: string;
  name: string;
  description: string;
  category: string;
  sourceKind: "catalog";
  sourceName: string;
  sourceUrl: string;
  compatibleRuntimes: string[];
  installMethod: string;
  requiresApproval: boolean;
  sideEffectRisk: "low" | "medium" | "high" | "unknown";
};

export const APPROVED_CATALOG_SOURCES: CatalogSource[] = [
  {
    key: "voltagent",
    name: "Awesome Agent Skills",
    repositoryUrl: "https://github.com/VoltAgent/awesome-agent-skills",
    skillsPath: "https://raw.githubusercontent.com/VoltAgent/awesome-agent-skills/main/README.md",
  },
  {
    key: "skilldb",
    name: "SkillDB",
    repositoryUrl: "https://skilldb.dev",
    skillsPath: "https://skilldb.dev/api/v1/skills",
  },
];

// Shown before the first catalog refresh so the library is never empty.
export const BOOTSTRAP_CATALOG: ImportedCatalogEntry[] = [
  {
    externalId: "voltagent:anthropics/skill-creator",
    name: "Skill Creator",
    description: "Guide for creating effective skills for AI coding agents.",
    category: "Core",
    sourceKind: "catalog",
    sourceName: "Awesome Agent Skills",
    sourceUrl: "https://github.com/VoltAgent/awesome-agent-skills",
    compatibleRuntimes: ["hermes", "openclaw"],
    installMethod: "skills.install",
    requiresApproval: false,
    sideEffectRisk: "low",
  },
  {
    externalId: "skilldb:bootstrap/research",
    name: "Research Briefing",
    description: "Turns a question into a sourced, decision-ready brief with explicit uncertainty.",
    category: "Research",
    sourceKind: "catalog",
    sourceName: "SkillDB",
    sourceUrl: "https://skilldb.dev",
    compatibleRuntimes: ["hermes", "openclaw"],
    installMethod: "skills.install",
    requiresApproval: false,
    sideEffectRisk: "low",
  },
];

const USER_AGENT = "mission-control-catalog-importer";
const REQUEST_TIMEOUT_MS = 20_000;
const SKILLDB_PAGE_SIZE = 50;
const SKILLDB_MAX_PAGES = 400;
// SkillDB throttles aggressively; sequential requests with a short gap sync the
// whole catalog reliably, where concurrency silently loses pages.
const SKILLDB_CONCURRENCY = 1;
const SKILLDB_PAGE_RETRIES = 4;
const SKILLDB_PAGE_DELAY_MS = 120;

// Words that imply the skill can touch the outside world irreversibly.
const HIGH_RISK = /\b(send|publish|post|deploy|delete|remove|purchase|pay|payment|charge|transfer|credential|secret|token|api key)\b/i;
const MEDIUM_RISK = /\b(write|create|update|edit|modify|commit|upload|email|message|schedule)\b/i;

function riskFor(text: string): { requiresApproval: boolean; sideEffectRisk: ImportedCatalogEntry["sideEffectRisk"] } {
  if (HIGH_RISK.test(text)) return { requiresApproval: true, sideEffectRisk: "high" };
  if (MEDIUM_RISK.test(text)) return { requiresApproval: false, sideEffectRisk: "medium" };
  return { requiresApproval: false, sideEffectRisk: "low" };
}

function titleize(value: string): string {
  return value
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .trim();
}

async function fetchWithTimeout(url: string, accept: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { headers: { accept, "user-agent": USER_AGENT }, signal: controller.signal });
    if (!response.ok) throw new Error(`Request to ${new URL(url).host} returned ${response.status}.`);
    return response;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * VoltAgent publishes its catalog as one large README, not as SKILL.md folders.
 * Entries look like: `- **[owner/name](url)** - description`
 */
async function importVoltAgent(source: CatalogSource): Promise<ImportedCatalogEntry[]> {
  const markdown = await (await fetchWithTimeout(source.skillsPath, "text/plain")).text();
  const entries: ImportedCatalogEntry[] = [];
  const seen = new Set<string>();
  let category = "Community";

  const entryPattern = /^\s*-\s*\*\*\[([^\]]+)\]\(([^)]+)\)\*\*\s*[-–—]\s*(.+?)\s*$/;

  for (const line of markdown.split("\n")) {
    const heading = line.match(/^###\s+(.+?)\s*$/);
    if (heading) {
      category = heading[1].replace(/\s*Skills\s*$/i, "").trim() || "Community";
      continue;
    }

    const match = line.match(entryPattern);
    if (!match) continue;

    const [, slug, url, description] = match;
    // Real entries are `owner/skill-name`; prose links in the README are not.
    if (!/^[\w.-]+\/[\w.-]+$/.test(slug)) continue;

    const externalId = `${source.key}:${slug}`;
    if (seen.has(externalId)) continue;
    seen.add(externalId);

    const risk = riskFor(`${slug} ${description}`);
    entries.push({
      externalId,
      name: titleize(slug.split("/")[1] ?? slug),
      description: description.slice(0, 500),
      category,
      sourceKind: "catalog",
      sourceName: source.name,
      sourceUrl: url,
      compatibleRuntimes: ["hermes", "openclaw"],
      installMethod: "skills.install",
      ...risk,
    });
  }

  if (entries.length === 0) throw new Error("No skill entries were found in the README.");
  return entries;
}

type SkillDbSkill = {
  id?: unknown;
  name?: unknown;
  title?: unknown;
  description?: unknown;
  category?: unknown;
  packLabel?: unknown;
};

type SkillDbPage = {
  skills?: SkillDbSkill[];
  pagination?: { total?: unknown };
};

async function fetchSkillDbPage(source: CatalogSource, offset: number): Promise<SkillDbPage> {
  const url = `${source.skillsPath}?limit=${SKILLDB_PAGE_SIZE}&offset=${offset}`;
  return (await (await fetchWithTimeout(url, "application/json")).json()) as SkillDbPage;
}

/** Transient failures here silently cost whole pages of the catalog, so retry before giving up. */
async function fetchSkillDbPageWithRetry(source: CatalogSource, offset: number): Promise<SkillDbPage | null> {
  for (let attempt = 0; attempt < SKILLDB_PAGE_RETRIES; attempt += 1) {
    try {
      return await fetchSkillDbPage(source, offset);
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
    }
  }
  return null;
}

function mapSkillDbEntry(source: CatalogSource, skill: SkillDbSkill): ImportedCatalogEntry | null {
  const id = typeof skill.id === "string" ? skill.id : null;
  if (!id) return null;

  const rawTitle = typeof skill.title === "string" && skill.title ? skill.title : typeof skill.name === "string" ? skill.name : id;
  // Some SkillDB titles arrive wrapped in literal quotes, which also sorts them to the top.
  const title = rawTitle.trim().replace(/^["'“‘]+|["'”’]+$/g, "").trim() || id;
  const description = typeof skill.description === "string" ? skill.description : "";
  const category = typeof skill.category === "string" && skill.category
    ? skill.category
    : typeof skill.packLabel === "string" && skill.packLabel
      ? skill.packLabel
      : "General";

  return {
    externalId: `${source.key}:${id}`,
    name: title.slice(0, 200),
    description: (description || `Imported from ${source.name}.`).slice(0, 500),
    category,
    sourceKind: "catalog",
    sourceName: source.name,
    sourceUrl: `${source.repositoryUrl}/skills/${encodeURIComponent(id)}`,
    compatibleRuntimes: ["hermes", "openclaw"],
    installMethod: "skills.install",
    ...riskFor(`${title} ${description}`),
  };
}

/** SkillDB exposes a paginated JSON API capped at 50 rows per request. */
async function importSkillDb(source: CatalogSource): Promise<ImportedCatalogEntry[]> {
  const first = await fetchSkillDbPage(source, 0);
  const total = typeof first.pagination?.total === "number" ? first.pagination.total : 0;
  if (!first.skills || first.skills.length === 0) throw new Error("The skill API returned no entries.");

  const entries: ImportedCatalogEntry[] = [];
  const seen = new Set<string>();

  const collect = (page: SkillDbPage) => {
    for (const skill of page.skills ?? []) {
      const entry = mapSkillDbEntry(source, skill);
      if (!entry || seen.has(entry.externalId)) continue;
      seen.add(entry.externalId);
      entries.push(entry);
    }
  };

  collect(first);

  const pageCount = Math.min(Math.ceil(total / SKILLDB_PAGE_SIZE), SKILLDB_MAX_PAGES);
  const offsets: number[] = [];
  for (let page = 1; page < pageCount; page += 1) offsets.push(page * SKILLDB_PAGE_SIZE);

  // Modest concurrency so a full sync stays polite to a third-party API.
  let failedPages = 0;
  for (let index = 0; index < offsets.length; index += SKILLDB_CONCURRENCY) {
    const batch = offsets.slice(index, index + SKILLDB_CONCURRENCY);
    const pages = await Promise.all(batch.map((offset) => fetchSkillDbPageWithRetry(source, offset)));
    for (const page of pages) {
      if (page) collect(page);
      else failedPages += 1;
    }
    await new Promise((resolve) => setTimeout(resolve, SKILLDB_PAGE_DELAY_MS));
  }

  if (failedPages > 0) {
    throw new PartialImportError(entries, `${failedPages} of ${pageCount} pages could not be read after retries.`);
  }

  return entries;
}

/** Carries whatever was successfully read so a partial sync still populates the library. */
export class PartialImportError extends Error {
  constructor(
    public readonly entries: ImportedCatalogEntry[],
    message: string,
  ) {
    super(message);
    this.name = "PartialImportError";
  }
}

export async function importApprovedCatalogs(): Promise<{ entries: ImportedCatalogEntry[]; errors: string[] }> {
  const entries: ImportedCatalogEntry[] = [];
  const errors: string[] = [];

  for (const source of APPROVED_CATALOG_SOURCES) {
    try {
      const imported = source.key === "voltagent" ? await importVoltAgent(source) : await importSkillDb(source);
      entries.push(...imported);
    } catch (error) {
      if (error instanceof PartialImportError) {
        entries.push(...error.entries);
        errors.push(`${source.name}: imported ${error.entries.length} entries, but ${error.message}`);
      } else {
        errors.push(`${source.name}: ${error instanceof Error ? error.message : "Unknown import error."}`);
      }
    }
  }

  return { entries, errors };
}

export function runtimeSupportsSkillInstall(connection: RuntimeConnection): boolean {
  return connection.capabilities.some((capability) => ["skills.install", "skill_install", "install_skill", "install"].includes(capability.toLowerCase()));
}
