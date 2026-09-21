import { and, eq, gte, inArray } from "drizzle-orm";
import { DEFAULT_TRAITS, agentSkillsTable, agentsTable, arenaTurnStepsTable, arenaTurnsTable, db, skillsTable, type Agent } from "@workspace/db";
import { NimError, chatCompletion, chatStep, emptyAnswerMessage, type ChatMessage } from "./nim";
import { ToolError, researchTools, runTool } from "./contestant-tools";
import { toolSupportFor } from "./model-catalog";

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
  /** Research levels hand the contestant real web tools. */
  research?: boolean;
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
    tools: [],
    lockedReason: null,
    research: true,
    brief:
      "Round 1 challenge: pick ONE business you could realistically get to $100 in real revenue within 7 days, starting from nothing. Use your tools to check real demand, prices and competitors before you commit, and cite the pages you relied on. Answer with these headings: Idea, Customer, Why they pay, Price, First 3 actions, Biggest risk. Be concrete and specific. Choose something your strengths suit, and be honest about where your weaknesses could hurt you.",
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

/** What the contestant is told it can use, matching exactly what is wired up. */
export function describeLevelTools(level: ArenaLevel): string[] {
  if (!level.research) return level.tools.length ? level.tools : ["your own words"];
  const names = researchTools().map((tool) => tool.function.name);
  return [
    ...(names.includes("web_search") ? ["web search"] : []),
    ...(names.includes("read_page") ? ["reading any public web page"] : []),
  ];
}

export function buildSystemPrompt(agent: Agent, level: ArenaLevel, skills: string[]): string {
  return [
    `You are ${agent.name}, a contestant on BUILDOFF, a reality game show where contestants race to be the first to earn $100 in real revenue from a business they create themselves.`,
    agent.role ? `Your archetype: ${agent.role}.` : "",
    agent.personality ? `Your personality: ${agent.personality}` : "",
    agent.catchphrase ? `Your catchphrase: "${agent.catchphrase}"` : "",
    `Your strengths and weaknesses (1 = weak, 5 = strong): ${describeTraits(agent)}. Let these shape your choices, including your weaknesses. Do not play against type.`,
    skills.length ? `Your skills: ${skills.join(", ")}.` : "You have no special skills equipped.",
    `This is level ${level.level}: ${level.title}. Tools available to you right now: ${describeLevelTools(level).join(", ")}. Nothing else exists for you yet.`,
    "The judges verify every claim against real results. Never invent customers, revenue, traffic or anything you have not actually done.",
    level.research
      ? "If a website blocks you or needs a login, accept it and move on. Never try to get around blocks, logins or paywalls. Keep research focused: a handful of good sources beats many pages."
      : "",
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

// Tool-loop rails: step cap, repeat detection, a whole-turn ceiling, and per-tool
// limits so one run cannot drain the free search quota.
const MAX_STEPS = 25;
const MAX_REPEATS = 3;
const TURN_CEILING_MS = 10 * 60_000;
const TOOL_CAPS: Record<string, number> = { web_search: 5, read_page: 8 };
const MAX_TOOL_CALLS = 12;
const MAX_FAILURES_IN_A_ROW = 5;

type Outcome = { text: string; promptTokens: number; completionTokens: number };

async function recordStep(turnId: number, step: number, tool: string, input: string, ok: boolean, summary: string) {
  await db.insert(arenaTurnStepsTable).values({ turnId, step, tool, input: input.slice(0, 500), ok: ok ? 1 : 0, summary: summary.slice(0, 400) });
}

async function runResearchLoop(turnId: number, model: string, system: string, brief: string): Promise<Outcome> {
  if (toolSupportFor(model) === false) {
    await recordStep(turnId, 1, "note", model, false, "This model cannot use tools, so it answered without the web. Pick a tool-capable model in the builder.");
    const plain = await chatCompletion(
      model,
      [
        { role: "system", content: system.replace(/Tools available to you right now:[^.]*\./, "You have no tools this round: rely on what you already know.") },
        { role: "user", content: brief.replace(/ Use your tools[^.]*\./, "") },
      ],
      { maxTokens: MAX_OUTPUT_TOKENS, timeoutMs: TURN_TIMEOUT_MS },
    );
    return { text: plain.text, promptTokens: plain.promptTokens ?? 0, completionTokens: plain.completionTokens ?? 0 };
  }

  const tools = researchTools();
  const messages: ChatMessage[] = [
    { role: "system", content: system },
    { role: "user", content: `${brief}\n\nUse your tools first, then give your final answer.` },
  ];
  const startedAt = Date.now();
  const seen = new Map<string, number>();
  const used = new Map<string, number>();
  let promptTokens = 0;
  let completionTokens = 0;
  let stepNumber = 0;
  let totalCalls = 0;
  let failuresInARow = 0;
  const findings: string[] = [];

  // Answering mid tool-conversation trips some models up, so the final answer
  // comes from a clean conversation with the findings written out as notes.
  const answerFromNotes = async (): Promise<Outcome> => {
    await recordStep(turnId, ++stepNumber, "note", "", true, "Research time is over; answering with what it found.");
    const final = await chatCompletion(
      model,
      [
        { role: "system", content: system },
        {
          role: "user",
          content: `${brief}\n\nYour research notes:\n${findings.join("\n\n") || "Nothing useful could be read; every page blocked you or failed."}\n\nResearch time is over. Give your final answer now, using only what you actually found.`,
        },
      ],
      { maxTokens: MAX_OUTPUT_TOKENS, timeoutMs: TURN_TIMEOUT_MS },
    );
    return { text: final.text, promptTokens: promptTokens + (final.promptTokens ?? 0), completionTokens: completionTokens + (final.completionTokens ?? 0) };
  };

  for (let round = 0; round < MAX_STEPS; round += 1) {
    if (Date.now() - startedAt > TURN_CEILING_MS) throw new NimError("Stopped: the turn ran past its 10 minute limit.");

    let step;
    try {
      step = await chatStep(model, messages, { maxTokens: MAX_OUTPUT_TOKENS, timeoutMs: TURN_TIMEOUT_MS, tools });
    } catch (error) {
      // A model without tool support still gets to play, just without the web.
      if (round === 0 && error instanceof NimError && /does not support tools/.test(error.message)) {
        await recordStep(turnId, ++stepNumber, "note", model, false, "This model cannot use tools, so it answered without the web.");
        const plain = await chatCompletion(model, messages, { maxTokens: MAX_OUTPUT_TOKENS, timeoutMs: TURN_TIMEOUT_MS });
        return { text: plain.text, promptTokens: plain.promptTokens ?? 0, completionTokens: plain.completionTokens ?? 0 };
      }
      throw error;
    }
    promptTokens += step.promptTokens ?? 0;
    completionTokens += step.completionTokens ?? 0;

    if (step.toolCalls.length === 0) {
      if (step.content) return { text: step.content, promptTokens, completionTokens };
      if (findings.length === 0) throw new NimError(emptyAnswerMessage(step.finishReason));
      return answerFromNotes();
    }

    messages.push({ role: "assistant", content: step.content || null, tool_calls: step.toolCalls });

    for (const call of step.toolCalls) {
      // Some models leak chat-format markers into the name, e.g. "read_page<|channel|>json".
      const name = call.function.name.split("<|")[0].trim();
      const input = call.function.arguments ?? "";
      const signature = `${name}:${input}`;
      const repeats = (seen.get(signature) ?? 0) + 1;
      seen.set(signature, repeats);
      if (repeats >= MAX_REPEATS) throw new NimError(`Stopped: it repeated the same ${name} call ${MAX_REPEATS} times.`);

      const count = (used.get(name) ?? 0) + 1;
      used.set(name, count);
      let result: string;
      let ok = true;
      if (TOOL_CAPS[name] !== undefined && count > TOOL_CAPS[name]) {
        ok = false;
        result = `ERROR: You have used ${name} ${TOOL_CAPS[name]} times this turn, which is the limit. Work with what you have.`;
      } else {
        try {
          result = await runTool(name, input);
        } catch (error) {
          ok = false;
          result = `ERROR: ${error instanceof ToolError ? error.message : "The tool failed."}`;
        }
      }
      await recordStep(turnId, ++stepNumber, name, input, ok, result);
      messages.push({ role: "tool", tool_call_id: call.id, content: result });
      if (ok) findings.push(`[${name}: ${input.slice(0, 200)}]\n${result.slice(0, 1500)}`);
      totalCalls += 1;
      failuresInARow = ok ? 0 : failuresInARow + 1;
    }

    // Models keep reaching for tools after their budget is gone, so once research is
    // spent (or keeps failing) the tools are taken away and a final answer is required.
    const allCapped = tools.every((tool) => (used.get(tool.function.name) ?? 0) >= (TOOL_CAPS[tool.function.name] ?? Infinity));
    if (allCapped || totalCalls >= MAX_TOOL_CALLS || failuresInARow >= MAX_FAILURES_IN_A_ROW) {
      return answerFromNotes();
    }
  }
  throw new NimError(`Stopped: hit the ${MAX_STEPS}-step limit without a final answer.`);
}

async function runTurn(turnId: number, agent: Agent, system: string, level: ArenaLevel) {
  await db.update(arenaTurnsTable).set({ status: "running" }).where(eq(arenaTurnsTable.id, turnId));
  await db.update(agentsTable).set({ status: "working", computerStatus: level.activity }).where(eq(agentsTable.id, agent.id));
  const startedAt = Date.now();

  try {
    if (!agent.model) throw new NimError("No model chosen. Pick one in the builder.");
    const outcome: Outcome = level.research
      ? await runResearchLoop(turnId, agent.model, system, level.brief)
      : await chatCompletion(
          agent.model,
          [
            { role: "system", content: system },
            { role: "user", content: level.brief },
          ],
          { maxTokens: MAX_OUTPUT_TOKENS, timeoutMs: TURN_TIMEOUT_MS },
        ).then((result) => ({ text: result.text, promptTokens: result.promptTokens ?? 0, completionTokens: result.completionTokens ?? 0 }));

    await db
      .update(arenaTurnsTable)
      .set({
        status: "completed",
        output: outcome.text,
        promptTokens: outcome.promptTokens,
        completionTokens: outcome.completionTokens,
        durationMs: Date.now() - startedAt,
        finishedAt: new Date(),
      })
      .where(eq(arenaTurnsTable.id, turnId));
    await db.update(agentsTable).set({ status: "waiting", computerStatus: "idle" }).where(eq(agentsTable.id, agent.id));
  } catch (error) {
    const message = error instanceof Error ? error.message : "The turn failed.";
    await db
      .update(arenaTurnsTable)
      .set({ status: "failed", error: message, durationMs: Date.now() - startedAt, finishedAt: new Date() })
      .where(eq(arenaTurnsTable.id, turnId));
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
    void runTurn(turn.id, agent, system, level);
  }

  return { started: turns.length };
}
