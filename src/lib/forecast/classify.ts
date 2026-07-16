import { ForecastType } from "./types";

export const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
export const std = (a: number[]) => {
  const m = mean(a);
  return a.length ? Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / a.length) : 0;
};

export function median(a: number[]): number {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Median Absolute Deviation — robust spread measure for outlier detection. */
export function mad(a: number[]): number {
  const m = median(a);
  return median(a.map(v => Math.abs(v - m)));
}

/**
 * Caps extreme months at median ± 3.5×MAD (winsorizing, not deleting — the month
 * still exists, its distorting magnitude is limited). Deterministic and explainable:
 * "one unusually large month was capped so it doesn't skew the average".
 * Only nonzero values are considered; returns the capped series + how many were capped.
 */
export function capOutliers(history: number[]): { series: number[]; capped: number } {
  const nonzero = history.filter(v => v > 0);
  if (nonzero.length < 4) return { series: history, capped: 0 }; // too little data to judge outliers
  const m = median(nonzero);
  const spread = mad(nonzero);
  if (spread === 0) return { series: history, capped: 0 }; // perfectly stable series
  const hi = m + 3.5 * spread;
  const lo = Math.max(0, m - 3.5 * spread);
  let capped = 0;
  const series = history.map(v => {
    if (v === 0) return v; // zeros are gaps/no-spend, not outliers
    if (v > hi) { capped++; return hi; }
    if (v < lo) { capped++; return lo; }
    return v;
  });
  return { series, capped };
}

/** Least-squares slope over indices 0..n-1. */
export function slope(a: number[]): number {
  const n = a.length;
  if (n < 2) return 0;
  const mx = (n - 1) / 2, my = mean(a);
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += (i - mx) * (a[i] - my); den += (i - mx) ** 2; }
  return den === 0 ? 0 : num / den;
}

/** R² of the linear fit (index vs value) — how well a straight line explains the series. */
export function rSquared(a: number[]): number {
  const n = a.length;
  if (n < 2) return 0;
  const mx = (n - 1) / 2, my = mean(a);
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) { const ex = i - mx, ey = a[i] - my; num += ex * ey; dx += ex * ex; dy += ey * ey; }
  if (dx === 0 || dy === 0) return 0;
  const r = num / Math.sqrt(dx * dy);
  return r * r;
}

/**
 * Classify a monthly series (already trimmed to start at the merchant's first
 * active month) into one of four behaviours:
 *  - sparse:   intermittent — active in fewer than 60% of the months since first
 *              seen (e.g. car maintenance, school fees). Zero months are GAPS.
 *  - trending: clear sustained direction — total drift ≥ 25% of the mean AND a good
 *              linear fit (R² ≥ 0.5), so a one-off spike is NOT mistaken for a trend.
 *  - fixed:    very stable (coefficient of variation ≤ 8%)
 *  - variable: recurring but fluctuating (everything else)
 */
export function classify(history: number[]): ForecastType {
  const m = mean(history);
  if (m <= 0 || history.length < 3) return "fixed";

  const activeRatio = history.filter(v => v > 0).length / history.length;
  if (activeRatio < 0.6) return "sparse";

  const cv = std(history) / m;
  const relTrend = Math.abs((slope(history) * (history.length - 1)) / m); // total change ÷ mean
  if (relTrend >= 0.25 && rSquared(history) >= 0.5) return "trending";
  if (cv <= 0.08) return "fixed";
  return "variable";
}
