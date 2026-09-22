import { asc, desc, eq, gte, inArray } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { GetArenaLevelsResponse, ListArenaTurnsResponse, RunArenaLevelResponse } from "@workspace/api-zod";
import { agentsTable, arenaTurnStepsTable, arenaTurnsTable, db } from "@workspace/db";
import { ARENA_LEVELS, ArenaEngineError, DAILY_TURN_BUDGET, describeLevelTools, startLevel } from "../lib/arena-engine";

const router: IRouter = Router();

router.get("/arena/levels", async (_req, res): Promise<void> => {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const [turns, today] = await Promise.all([
    db.select().from(arenaTurnsTable),
    db.select({ id: arenaTurnsTable.id }).from(arenaTurnsTable).where(gte(arenaTurnsTable.createdAt, startOfDay)),
  ]);

  res.json(
    GetArenaLevelsResponse.parse({
      turnsToday: today.length,
      dailyBudget: DAILY_TURN_BUDGET,
      levels: ARENA_LEVELS.map((level) => {
        const forLevel = turns.filter((turn) => turn.level === level.level);
        const last = forLevel.reduce<Date | null>((latest, turn) => (!latest || turn.createdAt > latest ? turn.createdAt : latest), null);
        return {
          level: level.level,
          title: level.title,
          goal: level.goal,
          tools: describeLevelTools(level),
          locked: level.lockedReason !== null,
          lockedReason: level.lockedReason,
          running: forLevel.some((turn) => turn.status === "queued" || turn.status === "running"),
          completedTurns: forLevel.filter((turn) => turn.status === "completed").length,
          failedTurns: forLevel.filter((turn) => turn.status === "failed").length,
          lastRunAt: last ? last.toISOString() : null,
        };
      }),
    }),
  );
});

router.post("/arena/levels/:level/run", async (req, res): Promise<void> => {
  const level = Number(req.params.level);
  if (!Number.isInteger(level)) {
    res.status(404).json({ error: "That level does not exist." });
    return;
  }
  try {
    const result = await startLevel(level);
    res.status(202).json(RunArenaLevelResponse.parse(result));
  } catch (error) {
    if (error instanceof ArenaEngineError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    throw error;
  }
});

router.get("/arena/turns", async (req, res): Promise<void> => {
  const level = req.query.level !== undefined ? Number(req.query.level) : undefined;
  const rows = await db
    .select({ turn: arenaTurnsTable, agentName: agentsTable.name, appearanceSeed: agentsTable.appearanceSeed })
    .from(arenaTurnsTable)
    .innerJoin(agentsTable, eq(arenaTurnsTable.agentId, agentsTable.id))
    .where(level !== undefined && Number.isInteger(level) ? eq(arenaTurnsTable.level, level) : undefined)
    .orderBy(desc(arenaTurnsTable.createdAt), desc(arenaTurnsTable.id))
    .limit(40);

  const turnIds = rows.map(({ turn }) => turn.id);
  const steps = turnIds.length
    ? await db.select().from(arenaTurnStepsTable).where(inArray(arenaTurnStepsTable.turnId, turnIds)).orderBy(asc(arenaTurnStepsTable.step))
    : [];

  res.json(
    ListArenaTurnsResponse.parse(
      rows.map(({ turn, agentName, appearanceSeed }) => ({
        id: turn.id,
        agentId: turn.agentId,
        agentName,
        appearanceSeed,
        level: turn.level,
        model: turn.model,
        standInFor: turn.standInFor,
        status: turn.status,
        output: turn.output,
        error: turn.error,
        promptTokens: turn.promptTokens,
        completionTokens: turn.completionTokens,
        durationMs: turn.durationMs,
        createdAt: turn.createdAt.toISOString(),
        finishedAt: turn.finishedAt ? turn.finishedAt.toISOString() : null,
        steps: steps
          .filter((step) => step.turnId === turn.id)
          .map((step) => ({ step: step.step, tool: step.tool, input: step.input, ok: step.ok === 1, summary: step.summary })),
      })),
    ),
  );
});

export default router;
