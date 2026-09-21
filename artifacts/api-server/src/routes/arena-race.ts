import { desc, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { GetArenaRaceResponse, SetContestantProfileBody, SetContestantProfileResponse } from "@workspace/api-zod";
import { DEFAULT_TRAITS, agentsTable, arenaTable, db, projectsTable, type AgentTraits } from "@workspace/db";

const router: IRouter = Router();

// Every contestant spends from the same pool, so a strength always costs a weakness somewhere else.
const TRAIT_BUDGET = 18;

function clampTrait(value: unknown, fallback: number): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(5, Math.max(1, Math.round(numeric)));
}

function normalizeTraits(input: Partial<AgentTraits> | undefined, current: AgentTraits): AgentTraits {
  return {
    speed: clampTrait(input?.speed, current.speed),
    creativity: clampTrait(input?.creativity, current.creativity),
    rigor: clampTrait(input?.rigor, current.rigor),
    charisma: clampTrait(input?.charisma, current.charisma),
    thrift: clampTrait(input?.thrift, current.thrift),
  };
}

router.get("/arena/race", async (_req, res): Promise<void> => {
  const [[arena], contestants, projects] = await Promise.all([
    db.select().from(arenaTable).limit(1),
    db.select().from(agentsTable).orderBy(desc(agentsTable.scaleRevenueCents)),
    db.select().from(projectsTable),
  ]);

  const prizeCents = arena?.winConditionCents ?? 10000;

  // Earnings are whatever the contestant has actually banked from what it built.
  const ranked = [...contestants]
    .map((agent) => ({
      agent,
      earnedCents: agent.scaleRevenueCents || agent.arenaIncomeCents || 0,
    }))
    .sort((a, b) => b.earnedCents - a.earnedCents);

  const winner = ranked.find((entry) => entry.earnedCents >= prizeCents);

  res.json(
    GetArenaRaceResponse.parse({
      prizeCents,
      round: arena?.round ?? 1,
      totalRounds: arena?.totalRounds ?? 5,
      status: arena?.status ?? "ready",
      winnerName: winner?.agent.name ?? null,
      contestants: ranked.map((entry, index) => ({
        id: entry.agent.id,
        name: entry.agent.name,
        role: entry.agent.role,
        provider: entry.agent.provider,
        model: entry.agent.model,
        personality: entry.agent.personality,
        catchphrase: entry.agent.catchphrase,
        traits: entry.agent.traits ?? DEFAULT_TRAITS,
        projectName: projects.find((project) => project.id === entry.agent.projectId)?.name ?? null,
        businessIdea: entry.agent.businessIdea,
        currentTask: entry.agent.currentTask,
        status: entry.agent.status,
        earnedCents: entry.earnedCents,
        percentToPrize: prizeCents > 0 ? Math.min(100, Math.round((entry.earnedCents / prizeCents) * 100)) : 0,
        rank: index + 1,
        skillCount: entry.agent.skillCount,
        finished: entry.earnedCents >= prizeCents,
      })),
    }),
  );
});

router.patch("/agents/:agentId/profile", async (req, res): Promise<void> => {
  const agentId = Number(req.params.agentId);
  if (!Number.isInteger(agentId)) {
    res.status(404).json({ error: "That contestant does not exist." });
    return;
  }

  const parsed = SetContestantProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "That profile is not valid." });
    return;
  }

  const [current] = await db.select().from(agentsTable).where(eq(agentsTable.id, agentId));
  if (!current) {
    res.status(404).json({ error: "That contestant does not exist." });
    return;
  }

  const traits = normalizeTraits(parsed.data.traits, current.traits ?? DEFAULT_TRAITS);
  const spent = traits.speed + traits.creativity + traits.rigor + traits.charisma + traits.thrift;
  if (spent > TRAIT_BUDGET) {
    res.status(400).json({ error: `Traits use ${spent} points; the budget is ${TRAIT_BUDGET}.` });
    return;
  }

  const [agent] = await db
    .update(agentsTable)
    .set({
      personality: parsed.data.personality !== undefined ? parsed.data.personality : current.personality,
      catchphrase: parsed.data.catchphrase !== undefined ? parsed.data.catchphrase : current.catchphrase,
      traits,
    })
    .where(eq(agentsTable.id, agentId))
    .returning();

  res.json(
    SetContestantProfileResponse.parse({
      id: agent.id,
      name: agent.name,
      role: agent.role,
      provider: agent.provider,
      model: agent.model,
      personality: agent.personality,
      catchphrase: agent.catchphrase,
      traits: agent.traits ?? DEFAULT_TRAITS,
    }),
  );
});

export default router;
