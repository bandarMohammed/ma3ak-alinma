import { Transaction } from "../data/types";
import { ForecastStrategy, ForecastType, MerchantForecast } from "./types";
import { classify } from "./classify";
import { FixedStrategy, ExponentialSmoothingStrategy, LinearRegressionStrategy } from "./strategies";

const monthOf = (t: Transaction) => t.transaction_date.slice(0, 7);

/** Strategy Pattern selector — add new strategies here without touching callers. */
function strategyFor(type: ForecastType): ForecastStrategy {
  switch (type) {
    case "fixed": return new FixedStrategy();
    case "trending": return new LinearRegressionStrategy();
    default: return new ExponentialSmoothingStrategy(0.4);
  }
}

/** The most recent `count` COMPLETE months (drops the current, partial month). */
export function completeMonths(txs: Transaction[], count = 12): string[] {
  const months = Array.from(new Set(txs.map(monthOf))).sort();
  if (months.length <= 1) return months;
  return months.slice(0, -1).slice(-count); // drop newest (partial), keep last `count`
}

/**
 * Forecasts every merchant's spending for the next `horizon` months. Groups debits by
 * merchant, classifies each series, and applies the matching strategy. Deterministic; no LLM.
 */
export function forecastAll(txs: Transaction[], horizon = 12): MerchantForecast[] {
  const months = completeMonths(txs);
  const monthSet = new Set(months);

  const byMerchant = new Map<string, Transaction[]>();
  txs.filter(t => t.type === "debit").forEach(t => {
    const arr = byMerchant.get(t.merchant) ?? [];
    arr.push(t);
    byMerchant.set(t.merchant, arr);
  });

  const out: MerchantForecast[] = [];
  for (const [merchant, list] of Array.from(byMerchant.entries())) {
    const activeMonths = new Set(list.map(monthOf).filter(m => monthSet.has(m)));
    if (activeMonths.size < 3) continue; // too sparse to forecast — noise

    const history = months.map(m =>
      Math.round(list.filter(t => monthOf(t) === m).reduce((a, t) => a + t.amount, 0))
    );
    const type = classify(history);
    const forecast = strategyFor(type).forecast(history, horizon).map(v => Math.round(v));

    out.push({
      merchant,
      category: list[0].category,
      type,
      months,
      history,
      forecast,
      nextMonth: forecast[0] ?? 0,
      monthlyAvg: Math.round(history.reduce((a, b) => a + b, 0) / history.length)
    });
  }
  return out.sort((a, b) => b.monthlyAvg - a.monthlyAvg);
}
