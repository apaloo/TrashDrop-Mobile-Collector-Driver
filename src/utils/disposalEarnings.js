// What a collector is told about earnings after disposing a digital bin
// (owner's decisions 2026-11-12): a client MoMo payment still pending shows
// the expected amount marked pending; a failed one shows GH₵0, payment failed.

const ghs = (amount) => `GHS ${(Number(amount) || 0).toFixed(2)}`;

export function binEarnings(result) {
  const failed = result?.paymentFailed === true;
  return {
    amount: failed ? 0 : (result?.payoutBreakdown?.collector_total_payout || 0),
    pending: !failed && result?.paymentPending === true,
    failed,
  };
}

export function earningsText(result) {
  const { amount, pending, failed } = binEarnings(result);
  if (failed) return `${ghs(0)}: the client's MoMo payment failed`;
  return pending
    ? `${ghs(amount)} pending until the client's MoMo payment is confirmed`
    : ghs(amount);
}

// Several disposals at once: confirmed and pending amounts kept apart, and
// failed payments counted
export function addEarnings(totals, result) {
  const { amount, pending, failed } = binEarnings(result);
  if (failed) return { ...totals, failed: (totals.failed || 0) + 1 };
  return pending
    ? { ...totals, pending: totals.pending + amount }
    : { ...totals, confirmed: totals.confirmed + amount };
}

export function totalEarningsText({ confirmed, pending, failed = 0 }) {
  let text = ghs(confirmed);
  if (pending > 0) text += ` (+ ${ghs(pending)} pending MoMo confirmation)`;
  if (failed > 0) text += `; ${failed} MoMo payment${failed > 1 ? 's' : ''} failed (GHS 0.00)`;
  return text;
}
