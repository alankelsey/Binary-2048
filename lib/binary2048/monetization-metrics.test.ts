import { computeMonetizationBaseline } from "@/lib/binary2048/monetization-metrics";

describe("computeMonetizationBaseline", () => {
  it("computes ARPDAU proxy, conversion, retention, and churn", () => {
    const metrics = computeMonetizationBaseline({
      activeUsers: 1000,
      adRevenueUsd: 120,
      purchasesUsd: 380,
      subscribers: 20,
      uniquePayers: 70,
      retainedUsersD1: 420,
      retainedUsersD7: 180
    });

    expect(metrics.arpdauProxyUsd).toBe(0.5);
    expect(metrics.conversionRatePct).toBe(7);
    expect(metrics.subscriberRatePct).toBe(2);
    expect(metrics.retentionD1Pct).toBe(42);
    expect(metrics.retentionD7Pct).toBe(18);
    expect(metrics.churnD1Pct).toBe(58);
    expect(metrics.churnD7Pct).toBe(82);
  });

  it("returns zeroed metrics when active users is zero", () => {
    const metrics = computeMonetizationBaseline({
      activeUsers: 0,
      adRevenueUsd: 100,
      purchasesUsd: 100,
      subscribers: 5,
      uniquePayers: 10,
      retainedUsersD1: 0,
      retainedUsersD7: 0
    });

    expect(metrics.arpdauProxyUsd).toBe(0);
    expect(metrics.conversionRatePct).toBe(0);
    expect(metrics.subscriberRatePct).toBe(0);
    expect(metrics.retentionD1Pct).toBe(0);
    expect(metrics.retentionD7Pct).toBe(0);
    expect(metrics.churnD1Pct).toBe(100);
    expect(metrics.churnD7Pct).toBe(100);
  });
});
