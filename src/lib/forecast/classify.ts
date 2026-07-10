import { ForecastType } from "./types";

export const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
export const std = (a: number[]) => {
  const m = mean(a);
  return a.length ? Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / a.length) : 0;
};

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
 * Classify a monthly series into one of three behaviours:
 *  - trending: clear sustained direction — total drift ≥ 25% of the mean AND a good linear
 *              fit (R² ≥ 0.5), so a one-off recent spike is NOT mistaken for a trend.
 *  - fixed:    very stable (coefficient of variation ≤ 8%)
 *  - variable: recurring but fluctuating (everything else)
 */
export function classify(history: number[]): ForecastType {
  const m = mean(history);
  if (m <= 0 || history.length < 3) return "fixed";
  const cv = std(history) / m;
  const relTrend = Math.abs((slope(history) * (history.length - 1)) / m); // total change ÷ mean
  if (relTrend >= 0.25 && rSquared(history) >= 0.5) return "trending";
  if (cv <= 0.08) return "fixed";
  return "variable";
}
