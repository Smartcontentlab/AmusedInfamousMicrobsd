import { and, desc, eq } from "drizzle-orm";
import { activityTable, agentsTable, arenaEvidenceTable, db } from "@workspace/db";
import { getArenaRound } from "./tool-unlocks";
import { CONTESTANT_METADATA_KEY, totalsByContestant, type StripePaymentIntent } from "./stripe-scoring";

export { CONTESTANT_METADATA_KEY, totalsByContestant, type StripePaymentIntent };

/**
 * The race bar is scored from money that actually moved, never from what a contestant
 * says it earned. Every contestant's checkout carries `metadata.contestant = <agent id>`,
 * and a payment only counts once Stripe reports it succeeded.
 */

const STRIPE_API = "https://api.stripe.com/v1";
const SYNC_INTERVAL_MS = 60_000;
const REQUEST_TIMEOUT_MS = 15_000;


export class StripeRevenueError extends Error {}

export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_API_KEY);
}

/** Season 0 is played in test mode. A live key would put real customer money on a game board. */
function testModeKey(): string {
  const key = process.env.STRIPE_API_KEY ?? "";
  if (!key) throw new StripeRevenueError("Stripe is not set up yet.");
  if (!/^(sk|rk)_test_/.test(key)) {
    throw new StripeRevenueError("STRIPE_API_KEY must be a test-mode key (sk_test_ or rk_test_). The show never runs on live money.");
  }
  return key;
}

// ponytail: reads the newest 100 payments, which is far more than a season produces.
// Page through `starting_after` if a season ever outgrows that.
async function fetchPaymentIntents(): Promise<StripePaymentIntent[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${STRIPE_API}/payment_intents?limit=100`, {
      headers: { authorization: `Bearer ${testModeKey()}` },
      signal: controller.signal,
    });
    if (response.status === 401) throw new StripeRevenueError("Stripe rejected the key.");
    if (!response.ok) throw new StripeRevenueError(`Stripe returned ${response.status}.`);
    const payload = (await response.json()) as { data?: StripePaymentIntent[] };
    return payload.data ?? [];
  } catch (error) {
    if (error instanceof StripeRevenueError) throw error;
    throw new StripeRevenueError("Stripe could not be reached.");
  } finally {
    clearTimeout(timer);
  }
}

/** Records the new total as evidence and moves the contestant's banked figure. */
async function recordRevenue(agentId: number, cents: number, paymentIds: string[], round: number, agentName: string) {
  const [latest] = await db
    .select()
    .from(arenaEvidenceTable)
    .where(and(eq(arenaEvidenceTable.agentId, agentId), eq(arenaEvidenceTable.verifiedBy, "Stripe")))
    .orderBy(desc(arenaEvidenceTable.verifiedAt))
    .limit(1);
  if (latest?.value === cents) return false;

  await db.insert(arenaEvidenceTable).values({
    agentId,
    round,
    metric: "revenue_cents",
    value: cents,
    source: "Stripe (test mode)",
    evidenceRef: paymentIds.slice(-5).join(", ").slice(0, 500),
    note: `${paymentIds.length} succeeded payment${paymentIds.length === 1 ? "" : "s"} tagged ${CONTESTANT_METADATA_KEY}=${agentId}`,
    verifiedBy: "Stripe",
  });
  await db.update(agentsTable).set({ arenaIncomeCents: cents }).where(eq(agentsTable.id, agentId));
  await db.insert(activityTable).values({
    agentId,
    kind: "arena_revenue_verified",
    message: `Stripe confirmed ${agentName} has banked $${(cents / 100).toFixed(2)} from ${paymentIds.length} payment${paymentIds.length === 1 ? "" : "s"}.`,
  });
  return true;
}

let lastSyncAt = 0;
let inFlight: Promise<number> | null = null;

/**
 * Pulls succeeded payments and scores them. Throttled, because the race bar polls
 * every few seconds and Stripe's numbers do not move that fast.
 */
export async function syncStripeRevenue(options: { force?: boolean } = {}): Promise<number> {
  if (!stripeConfigured()) return 0;
  if (!options.force && Date.now() - lastSyncAt < SYNC_INTERVAL_MS) return 0;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const [intents, round, agents] = await Promise.all([
      fetchPaymentIntents(),
      getArenaRound(),
      db.select({ id: agentsTable.id, name: agentsTable.name, banked: agentsTable.arenaIncomeCents }).from(agentsTable),
    ]);
    const totals = totalsByContestant(intents);
    let changed = 0;
    for (const agent of agents) {
      const cents = totals.get(agent.id)?.cents ?? 0;
      if (cents === 0 && agent.banked === 0) continue;
      const updated = await recordRevenue(agent.id, cents, totals.get(agent.id)?.paymentIds ?? [], round, agent.name);
      if (updated) changed += 1;
    }
    lastSyncAt = Date.now();
    return changed;
  })();

  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
}
