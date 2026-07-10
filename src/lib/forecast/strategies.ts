import { ForecastStrategy, ForecastType } from "./types";

const round2 = (n: number) => Math.round(n * 100) / 100;
const clampPos = (n: number) => (n < 0 ? 0 : round2(n));

/** FIXED commitments: stable series → repeat the recent average (robust to tiny jitter). */
export class FixedStrategy implements ForecastStrategy {
  readonly type: ForecastType = "fixed";
  forecast(history: number[], horizon: number): number[] {
    const recent = history.slice(-3);
    const base = recent.length ? mean(recent) : history[history.length - 1] ?? 0;
    return Array.from({ length: horizon }, () => clampPos(base));
  }
}

/** VARIABLE recurring: Exponential Smoothing (alpha configurable, default 0.4). */
export class ExponentialSmoothingStrategy implements ForecastStrategy {
  readonly type: ForecastType = "variable";
  constructor(private alpha = 0.4) {}
  forecast(history: number[], horizon: number): number[] {
    if (!history.length) return Array(horizon).fill(0);
    let s = history[0];
    for (let i = 1; i < history.length; i++) s = this.alpha * history[i] + (1 - this.alpha) * s;
    return Array.from({ length: horizon }, () => clampPos(s)); // flat forecast at last smoothed level
  }
}

/** TRENDING: Linear Regression → project the least-squares line forward. */
export class LinearRegressionStrategy implements ForecastStrategy {
  readonly type: ForecastType = "trending";
  forecast(history: number[], horizon: number): number[] {
    const n = history.length;
    if (n < 2) return Array(horizon).fill(clampPos(history[0] ?? 0));
    const mx = (n - 1) / 2;
    const my = mean(history);
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) { num += (i - mx) * (history[i] - my); den += (i - mx) ** 2; }
    const slope = den === 0 ? 0 : num / den;
    const intercept = my - slope * mx;
    return Array.from({ length: horizon }, (_, h) => clampPos(intercept + slope * (n - 1 + h + 1)));
  }
}

function mean(a: number[]) { return a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0; }
