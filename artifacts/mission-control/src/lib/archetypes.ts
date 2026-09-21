import type { AgentTraits } from "@workspace/api-client-react";

export const TRAIT_BUDGET = 18;

export const TRAIT_KEYS: Array<{ key: keyof AgentTraits; label: string }> = [
  { key: "speed", label: "Speed" },
  { key: "creativity", label: "Creativity" },
  { key: "rigor", label: "Rigor" },
  { key: "charisma", label: "Charisma" },
  { key: "thrift", label: "Thrift" },
];

export type Archetype = {
  name: string;
  blurb: string;
  skills: string[];
  traits: AgentTraits;
};

// Skill loadouts come from the Season 0 design doc; trait spreads are a starting point to tune.
export const ARCHETYPES: Archetype[] = [
  { name: "Hustler", blurb: "Sells first, builds later.", skills: ["browser", "sales", "negotiation", "marketplaces", "customer discovery", "lead generation", "cold outreach", "reselling"], traits: { speed: 5, creativity: 3, rigor: 1, charisma: 5, thrift: 3 } },
  { name: "Engineer", blurb: "Ships working software.", skills: ["coding", "api", "database", "saas", "automation", "deployment", "analytics"], traits: { speed: 3, creativity: 3, rigor: 5, charisma: 1, thrift: 4 } },
  { name: "Creator", blurb: "Grows an audience, then monetizes it.", skills: ["content", "social", "copywriting", "branding", "video", "audience growth", "affiliate", "digital products"], traits: { speed: 3, creativity: 5, rigor: 2, charisma: 4, thrift: 2 } },
  { name: "Researcher", blurb: "Finds the real opportunity before moving.", skills: ["market research", "customer discovery", "pricing", "unit economics", "business modeling"], traits: { speed: 2, creativity: 3, rigor: 5, charisma: 2, thrift: 4 } },
  { name: "Connector", blurb: "Wins through other people.", skills: ["partnerships", "sales", "networking", "customer discovery", "lead generation"], traits: { speed: 3, creativity: 3, rigor: 2, charisma: 5, thrift: 3 } },
  { name: "Operator", blurb: "Turns chaos into a system.", skills: ["sop", "automation", "analytics", "hiring", "delegation", "crm", "unit economics"], traits: { speed: 3, creativity: 2, rigor: 5, charisma: 2, thrift: 5 } },
  { name: "Contrarian", blurb: "Bets where nobody else is looking.", skills: ["market research", "pricing", "business modeling", "affiliate", "marketplaces"], traits: { speed: 3, creativity: 5, rigor: 3, charisma: 2, thrift: 4 } },
  { name: "Bootstrapper", blurb: "Spends nothing, keeps everything.", skills: ["sop", "automation", "digital products", "services", "unit economics"], traits: { speed: 3, creativity: 3, rigor: 3, charisma: 2, thrift: 5 } },
  { name: "Salesperson", blurb: "Always be closing.", skills: ["sales", "cold outreach", "email marketing", "negotiation", "crm", "customer discovery"], traits: { speed: 4, creativity: 2, rigor: 2, charisma: 5, thrift: 3 } },
  { name: "Local", blurb: "Owns the neighborhood.", skills: ["customer discovery", "services", "seo", "local marketing", "partnerships"], traits: { speed: 3, creativity: 2, rigor: 3, charisma: 4, thrift: 4 } },
  { name: "Trend Surfer", blurb: "Rides whatever is hot this week.", skills: ["social", "seo", "paid ads", "affiliate", "audience growth", "content"], traits: { speed: 5, creativity: 4, rigor: 1, charisma: 4, thrift: 2 } },
  { name: "Expert", blurb: "Packages know-how into products.", skills: ["digital products", "course", "content", "email marketing", "audience growth"], traits: { speed: 2, creativity: 3, rigor: 5, charisma: 3, thrift: 3 } },
  { name: "Reseller", blurb: "Buys low, sells high, repeats.", skills: ["ecommerce", "marketplaces", "paid ads", "arbitrage", "analytics"], traits: { speed: 5, creativity: 2, rigor: 2, charisma: 3, thrift: 5 } },
  { name: "Strategist", blurb: "Models it out before committing.", skills: ["business modeling", "unit economics", "pricing", "market research", "planning"], traits: { speed: 2, creativity: 4, rigor: 5, charisma: 2, thrift: 4 } },
  { name: "Chaos Agent", blurb: "Tries ten weird things at once.", skills: ["coding", "digital products", "marketplaces", "automation", "novel ideas"], traits: { speed: 5, creativity: 5, rigor: 1, charisma: 3, thrift: 1 } },
  { name: "Executive", blurb: "Delegates to get more done.", skills: ["sop", "hiring", "delegation", "management", "analytics", "unit economics"], traits: { speed: 3, creativity: 2, rigor: 4, charisma: 4, thrift: 4 } },
];

export function traitTotal(traits: AgentTraits): number {
  return traits.speed + traits.creativity + traits.rigor + traits.charisma + traits.thrift;
}

export function findArchetype(role: string | null | undefined): Archetype | undefined {
  if (!role) return undefined;
  return ARCHETYPES.find((archetype) => archetype.name.toLowerCase() === role.trim().toLowerCase());
}
