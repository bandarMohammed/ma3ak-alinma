export type ForecastType = "fixed" | "variable" | "trending" | "sparse";

/** What kind of money movement this merchant represents. */
export type FlowType =
  | "consumption"   // living/lifestyle spend (food, shopping, transport, …)
  | "obligation"    // committed payments (financing installments, bills, insurance, rent)
  | "transfer";     // internal movements (savings pot, investments, wallet top-ups) — NOT an expense

/** A single, isolated forecasting method (Strategy Pattern). Replaceable/extensible. */
export interface ForecastStrategy {
  readonly type: ForecastType;
  forecast(history: number[], horizon: number): number[];
}

/**
 * Machine-readable explanation of HOW a forecast was produced, so the AI (or a
 * future dashboard widget) can always answer "why this number?". Every field is
 * deterministic — nothing here comes from an LLM.
 */
export interface ForecastRationale {
  /** The model used, in plain words (e.g. "median of last 3 months"). */
  method: string;
  /** One plain-words sentence explaining why this prediction looks the way it does. */
  reason: string;
  /** Number of history months the model actually used. */
  windowMonths: number;
  /** The level (SAR/month) the forecast starts from. */
  base: number;
  /** Trending only: fitted SAR change per month (before damping). */
  slopePerMonth?: number;
  /** Sparse only: typical gap between payments, in months. */
  cadenceMonths?: number;
  /** Sparse only: typical amount per occurrence (monthly forecast = amount ÷ cadence). */
  amountPerOccurrence?: number;
  /** How many outlier months were capped before fitting (0 = clean series). */
  outliersCapped: number;
}

export interface MerchantForecast {
  merchant: string;
  category: string;
  type: ForecastType;
  flow: FlowType;
  months: string[];    // YYYY-MM labels aligned with `history` (starts at merchant's first active month)
  history: number[];   // monthly totals since the merchant became active
  forecast: number[];  // next `horizon` months (code-computed, never the LLM)
  nextMonth: number;   // = forecast[0]
  monthlyAvg: number;  // typical monthly spend (active-month based for sparse merchants)
  /** 0–100. Blend of history length, data density, and series stability (fit quality for trends). */
  confidence: number;
  confidenceLevel: "high" | "medium" | "low";
  rationale: ForecastRationale;
}
