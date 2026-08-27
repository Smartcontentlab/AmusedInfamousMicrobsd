import type { RuntimeConnection } from "@workspace/db";

export type CatalogSource = {
  key: "hermes" | "openclaw";
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
    key: "hermes",
    name: "Hermes Skills",
    repositoryUrl: "https://github.com/NousResearch/hermes-agent",
    skillsPath: "https://github.com/NousResearch/hermes-agent/tree/main/skills",
  },
  {
    key: "openclaw",
    name: "OpenClaw Skills",
    repositoryUrl: "https://github.com/openclaw/openclaw",
    skillsPath: "https://github.com/openclaw/openclaw/tree/main/skills",
  },
];

// These entries are the safe bootstrap snapshot for the approved collections.
// Refresh replaces/updates catalog entries from repository metadata; it never
// imports operator-created skills and never runs a downloaded file.
export const BOOTSTRAP_CATALOG: ImportedCatalogEntry[] = [
  {
    externalId: "hermes:research",
    name: "Research Briefing",
    description: "Turns a question into a sourced, decision-ready research brief with explicit uncertainty.",
    category: "Research",
    sourceKind: "catalog",
    sourceName: "Hermes Skills",
    sourceUrl: "https://github.com/NousResearch/hermes-agent/tree/main/skills/research",
    compatibleRuntimes: ["hermes"],
    installMethod: "skills.install",
    requiresApproval: false,
    sideEffectRisk: "low",
  },
  {
    externalId: "hermes:browser",
    name: "Browser Operator",
    description: "Navigates web workflows and reports observed page state without taking irreversible actions.",
    category: "Operations",
    sourceKind: "catalog",
    sourceName: "Hermes Skills",
    sourceUrl: "https://github.com/NousResearch/hermes-agent/tree/main/skills/browser",
    compatibleRuntimes: ["hermes"],
    installMethod: "skills.install",
    requiresApproval: true,
    sideEffectRisk: "high",
  },
  {
    externalId: "hermes:spreadsheet",
    name: "Spreadsheet Analyst",
    description: "Cleans tabular data and explains trends, anomalies, and next actions in plain language.",
    category: "Analysis",
    sourceKind: "catalog",
    sourceName: "Hermes Skills",
    sourceUrl: "https://github.com/NousResearch/hermes-agent/tree/main/skills/spreadsheet",
    compatibleRuntimes: ["hermes", "openclaw"],
    installMethod: "skills.install",
    requiresApproval: false,
    sideEffectRisk: "low",
  },
  {
    externalId: "openclaw:github",
    name: "GitHub Workbench",
    description: "Inspects repository context and prepares changes while leaving the final write under operator control.",
    category: "Engineering",
    sourceKind: "catalog",
    sourceName: "OpenClaw Skills",
    sourceUrl: "https://github.com/openclaw/openclaw/tree/main/skills/github",
    compatibleRuntimes: ["openclaw"],
    installMethod: "skills.install",
    requiresApproval: true,
    sideEffectRisk: "high",
  },
  {
    externalId: "openclaw:document",
    name: "Document Studio",
    description: "Drafts structured documents from a brief and preserves a clear review boundary before sharing.",
    category: "Content",
    sourceKind: "catalog",
    sourceName: "OpenClaw Skills",
    sourceUrl: "https://github.com/openclaw/openclaw/tree/main/skills/document",
    compatibleRuntimes: ["openclaw", "hermes"],
    installMethod: "skills.install",
    requiresApproval: false,
    sideEffectRisk: "low",
  },
  {
    externalId: "openclaw:outreach",
    name: "Outbound Outreach",
    description: "Prepares personalized outreach drafts and queues them for human approval before sending.",
    category: "Growth",
    sourceKind: "catalog",
    sourceName: "OpenClaw Skills",
    sourceUrl: "https://github.com/openclaw/openclaw/tree/main/skills/outreach",
    compatibleRuntimes: ["openclaw"],
    installMethod: "skills.install",
    requiresApproval: true,
    sideEffectRisk: "high",
  },
];

type GithubTreeItem = { path?: unknown; type?: unknown };

function safeName(value: string): string {
  return value
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .trim();
}

function extractDescription(markdown: string, fallback: string): string {
  const paragraphs = markdown
    .replace(/^---[\s\S]*?---/, "")
    .split(/\n\s*\n/)
    .map((part) => part.replace(/^#+\s*/, "").replace(/[`*_>]/g, "").replace(/\s+/g, " ").trim())
    .filter((part) => part && !part.startsWith("#"));
  return (paragraphs[0] || fallback).slice(0, 500);
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, { headers: { accept: "application/vnd.github+json", "user-agent": "mission-control-catalog-importer" } });
  if (!response.ok) throw new Error(`Repository metadata request returned ${response.status}.`);
  return response.json();
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, { headers: { accept: "text/plain", "user-agent": "mission-control-catalog-importer" } });
  if (!response.ok) throw new Error(`Skill description request returned ${response.status}.`);
  return response.text();
}

function parseRepo(source: CatalogSource): { owner: string; repo: string } {
  const match = source.repositoryUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!match) throw new Error(`Approved source ${source.name} has an invalid repository URL.`);
  return { owner: match[1], repo: match[2].replace(/\.git$/, "") };
}

export async function importApprovedCatalogs(): Promise<{ entries: ImportedCatalogEntry[]; errors: string[] }> {
  const entries: ImportedCatalogEntry[] = [];
  const errors: string[] = [];

  for (const source of APPROVED_CATALOG_SOURCES) {
    try {
      const { owner, repo } = parseRepo(source);
      const tree = await fetchJson(`https://api.github.com/repos/${owner}/${repo}/git/trees/main?recursive=1`) as { tree?: GithubTreeItem[] };
      const skillFiles = (tree.tree ?? []).filter((item) => item.type === "blob" && typeof item.path === "string" && /(^|\/)SKILL\.md$/i.test(item.path as string)).slice(0, 100);
      if (skillFiles.length === 0) throw new Error("No SKILL.md catalog entries were found.");
      for (const item of skillFiles) {
        const path = item.path as string;
        const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/main/${path}`;
        const markdown = await fetchText(rawUrl);
        const slug = path.replace(/\/SKILL\.md$/i, "");
        const folder = slug.split("/").pop() || slug;
        entries.push({
          externalId: `${source.key}:${slug}`,
          name: safeName(folder),
          description: extractDescription(markdown, `Imported from the approved ${source.name} collection.`),
          category: source.key === "hermes" ? "Hermes" : "OpenClaw",
          sourceKind: "catalog",
          sourceName: source.name,
          sourceUrl: `${source.repositoryUrl}/tree/main/${slug}`,
          compatibleRuntimes: [source.key],
          installMethod: "skills.install",
          requiresApproval: /\b(send|publish|delete|write|credential|payment|outreach)\b/i.test(markdown),
          sideEffectRisk: /\b(send|publish|delete|credential|payment)\b/i.test(markdown) ? "high" : "unknown",
        });
      }
    } catch (error) {
      errors.push(`${source.name}: ${error instanceof Error ? error.message : "Unknown import error."}`);
    }
  }

  return { entries, errors };
}

export function runtimeSupportsSkillInstall(connection: RuntimeConnection): boolean {
  return connection.capabilities.some((capability) => ["skills.install", "skill_install", "install_skill", "install"].includes(capability.toLowerCase()));
}