// What a collector is told about earnings after disposing a digital bin.
// A bin whose client MoMo payment is still pending shows the expected amount
// marked pending; it becomes withdrawable once the gateway confirms it.

const ghs = (amount) => `GHS ${(Number(amount) || 0).toFixed(2)}`;

export function binEarnings(result) {
  return {
    amount: result?.payoutBreakdown?.collector_total_payout || 0,
    pending: result?.paymentPending === true,
  };
}

export function earningsText(result) {
  const { amount, pending } = binEarnings(result);
  return pending
    ? `${ghs(amount)} pending until the client's MoMo payment is confirmed`
    : ghs(amount);
}

// Several disposals at once: confirmed and pending amounts kept apart
export function addEarnings(totals, result) {
  const { amount, pending } = binEarnings(result);
  return pending
    ? { ...totals, pending: totals.pending + amount }
    : { ...totals, confirmed: totals.confirmed + amount };
}

export function totalEarningsText({ confirmed, pending }) {
  return pending > 0
    ? `${ghs(confirmed)} (+ ${ghs(pending)} pending MoMo confirmation)`
    : ghs(confirmed);
}
