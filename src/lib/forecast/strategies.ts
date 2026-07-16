import { ForecastStrategy, ForecastType } from "./types";
import { mean, median } from "./classify";

const round2 = (n: number) => Math.round(n * 100) / 100;
const clampPos = (n: number) => (n < 0 ? 0 : round2(n));

/**
 * FIXED commitments: stable series → repeat the median of the last 3 months.
 * Median (not mean) so a single mischarged/double-billed month can't shift the level.
 */
export class FixedStrategy implements ForecastStrategy {
  readonly type: ForecastType = "fixed";
  forecast(history: number[], horizon: number): number[] {
    const recent = history.slice(-3).filter(v => v > 0);
    const base = recent.length ? median(recent) : history[history.length - 1] ?? 0;
    return Array.from({ length: horizon }, () => clampPos(base));
  }
}

/**
 * VARIABLE recurring: linearly-weighted moving average of the last 6 months
 * (weights 1..6, newest heaviest). Directly explainable: "your recent months,
 * with the latest counting most". Months with zero spend still count — for a
 * monthly-recurring merchant a zero month is real information, not a gap
 * (gaps are handled by SparseStrategy instead).
 */
export class WeightedAverageStrategy implements ForecastStrategy {
  readonly type: ForecastType = "variable";
  constructor(private window = 6) {}
  forecast(history: number[], horizon: number): number[] {
    if (!history.length) return Array(horizon).fill(0);
    const recent = history.slice(-this.window);
    let num = 0, den = 0;
    recent.forEach((v, i) => { const w = i + 1; num += w * v; den += w; });
    const base = den ? num / den : 0;
    return Array.from({ length: horizon }, () => clampPos(base));
  }
}

/**
 * TRENDING: least-squares line projected forward with DAMPING (φ = 0.85).
 * Month h ahead adds slope·φ + slope·φ² + … — the trend continues but flattens,
 * so a 12-month projection can't explode to absurd values. Explainable as:
 * "spend is changing ~slope SAR/month and we assume that change gradually levels off".
 */
export class DampedTrendStrategy implements ForecastStrategy {
  readonly type: ForecastType = "trending";
  constructor(private phi = 0.85) {}
  forecast(history: number[], horizon: number): number[] {
    const n = history.length;
    if (n < 2) return Array(horizon).fill(clampPos(history[0] ?? 0));
    const mx = (n - 1) / 2;
    const my = mean(history);
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) { num += (i - mx) * (history[i] - my); den += (i - mx) ** 2; }
    const slope = den === 0 ? 0 : num / den;
    const level = my + slope * (n - 1 - mx); // fitted value at the last observed month
    const out: number[] = [];
    let cum = 0, step = slope;
    for (let h = 0; h < horizon; h++) {
      step *= this.phi;
      cum += step;
      out.push(clampPos(level + cum));
    }
    return out;
  }

  /** Exposed so the engine can report the fitted slope in the rationale. */
  fittedSlope(history: number[]): number {
    const n = history.length;
    if (n < 2) return 0;
    const mx = (n - 1) / 2, my = mean(history);
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) { num += (i - mx) * (history[i] - my); den += (i - mx) ** 2; }
    return den === 0 ? 0 : num / den;
  }
}

/**
 * SPARSE / intermittent (e.g. car maintenance every ~6 months): zero months are
 * GAPS, not zero demand — averaging them in would understate the real obligation.
 * Model: typical amount per occurrence ÷ typical cadence = monthly-equivalent
 * budget. Explainable as: "you pay ~X every ~N months, so set aside X/N monthly".
 */
export class SparseStrategy implements ForecastStrategy {
  readonly type: ForecastType = "sparse";
  forecast(history: number[], horizon: number): number[] {
    const active = history.filter(v => v > 0);
    if (!active.length) return Array(horizon).fill(0);
    const cadence = Math.max(1, history.length / active.length); // months per occurrence
    const perOccurrence = median(active);
    const monthlyEquivalent = perOccurrence / cadence;
    return Array.from({ length: horizon }, () => clampPos(monthlyEquivalent));
  }

  /** Cadence + typical amount, exposed for the rationale. */
  stats(history: number[]): { cadenceMonths: number; amountPerOccurrence: number } {
    const active = history.filter(v => v > 0);
    if (!active.length) return { cadenceMonths: 0, amountPerOccurrence: 0 };
    return {
      cadenceMonths: round2(Math.max(1, history.length / active.length)),
      amountPerOccurrence: round2(median(active))
    };
  }
}
