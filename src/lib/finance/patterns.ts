import { Transaction } from "../data/types";

// ============================================================================
// Ma3ak — CANONICAL transaction-classification patterns (single source of truth).
// ----------------------------------------------------------------------------
// Refund / financing / transfer recognition used to be copy-pasted into
// finance/calculations.ts and forecast/engine.ts, kept aligned only by a
// "// keep this in sync" comment. When two copies drift, the report layer and
// the forecast layer disagree about what the SAME transaction is — money gets
// double-counted in one place and dropped in another. Every classifier now
// imports from here so there is exactly ONE definition of each concept.
//
// Patterns cover Saudi banking reality: Arabic + English merchant names, SADAD
// government payments, BNPL (Tamara / Tabby), wallets (STC Pay / UrPay), and the
// common reversal / installment / internal-transfer vocabularies.
// ============================================================================

/** Savings/investment transfers are allocations, not living expenses. */
export const SAVINGS_CATEGORY = "Transfers";

/**
 * A refund / reversal / chargeback: previously-spent money coming BACK.
 * It is neither income nor a fresh expense — it reverses an earlier debit.
 */
export const REFUND_PATTERN =
  /refund|reversal|reversed|charge\s*back|chargeback|returned payment|استرداد|استرجاع|مسترد|عكس عملية|عكس قيد|مرتجع|إعادة مبلغ/i;

/**
 * A committed financing payment (loan / lease / mortgage / BNPL installment).
 * The user cannot casually skip it, so it is budgeted as an obligation and kept
 * OUT of the discretionary living-outflow average (double-counting guard).
 */
export const FINANCING_PATTERN =
  /loan|financ|installment|instalment|lease|mortgage|tamara|tabby|قسط|أقساط|تمويل|مرابحة|رهن|تأجير منتهي/i;

/**
 * Internal transfer between the user's OWN pockets (savings pot, investment,
 * wallet top-up, own-account move). Never income, never a living expense.
 */
export const TRANSFER_PATTERN =
  /\bsavings?\b|investment|wallet|top[-\s]?up|stc pay|urpay|barq|own account|internal transfer|تحويل|ادخار|استثمار|محفظة|شحن محفظة|بين حساباتي|حسابي/i;

/**
 * A deliberate savings / investment allocation (the recurring "pay yourself first"
 * habit), as opposed to a plain money move like an ATM cash withdrawal that also
 * lands in the Transfers category. Lets the savings metric measure the savings
 * HABIT specifically instead of every Transfers-category debit.
 */
export const SAVINGS_PATTERN =
  /savings?|invest|pot|deposit|ادخار|توفير|استثمار|وعاء|وديعة/i;

/** A recurring savings/investment allocation debit (the "pay yourself first" habit). */
export function isSavingsAllocation(t: Transaction): boolean {
  return t.type === "debit" && t.category === SAVINGS_CATEGORY && SAVINGS_PATTERN.test(`${t.merchant} ${t.description}`);
}

/**
 * Categories whose debits are always committed obligations. Includes the finer
 * obligation categories split out of the old "Bills & Utilities" blob (Housing =
 * rent, Telecom = mobile/internet) so re-bucketing the data does NOT reclassify a
 * bill as discretionary consumption in the forecast/flow layer.
 */
export const OBLIGATION_CATEGORIES = new Set([
  "Financing", "Bills & Utilities", "Insurance", "Housing", "Telecom"
]);

/** SADAD / government bill payments (utilities, fines, fees) — obligations. */
export const GOVERNMENT_PATTERN =
  /sadad|سداد|absher|أبشر|muqeem|مقيم|traffic|مخالف|جواز|رسوم حكومية|government|أمانة/i;

const hay = (t: Transaction) => `${t.merchant} ${t.description}`;

/** A refund/reversal credit (returns spent money; must not be booked as income). */
export function isRefundTx(t: Transaction): boolean {
  return t.type === "credit" && REFUND_PATTERN.test(hay(t));
}

/** A loan/financing/BNPL installment (debit). Category "Financing" always counts. */
export function isFinancingTx(t: Transaction): boolean {
  return t.type === "debit" && (t.category === "Financing" || FINANCING_PATTERN.test(hay(t)));
}

/** An internal transfer between the user's own pockets (either direction). */
export function isInternalTransfer(t: Transaction): boolean {
  return t.category === SAVINGS_CATEGORY || TRANSFER_PATTERN.test(hay(t));
}

/**
 * True income = a credit that is NEW money entering from outside (salary, refund
 * of a fee that was itself income-like? no). Excludes refunds (reversed spend)
 * and internal transfers (own money moving between pockets). This is the guard
 * that keeps transfers and reversals from inflating earnings and surplus.
 */
export function isIncomeTx(t: Transaction): boolean {
  return t.type === "credit" && !isRefundTx(t) && !isInternalTransfer(t);
}
