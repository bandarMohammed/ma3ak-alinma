export type ForecastType = "fixed" | "variable" | "trending";

/** A single, isolated forecasting method (Strategy Pattern). Replaceable/extensible. */
export interface ForecastStrategy {
  readonly type: ForecastType;
  forecast(history: number[], horizon: number): number[];
}

export interface MerchantForecast {
  merchant: string;
  category: string;
  type: ForecastType;
  months: string[];    // YYYY-MM labels aligned with `history`
  history: number[];   // monthly totals over the last N complete months
  forecast: number[];  // next `horizon` months (code-computed, never the LLM)
  nextMonth: number;   // = forecast[0]
  monthlyAvg: number;  // mean of history
}
