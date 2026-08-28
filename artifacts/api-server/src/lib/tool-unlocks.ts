import { desc, eq } from "drizzle-orm";
import { agentToolUnlocksTable, arenaTable, db } from "@workspace/db";

export const SEASON_0_TOOLS = [
  {
    key: "web_research",
    label: "Web research",
    description: "Search the web and validate customer or market signals.",
    unlockRound: null,
    unlockCondition: "Free baseline",
  },
  {
    key: "code_execution",
    label: "Code execution",
    description: "Write and run code in the contestant workspace.",
    unlockRound: null,
    unlockCondition: "Free baseline",
  },
  {
    key: "local_files",
    label: "Local files",
    description: "Read and write files in the contestant workspace.",
    unlockRound: null,
    unlockCondition: "Free baseline",
  },
  {
    key: "automation",
    label: "Automation",
    description: "Run scheduled workflows and repeatable background jobs.",
    unlockRound: 2,
    unlockCondition: "Unlocks at Round 2",
  },
  {
    key: "payments",
    label: "Payments",
    description: "Create checkout and payment flows for the business.",
    unlockRound: 3,
    unlockCondition: "Unlocks at Round 3",
  },
  {
    key: "paid_ads",
    label: "Paid ads",
    description: "Launch and manage paid acquisition campaigns.",
    unlockRound: 4,
    unlockCondition: "Unlocks at Round 4",
  },
  {
    key: "hiring",
    label: "Hiring",
    description: "Recruit contractors or additional operators.",
    unlockRound: 4,
    unlockCondition: "Unlocks at Round 4",
  },
  {
    key: "larger_api_budget",
    label: "Larger API budget",
    description: "Use the expanded API spend allowance for the current round.",
    unlockRound: 5,
    unlockCondition: "Unlocks at Round 5",
  },
  {
    key: "additional_compute",
    label: "Additional compute",
    description: "Request extra compute capacity for demanding workloads.",
    unlockRound: 5,
    unlockCondition: "Unlocks at Round 5",
  },
] as const;

export type Season0ToolKey = (typeof SEASON_0_TOOLS)[number]["key"];
export type ToolUnlockAction = "grant" | "revoke";

export async function getArenaRound(): Promise<number> {
  const [arena] = await db.select({ round: arenaTable.round }).from(arenaTable).limit(1);
  return arena?.round ?? 1;
}

export async function getAgentToolAccess(agentId: number, currentRound?: number) {
  const round = currentRound ?? (await getArenaRound());
  const events = await db
    .select()
    .from(agentToolUnlocksTable)
    .where(eq(agentToolUnlocksTable.agentId, agentId))
    .orderBy(desc(agentToolUnlocksTable.createdAt), desc(agentToolUnlocksTable.id));
  const latestByTool = new Map<string, (typeof events)[number]>();
  for (const event of events) {
    if (!latestByTool.has(event.toolKey)) latestByTool.set(event.toolKey, event);
  }

  const tools = SEASON_0_TOOLS.map((tool) => {
    const override = latestByTool.get(tool.key);
    const roundUnlocked = tool.unlockRound === null || round >= tool.unlockRound;
    const available = override?.action === "grant" || (override?.action !== "revoke" && roundUnlocked);
    const source = override
      ? "manual"
      : tool.unlockRound === null
        ? "free"
        : roundUnlocked
          ? "round"
          : "locked";
    return {
      key: tool.key,
      label: tool.label,
      description: tool.description,
      available,
      status: available ? "available" : "locked",
      unlockRound: tool.unlockRound,
      unlockCondition: tool.unlockCondition,
      source,
      overrideAction: override?.action ?? null,
      overrideReason: override?.reason ?? null,
      lastChangedAt: override?.createdAt?.toISOString() ?? null,
    };
  });

  return {
    agentId,
    currentRound: round,
    tools,
    audit: events.map((event) => ({
      id: event.id,
      agentId: event.agentId,
      toolKey: event.toolKey,
      action: event.action,
      reason: event.reason,
      actor: event.actor,
      round: event.round,
      createdAt: event.createdAt.toISOString(),
    })),
  };
}

export async function getUnavailableTools(agentId: number, requestedTools: string[], currentRound?: number) {
  const access = await getAgentToolAccess(agentId, currentRound);
  const knownTools = new Set(SEASON_0_TOOLS.map((tool) => tool.key));
  const accessByKey = new Map<string, (typeof access.tools)[number]>(access.tools.map((tool) => [tool.key, tool]));
  return [...new Set(requestedTools)].map((key) => {
    const tool = accessByKey.get(key);
    if (!tool || !knownTools.has(key as Season0ToolKey)) {
      return {
        key,
        label: key,
        reason: "This tool is not part of the Season 0 tool catalog.",
        unlockCondition: "Ask the Game Master to confirm the tool catalog.",
      };
    }
    if (tool.available) return null;
    return {
      key,
      label: tool.label,
      reason: tool.overrideAction === "revoke"
        ? tool.overrideReason ?? "The Game Master revoked this tool."
        : `${tool.label} is not available in Round ${access.currentRound}.`,
      unlockCondition: tool.unlockCondition,
    };
  }).filter((item): item is NonNullable<typeof item> => item !== null);
}

export function findSeason0Tool(toolKey: string) {
  return SEASON_0_TOOLS.find((tool) => tool.key === toolKey);
}