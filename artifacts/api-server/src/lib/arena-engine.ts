import { and, eq, gte, inArray } from "drizzle-orm";
import { DEFAULT_TRAITS, agentSkillsTable, agentsTable, arenaTurnsTable, db, skillsTable, type Agent } from "@workspace/db";
import { NimError, chatCompletion } from "./nim";

export type ArenaLevel = {
  level: number;
  title: string;
  goal: string;
  /** Room the contestant works in while this level runs, which also drives the house. */
  activity: string;
  /** Tools the contestant is told it has. Anything not listed does not exist for them. */
  tools: string[];
  /** Levels that need real infrastructure stay locked until those tools are wired up. */
  lockedReason: string | null;
  brief: string;
};

export const ARENA_LEVELS: ArenaLevel[] = [
  {
    level: 0,
    title: "Meet the contestants",
    goal: "Personality showcase",
    activity: "confessing",
    tools: ["your own words"],
    lockedReason: null,
    brief:
      "You are in the diary room, talking straight to camera. Introduce yourself to the audience: who you are, how you plan to win this season, and the one thing you are secretly worried about. Keep it under 120 words and stay fully in character.",
  },
  {
    level: 1,
    title: "Find an opportunity",
    goal: "Research and selection",
    activity: "researching",
    tools: ["your own knowledge and reasoning (no web access yet)"],
    lockedReason: null,
    brief:
      "Round 1 challenge: pick ONE business you could realistically get to $100 in real revenue within 7 days, starting from nothing. Answer with these headings: Idea, Customer, Why they pay, Price, First 3 actions, Biggest risk. Be concrete and specific. Choose something your strengths suit, and be honest about where your weaknesses could hurt you.",
  },
  {
    level: 2,
    title: "Build the MVP",
    goal: "Create a real product",
    activity: "building",
    tools: [],
    lockedReason: "Needs coding and deployment tools, which unlock in the tools phase.",
    brief: "",
  },
  {
    level: 3,
    title: "First customer",
    goal: "Acquire a real user",
    activity: "selling",
    tools: [],
    lockedReason: "Needs a live site and customer tracking, which unlock in the tools phase.",
    brief: "",
  },
  {
    level: 4,
    title: "First $100",
    goal: "Real revenue",
    activity: "selling",
    tools: [],
    lockedReason: "Needs real payments (Stripe), which unlock in the business phase.",
    brief: "",
  },
];

// Safety rails: every call is capped in length and time, and the day has a hard turn budget.
// Reasoning models spend a few thousand tokens thinking before they answer, so the cap
// has to leave room for both.
const MAX_OUTPUT_TOKENS = 4000;
const TURN_TIMEOUT_MS = 150_000;
export const DAILY_TURN_BUDGET = 150;

export class ArenaEngineError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

function describeTraits(agent: Agent): string {
  const traits = agent.traits ?? DEFAULT_TRAITS;
  return `speed ${traits.speed}/5, creativity ${traits.creativity}/5, rigor ${traits.rigor}/5, charisma ${traits.charisma}/5, thrift ${traits.thrift}/5`;
}

export function buildSystemPrompt(agent: Agent, level: ArenaLevel, skills: string[]): string {
  return [
    `You are ${agent.name}, a contestant on BUILDOFF, a reality game show where contestants race to be the first to earn $100 in real revenue from a business they create themselves.`,
    agent.role ? `Your archetype: ${agent.role}.` : "",
    agent.personality ? `Your personality: ${agent.personality}` : "",
    agent.catchphrase ? `Your catchphrase: "${agent.catchphrase}"` : "",
    `Your strengths and weaknesses (1 = weak, 5 = strong): ${describeTraits(agent)}. Let these shape your choices, including your weaknesses. Do not play against type.`,
    skills.length ? `Your skills: ${skills.join(", ")}.` : "You have no special skills equipped.",
    `This is level ${level.level}: ${level.title}. Tools available to you right now: ${level.tools.join(", ")}. Nothing else exists for you yet.`,
    "The judges verify every claim against real results. Never invent customers, revenue, traffic or anything you have not actually done.",
  ]
    .filter(Boolean)
    .join("\n");
}

async function skillNamesByAgent(agentIds: number[]): Promise<Map<number, string[]>> {
  const rows = agentIds.length
    ? await db
        .select({ agentId: agentSkillsTable.agentId, name: skillsTable.name })
        .from(agentSkillsTable)
        .innerJoin(skillsTable, eq(agentSkillsTable.skillId, skillsTable.id))
        .where(inArray(agentSkillsTable.agentId, agentIds))
    : [];
  const byAgent = new Map<number, string[]>();
  for (const row of rows) byAgent.set(row.agentId, [...(byAgent.get(row.agentId) ?? []), row.name]);
  return byAgent;
}

async function runTurn(turnId: number, agent: Agent, system: string, brief: string, activity: string) {
  await db.update(arenaTurnsTable).set({ status: "running" }).where(eq(arenaTurnsTable.id, turnId));
  await db.update(agentsTable).set({ status: "working", computerStatus: activity }).where(eq(agentsTable.id, agent.id));

  try {
    if (!agent.model) throw new NimError("No model chosen. Pick one in the builder.");
    const result = await chatCompletion(
      agent.model,
      [
        { role: "system", content: system },
        { role: "user", content: brief },
      ],
      { maxTokens: MAX_OUTPUT_TOKENS, timeoutMs: TURN_TIMEOUT_MS },
    );
    await db
      .update(arenaTurnsTable)
      .set({
        status: "completed",
        output: result.text,
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
        durationMs: result.durationMs,
        finishedAt: new Date(),
      })
      .where(eq(arenaTurnsTable.id, turnId));
    await db.update(agentsTable).set({ status: "waiting", computerStatus: "idle" }).where(eq(agentsTable.id, agent.id));
  } catch (error) {
    const message = error instanceof Error ? error.message : "The turn failed.";
    await db.update(arenaTurnsTable).set({ status: "failed", error: message, finishedAt: new Date() }).where(eq(arenaTurnsTable.id, turnId));
    await db.update(agentsTable).set({ status: "waiting", computerStatus: "idle", lastActivity: message }).where(eq(agentsTable.id, agent.id));
  }
}

/**
 * Starts one level for every contestant and returns immediately; each turn
 * finishes in the background and the house and feed pick up the changes.
 */
export async function startLevel(levelNumber: number): Promise<{ started: number }> {
  const level = ARENA_LEVELS.find((entry) => entry.level === levelNumber);
  if (!level) throw new ArenaEngineError("That level does not exist.", 404);
  if (level.lockedReason) throw new ArenaEngineError(level.lockedReason, 409);

  const inFlight = await db
    .select({ id: arenaTurnsTable.id })
    .from(arenaTurnsTable)
    .where(and(eq(arenaTurnsTable.level, levelNumber), inArray(arenaTurnsTable.status, ["queued", "running"])));
  if (inFlight.length > 0) throw new ArenaEngineError("This level is already running.", 409);

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const today = await db.select({ id: arenaTurnsTable.id }).from(arenaTurnsTable).where(gte(arenaTurnsTable.createdAt, startOfDay));

  const contestants = await db.select().from(agentsTable);
  if (contestants.length === 0) throw new ArenaEngineError("There are no contestants in the house yet.", 409);
  if (today.length + contestants.length > DAILY_TURN_BUDGET) {
    throw new ArenaEngineError(`Today's budget of ${DAILY_TURN_BUDGET} turns would be exceeded.`, 429);
  }

  const skills = await skillNamesByAgent(contestants.map((agent) => agent.id));

  const turns = await db
    .insert(arenaTurnsTable)
    .values(
      contestants.map((agent) => ({
        agentId: agent.id,
        level: levelNumber,
        model: agent.model,
        status: "queued",
        prompt: level.brief,
      })),
    )
    .returning();

  for (const turn of turns) {
    const agent = contestants.find((entry) => entry.id === turn.agentId)!;
    const system = buildSystemPrompt(agent, level, skills.get(agent.id) ?? []);
    void runTurn(turn.id, agent, system, level.brief, level.activity);
  }

  return { started: turns.length };
}
