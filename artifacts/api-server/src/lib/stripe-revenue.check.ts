/**
 * Self-check for the scoring rule. Run it with:
 *   node artifacts/api-server/src/lib/stripe-revenue.check.ts
 * It must fail loudly if a contestant could ever be credited for money that did not land.
 */
import assert from "node:assert/strict";
import { CONTESTANT_METADATA_KEY, totalsByContestant, type StripePaymentIntent } from "./stripe-scoring.ts";

const tag = (id: string) => ({ [CONTESTANT_METADATA_KEY]: id });

const intents: StripePaymentIntent[] = [
  { id: "pi_ok1", status: "succeeded", amount_received: 2500, metadata: tag("7") },
  { id: "pi_ok2", status: "succeeded", amount_received: 1000, metadata: tag("7") },
  { id: "pi_other", status: "succeeded", amount_received: 500, metadata: tag("9") },
  // None of the rest may add a cent to anyone's total.
  { id: "pi_pending", status: "requires_payment_method", amount_received: 0, metadata: tag("7") },
  { id: "pi_canceled", status: "canceled", amount_received: 9999, metadata: tag("7") },
  { id: "pi_untagged", status: "succeeded", amount_received: 9999 },
  { id: "pi_badtag", status: "succeeded", amount_received: 9999, metadata: tag("not-a-contestant") },
  { id: "pi_zero", status: "succeeded", amount_received: 0, metadata: tag("9") },
];

const totals = totalsByContestant(intents);

assert.equal(totals.get(7)?.cents, 3500, "two succeeded payments should add up");
assert.deepEqual(totals.get(7)?.paymentIds, ["pi_ok1", "pi_ok2"], "evidence should name the payments counted");
assert.equal(totals.get(9)?.cents, 500, "a zero-amount payment adds nothing");
assert.equal(totals.size, 2, "untagged and unparseable payments belong to nobody");

console.log("stripe-revenue: scoring rule holds.");
