import { Transaction } from "../data/types";
import { ForecastStrategy, ForecastType, FlowType, ForecastRationale, MerchantForecast } from "./types";
import { classify, capOutliers, mean, std, rSquared } from "./classify";
import { FixedStrategy, WeightedAverageStrategy, DampedTrendStrategy, SparseStrategy } from "./strategies";
import {
  REFUND_PATTERN,
  TRANSFER_PATTERN,
  FINANCING_PATTERN,
  OBLIGATION_CATEGORIES,
  SAVINGS_CATEGORY
} from "../finance/patterns";

const monthOf = (t: Transaction) => t.transaction_date.slice(0, 7);

/** Strategy Pattern selector — add new strategies here without touching callers. */
function strategyFor(type: ForecastType): ForecastStrategy {
  switch (type) {
    case "fixed": return new FixedStrategy();
    case "trending": return new DampedTrendStrategy();
    case "sparse": return new SparseStrategy();
    default: return new WeightedAverageStrategy(6);
  }
}

/** The most recent `count` COMPLETE months (drops the current, partial month). */
export function completeMonths(txs: Transaction[], count = 12): string[] {
  const months = Array.from(new Set(txs.map(monthOf))).sort();
  if (months.length <= 1) return months;
  return months.slice(0, -1).slice(-count); // drop newest (partial), keep last `count`
}

// ----------------------------------------------------------------------------
// Flow classification: is this merchant an expense at all?
// ----------------------------------------------------------------------------

export function classifyFlow(merchant: string, category: string): FlowType {
  if (category === SAVINGS_CATEGORY || TRANSFER_PATTERN.test(merchant)) return "transfer";
  if (OBLIGATION_CATEGORIES.has(category) || FINANCING_PATTERN.test(merchant)) return "obligation";
  return "consumption";
}

// ----------------------------------------------------------------------------
// Confidence: how much should the user trust this number? (deterministic 0–100)
// ----------------------------------------------------------------------------

/**
 * Three transparent factors, weighted:
 *  - history  (35%): min(1, months/6) — six months of data earns full marks;
 *  - density  (25%): share of months the merchant was actually active;
 *  - stability(40%): 1 − CV of the active months (how repeatable the amounts are);
 *                    for trending series, R² of the line (how well the trend fits).
 * Recency rule: a merchant with NO activity in its last 3 months may have been
 * cancelled/abandoned — its confidence is halved rather than pretending the old
 * pattern still holds.
 */
function computeConfidence(history: number[], type: ForecastType): number {
  const n = history.length;
  const active = history.filter(v => v > 0);
  if (!n || !active.length) return 0;

  const historyScore = Math.min(1, n / 6);
  const density = active.length / n;
  const m = mean(active);
  const stability = type === "trending"
    ? rSquared(history)
    : Math.max(0, 1 - Math.min(1, m > 0 ? std(active) / m : 1));

  let score = 100 * (0.35 * historyScore + 0.25 * density + 0.40 * stability);
  const recentlyInactive = n >= 3 && history.slice(-3).every(v => v === 0);
  if (recentlyInactive) score *= 0.5;
  return Math.round(score);
}

const confidenceLevel = (c: number): "high" | "medium" | "low" =>
  c >= 75 ? "high" : c >= 50 ? "medium" : "low";

// ----------------------------------------------------------------------------
// Rationale: plain-words explanation the AI / dashboard can display verbatim
// ----------------------------------------------------------------------------

function buildRationale(type: ForecastType, history: number[], base: number, capped: number): ForecastRationale {
  const cappedNote = capped > 0 ? ` ${capped} unusual month(s) were capped so they don't skew the estimate.` : "";
  switch (type) {
    case "fixed":
      return {
        method: "median of the last 3 months (stable commitment)",
        reason: `This payment has been almost identical every month, so next month is expected to match the recent level.${cappedNote}`,
        windowMonths: Math.min(3, history.length),
        base, outliersCapped: capped
      };
    case "trending": {
      const slopePerMonth = Math.round(new DampedTrendStrategy().fittedSlope(history));
      const dir = slopePerMonth >= 0 ? "increasing" : "decreasing";
      return {
        method: "linear trend, damped so the change levels off over time",
        reason: `Spending here has been steadily ${dir} by ~${Math.abs(slopePerMonth)} SAR/month; the projection continues that direction but assumes it gradually levels off.${cappedNote}`,
        windowMonths: history.length,
        base, slopePerMonth, outliersCapped: capped
      };
    }
    case "sparse": {
      const { cadenceMonths, amountPerOccurrence } = new SparseStrategy().stats(history);
      return {
        method: "occasional expense: typical amount spread over its typical gap",
        reason: `This is an occasional expense of ~${amountPerOccurrence} SAR roughly every ${cadenceMonths} months, so the monthly budget equivalent is shown.${cappedNote}`,
        windowMonths: history.length,
        base, cadenceMonths, amountPerOccurrence, outliersCapped: capped
      };
    }
    default:
      return {
        method: "weighted average of the last 6 months (newest weighs most)",
        reason: `Spending here recurs monthly but varies, so recent months are averaged with the newest counting most.${cappedNote}`,
        windowMonths: Math.min(6, history.length),
        base, outliersCapped: capped
      };
  }
}

/**
 * Forecasts every merchant's spending for the next `horizon` months. Groups debits by
 * merchant, classifies each series, and applies the matching strategy. Deterministic; no LLM.
 *
 * Correctness rules:
 *  - a merchant's series starts at its FIRST active month (months before it existed
 *    are unknown, not zero — padding them as 0 diluted every average);
 *  - extreme months are capped (median ± 3.5×MAD) before classification/fitting;
 *  - intermittent merchants (active < 60% of months) are forecast on their cadence,
 *    never dragged down by gap months;
 *  - every merchant is tagged consumption / obligation / transfer, so internal
 *    transfers are never mistaken for predicted expenses.
 */
export function forecastAll(txs: Transaction[], horizon = 12): MerchantForecast[] {
  const months = completeMonths(txs);
  const monthSet = new Set(months);

  // Refund credits reverse spending — net them out of the merchant's monthly
  // sums so a refunded purchase doesn't inflate the forecast. REFUND_PATTERN is
  // the canonical definition shared with the report/income layer (./patterns).
  const byMerchant = new Map<string, Transaction[]>();
  const refundsByMerchant = new Map<string, Transaction[]>();
  txs.forEach(t => {
    if (t.type === "debit") {
      const arr = byMerchant.get(t.merchant) ?? [];
      arr.push(t);
      byMerchant.set(t.merchant, arr);
    } else if (REFUND_PATTERN.test(`${t.merchant} ${t.description}`)) {
      const arr = refundsByMerchant.get(t.merchant) ?? [];
      arr.push(t);
      refundsByMerchant.set(t.merchant, arr);
    }
  });

  const out: MerchantForecast[] = [];
  for (const [merchant, list] of Array.from(byMerchant.entries())) {
    const activeMonths = new Set(list.map(monthOf).filter(m => monthSet.has(m)));
    if (activeMonths.size < 3) continue; // too sparse to forecast — noise

    // Series begins at the merchant's first active month — earlier months are
    // "merchant didn't exist yet", not "spent 0".
    const firstActiveIdx = months.findIndex(m => activeMonths.has(m));
    const merchantMonths = months.slice(firstActiveIdx);
    const refunds = refundsByMerchant.get(merchant) ?? [];
    const rawHistory = merchantMonths.map(m =>
      Math.max(0, Math.round(
        list.filter(t => monthOf(t) === m).reduce((a, t) => a + t.amount, 0) -
        refunds.filter(t => monthOf(t) === m).reduce((a, t) => a + t.amount, 0)
      ))
    );

    const { series: history, capped } = capOutliers(rawHistory);
    const type = classify(history);
    const forecast = strategyFor(type).forecast(history, horizon).map(v => Math.round(v));
    const nextMonth = forecast[0] ?? 0;
    const confidence = computeConfidence(history, type);

    // Typical monthly spend: for sparse merchants only active months are meaningful.
    const activeVals = history.filter(v => v > 0);
    const monthlyAvg = Math.round(type === "sparse" ? nextMonth : mean(activeVals.length ? history : [0]));

    // Category from the LATEST transaction — merchants get recategorized over
    // time and list[0] is arbitrary insertion order, not the current truth.
    const latestCategory = list.reduce((a, b) =>
      a.transaction_date >= b.transaction_date ? a : b
    ).category;

    out.push({
      merchant,
      category: latestCategory,
      type,
      flow: classifyFlow(merchant, latestCategory),
      months: merchantMonths,
      history,
      forecast,
      nextMonth,
      monthlyAvg,
      confidence,
      confidenceLevel: confidenceLevel(confidence),
      rationale: buildRationale(type, history, nextMonth, capped)
    });
  }
  return out.sort((a, b) => b.monthlyAvg - a.monthlyAvg);
}

// ----------------------------------------------------------------------------
// Compact next-month outlook (for the AI context / future dashboard cards)
// ----------------------------------------------------------------------------

export interface ForecastSummaryItem {
  merchant: string;
  category: string;
  flow: FlowType;
  expected: number;
  confidence: number;
  confidenceLevel: "high" | "medium" | "low";
  type: ForecastType;
  method: string;
  reason: string;
}

export interface ForecastSummary {
  /** Predicted living/lifestyle spend next month (excludes transfers & obligations). */
  nextMonthConsumption: number;
  /** Predicted committed payments next month (financing, bills, insurance, rent). */
  nextMonthObligations: number;
  /** Predicted internal transfers next month (savings/investments — not an expense). */
  nextMonthTransfers: number;
  /** Consumption + obligations. What actually leaves the user's pocket. */
  nextMonthTotalExpenses: number;
  items: ForecastSummaryItem[];
}

export function summarizeForecast(txs: Transaction[], topN = 8): ForecastSummary {
  const all = forecastAll(txs, 1);
  const totalFor = (flow: FlowType) =>
    Math.round(all.filter(f => f.flow === flow).reduce((s, f) => s + f.nextMonth, 0));

  const nextMonthConsumption = totalFor("consumption");
  const nextMonthObligations = totalFor("obligation");
  const nextMonthTransfers = totalFor("transfer");

  const items = all.slice(0, topN).map(f => ({
    merchant: f.merchant,
    category: f.category,
    flow: f.flow,
    expected: f.nextMonth,
    confidence: f.confidence,
    confidenceLevel: f.confidenceLevel,
    type: f.type,
    method: f.rationale.method,
    reason: f.rationale.reason
  }));

  return {
    nextMonthConsumption,
    nextMonthObligations,
    nextMonthTransfers,
    nextMonthTotalExpenses: nextMonthConsumption + nextMonthObligations,
    items
  };
}
