/**
 * The scoring rule, kept free of database and network imports so it can be checked on its own.
 * See stripe-revenue.check.ts.
 */

/** The metadata key a contestant's checkout must carry for its payments to be scored. */
export const CONTESTANT_METADATA_KEY = "contestant";

export type StripePaymentIntent = {
  id: string;
  status: string;
  amount_received?: number;
  metadata?: Record<string, string>;
};

/** Cents banked per contestant, counting succeeded payments only. */
export function totalsByContestant(intents: StripePaymentIntent[]): Map<number, { cents: number; paymentIds: string[] }> {
  const totals = new Map<number, { cents: number; paymentIds: string[] }>();
  for (const intent of intents) {
    if (intent.status !== "succeeded") continue;
    const tag = intent.metadata?.[CONTESTANT_METADATA_KEY];
    const agentId = Number(tag);
    if (!tag || !Number.isInteger(agentId) || agentId <= 0) continue;
    const cents = Number(intent.amount_received ?? 0);
    if (!Number.isFinite(cents) || cents <= 0) continue;
    const entry = totals.get(agentId) ?? { cents: 0, paymentIds: [] };
    entry.cents += Math.round(cents);
    entry.paymentIds.push(intent.id);
    totals.set(agentId, entry);
  }
  return totals;
}
