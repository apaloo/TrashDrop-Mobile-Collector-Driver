import { promotionalPayout, computePromotionalShares } from '../paymentCalculations';

describe('promotional payout', () => {
  it('uses the payout and fee the database stored when the bin was booked', () => {
    expect(promotionalPayout({ binSizeLiters: 240, bagCount: 2, storedPayout: 80, storedFee: 44 }))
      .toEqual({ collectorPayout: 80, clientFee: 44, platformSubsidy: 36 });
  });

  it('falls back to the built-in rate × bags for bins without stored values', () => {
    expect(promotionalPayout({ binSizeLiters: 240, bagCount: 3 }))
      .toEqual({ collectorPayout: 120, clientFee: 66, platformSubsidy: 54 });
  });

  it('treats a missing bag count as one bag', () => {
    expect(promotionalPayout({ binSizeLiters: 120 }).collectorPayout).toBe(30);
  });

  it('pays the collector the booked payout and records what the platform covered', () => {
    const r = computePromotionalShares({ totalBill: 44, binSizeLiters: 240, bagCount: 2, storedPayout: 80 });
    expect(r.collectorShare).toBe(80);
    expect(r.platformShare).toBe(0);
    expect(r.platformSubsidy).toBe(36);
  });
});
