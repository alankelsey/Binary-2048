export type MonetizationWindow = {
  activeUsers: number;
  adRevenueUsd: number;
  purchasesUsd: number;
  subscribers: number;
  uniquePayers: number;
  retainedUsersD1: number;
  retainedUsersD7: number;
};

export type MonetizationBaseline = {
  arpdauProxyUsd: number;
  conversionRatePct: number;
  subscriberRatePct: number;
  retentionD1Pct: number;
  retentionD7Pct: number;
  churnD1Pct: number;
  churnD7Pct: number;
};

function safeDiv(numerator: number, denominator: number): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return 0;
  return numerator / denominator;
}

function round(value: number, digits = 4): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function computeMonetizationBaseline(window: MonetizationWindow): MonetizationBaseline {
  const dau = Math.max(0, window.activeUsers);
  const revenue = Math.max(0, window.adRevenueUsd) + Math.max(0, window.purchasesUsd);
  const payers = Math.max(0, window.uniquePayers);
  const subscribers = Math.max(0, window.subscribers);
  const d1 = Math.max(0, window.retainedUsersD1);
  const d7 = Math.max(0, window.retainedUsersD7);

  const retentionD1 = safeDiv(d1, dau);
  const retentionD7 = safeDiv(d7, dau);

  return {
    arpdauProxyUsd: round(safeDiv(revenue, dau)),
    conversionRatePct: round(safeDiv(payers, dau) * 100),
    subscriberRatePct: round(safeDiv(subscribers, dau) * 100),
    retentionD1Pct: round(retentionD1 * 100),
    retentionD7Pct: round(retentionD7 * 100),
    churnD1Pct: round((1 - retentionD1) * 100),
    churnD7Pct: round((1 - retentionD7) * 100)
  };
}
