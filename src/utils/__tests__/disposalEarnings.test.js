// What a collector is told after disposing digital bins (owner's decision
// 2026-11-12: a pending MoMo payment shows the expected amount, marked pending).
import { earningsText, addEarnings, totalEarningsText } from '../disposalEarnings';

const result = (amount, pending = false) => ({ payoutBreakdown: { collector_total_payout: amount }, paymentPending: pending });

it('shows confirmed earnings as an amount', () => {
  expect(earningsText(result(21.75))).toBe('GHS 21.75');
  expect(earningsText(result(0))).toBe('GHS 0.00');
  expect(earningsText({})).toBe('GHS 0.00');
});

it('marks earnings pending while the client MoMo payment is unconfirmed', () => {
  expect(earningsText(result(43.06, true))).toBe("GHS 43.06 pending until the client's MoMo payment is confirmed");
});

it('keeps confirmed and pending apart when disposing several bins', () => {
  let totals = { confirmed: 0, pending: 0 };
  totals = addEarnings(totals, result(20));
  totals = addEarnings(totals, result(43.06, true));
  totals = addEarnings(totals, result(10));
  expect(totals).toEqual({ confirmed: 30, pending: 43.06 });
  expect(totalEarningsText(totals)).toBe('GHS 30.00 (+ GHS 43.06 pending MoMo confirmation)');
  expect(totalEarningsText({ confirmed: 30, pending: 0 })).toBe('GHS 30.00');
});
