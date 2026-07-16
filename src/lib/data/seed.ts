import { Transaction } from "./types";

// ============================================================================
// Ma3ak — deterministic mock data generator (Step 2)
// ----------------------------------------------------------------------------
// Generates ~14 months of realistic Saudi transactions for a single customer.
// Each MERCHANT follows exactly ONE behaviour so the Step-3 forecasting engine
// can classify and forecast every series independently:
//   • FIXED commitments   → nearly identical each month (rent, subscriptions, loan)
//   • VARIABLE recurring  → recurs but fluctuates (fuel, food, groceries, coffee)
//   • TRENDING            → clear monotonic direction (electricity, water)
// A seeded PRNG makes the whole dataset reproducible across reloads.
// ============================================================================

/** Bump to force existing localStorage to re-seed with the new dataset. */
export const SEED_VERSION = 7;

const MONTHS = 14;
// Anchor to the REAL current date so the dataset always reaches "today".
// A frozen anchor left a growing gap between the data and the real clock,
// making any report range that extended past the frozen date look wrong
// (e.g. missing salaries). Month 0 only generates days up to today's date.
const TODAY = new Date();
const TARGET_END_BALANCE = 12450.75;

const round2 = (n: number) => Math.round(n * 100) / 100;

// --- deterministic PRNG (mulberry32) -----------------------------------------
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function dateFor(monthsBack: number, day: number): string {
  const d = new Date(TODAY.getFullYear(), TODAY.getMonth() - monthsBack, day);
  // Format from LOCAL components (not toISOString) to avoid a UTC off-by-one day shift.
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export interface SeedResult {
  transactions: Transaction[];
  balance: number;
}

/**
 * Generates the full transaction history + the resulting account balance.
 * `seedKey` makes the data deterministic per user (demo user is always identical).
 */
export function generateTransactions(userId: string, accountId: string, seedKey: string): SeedResult {
  const rng = mulberry32(hashSeed(seedKey));
  const rand = (min: number, max: number) => min + rng() * (max - min);
  const randInt = (min: number, max: number) => Math.floor(rand(min, max + 1));
  const jitter = (base: number, pct: number) => base * (1 + (rng() * 2 - 1) * pct);
  const pick = <T>(arr: T[]): T => arr[randInt(0, arr.length - 1)];

  const list: Omit<Transaction, "id">[] = [];
  const add = (
    monthsBack: number,
    day: number,
    amount: number,
    type: "credit" | "debit",
    category: string,
    merchant: string,
    description: string
  ) => {
    if (monthsBack === 0 && day > TODAY.getDate()) return; // don't create future-dated txs
    if (!(amount > 0)) return;
    list.push({
      user_id: userId,
      account_id: accountId,
      amount: round2(amount),
      type,
      category,
      merchant,
      description,
      transaction_date: dateFor(monthsBack, day)
    });
  };

  const foodMerchants = ["Hungerstation", "Jahez", "KFC", "McDonalds"];
  const groceryMerchants = ["Othaim Markets", "Tamimi Markets", "Panda Supermarket"];
  const coffeeMerchants = ["Starbucks", "% Arabica", "Barns"];
  const shopMerchants = ["Amazon.sa", "Noon.com", "Zara Store"];

  for (let i = 0; i < MONTHS; i++) {
    const monthsBack = MONTHS - 1 - i; // i = 0 (oldest) → newest
    const trend = i / (MONTHS - 1); // 0 (oldest) → 1 (newest)
    const spike = i >= MONTHS - 2; // last 2 months: delivery over-spend story

    // ---- INCOME (fixed) ----
    add(monthsBack, 27, 15000, "credit", "Salary", "Alinma Bank Payroll", "راتب شهري / Monthly Salary");

    // ---- FIXED COMMITMENTS (<5% variation) ----
    // Categories are split into REAL obligation types (Housing / Telecom / Insurance
    // / Financing) instead of one opaque "Bills & Utilities" blob, so the report's
    // category breakdown, the commitments card, and advice can distinguish rent from
    // a phone bill from a car loan. Electricity, water and SADAD remain genuine
    // "Bills & Utilities". Each new category is registered in the engine's obligation
    // set and in the UI category registry, so nothing renders or classifies worse.
    add(monthsBack, 1, 2500, "debit", "Housing", "Emaar Real Estate", "إيجار الشقة / Apartment Rent");
    add(monthsBack, 28, jitter(287.5, 0.02), "debit", "Telecom", "stc pay", "فاتورة الجوال / Mobile Bill");
    add(monthsBack, 5, jitter(299, 0.02), "debit", "Telecom", "Mobily Home Internet", "الإنترنت المنزلي / Home Internet");
    add(monthsBack, 15, jitter(56, 0.01), "debit", "Entertainment", "Netflix", "اشتراك نتفلكس / Netflix Subscription");
    add(monthsBack, 10, jitter(350, 0.02), "debit", "Insurance", "Tawuniya Insurance", "قسط التأمين / Insurance Premium");
    add(monthsBack, 27, jitter(1200, 0.005), "debit", "Financing", "Alinma Auto Finance", "قسط تمويل السيارة / Car Finance Installment");

    // ---- TRENDING (clear upward direction) ----
    add(monthsBack, 5, (320 + trend * (680 - 320)) * (1 + (rng() * 2 - 1) * 0.04), "debit", "Bills & Utilities", "Saudi Electricity Co.", "فاتورة الكهرباء / Electricity Bill");
    add(monthsBack, 8, (75 + trend * (135 - 75)) * (1 + (rng() * 2 - 1) * 0.05), "debit", "Bills & Utilities", "National Water Company", "فاتورة المياه / Water Bill");

    // ---- VARIABLE RECURRING (recurs, fluctuates) ----
    for (let k = 0, n = randInt(4, 6); k < n; k++)
      add(monthsBack, randInt(2, 27), rand(55, 110), "debit", "Transportation", "Aldrees Petrol Station", "وقود / Fuel");
    for (let k = 0, n = randInt(2, 4); k < n; k++)
      add(monthsBack, randInt(2, 27), rand(20, 50), "debit", "Transportation", "Careem", "مشوار كريم / Careem Ride");

    for (let k = 0, n = spike ? randInt(13, 17) : randInt(9, 13); k < n; k++) {
      const m = pick(foodMerchants);
      add(monthsBack, randInt(1, 28), rand(spike ? 80 : 50, spike ? 170 : 115), "debit", "Food & Restaurants", m, `${m} - توصيل طعام / Food Delivery`);
    }
    for (let w = 0; w < 4; w++)
      add(monthsBack, 3 + w * 7, rand(650, 1000), "debit", "Food & Restaurants", groceryMerchants[w % 3], "مقاضي / Groceries");
    for (let k = 0, n = randInt(7, 11); k < n; k++)
      add(monthsBack, randInt(1, 28), rand(18, 45), "debit", "Food & Restaurants", pick(coffeeMerchants), "قهوة / Coffee");
    for (let k = 0, n = randInt(2, 4); k < n; k++)
      add(monthsBack, randInt(1, 28), rand(120, 280), "debit", "Food & Restaurants", "Section B Restaurant", "مطعم / Dining Out");

    // Salary-cycle realism: larger DISCRETIONARY buys (online shopping) happen while
    // the account is flush — early in the month, funded by the 27th salary — NOT in
    // the pre-salary low-liquidity window (days ~20–26). Timing only: same merchants,
    // category, amounts and counts; just placed where the cash to afford them exists.
    for (let k = 0, n = randInt(1, 3); k < n; k++)
      add(monthsBack, randInt(1, 18), rand(350, 1100), "debit", "Shopping", pick(shopMerchants), "تسوق إلكتروني / Online Shopping");
    if (rng() > 0.4)
      add(monthsBack, randInt(5, 25), rand(95, 300), "debit", "Entertainment", rng() > 0.5 ? "VOX Cinemas" : "Riyadh Boulevard", "ترفيه / Entertainment");
    if (i % 2 === 0)
      add(monthsBack, randInt(5, 25), rand(120, 400), "debit", "Healthcare", "Al-Dawaa Pharmacy", "صيدلية / Pharmacy");

    // ---- SADAD / GOVERNMENT PAYMENT (sparse, irregular) ----
    // Realistic Saudi behaviour: an occasional SADAD-settled traffic fine. Kept to
    // exactly two occurrences across the history so it reads as an irregular
    // government charge — NOT a monthly commitment (commitment detection requires
    // 3+ active months, so this correctly stays out of the commitments list).
    if (i === 4 || i === 10)
      add(monthsBack, randInt(12, 20), pick([150, 300, 500]), "debit", "Bills & Utilities", "SADAD Government Payment", "سداد مخالفة مرورية / SADAD Traffic Violation");

    // ---- BNPL INSTALLMENT (Tabby) — a recent buy-now-pay-later plan ----
    // The merchant name carries "Tabby", so the shared FINANCING_PATTERN books it
    // as a financing OBLIGATION (not discretionary shopping) and keeps it out of
    // the discretionary-outflow average. Present only in the last 4 months (a
    // 4-instalment plan), which is realistic and exercises BNPL detection.
    if (i >= MONTHS - 4)
      add(monthsBack, 18, 249.75, "debit", "Shopping", "Tabby", "قسط تابي (اشترِ الآن وادفع لاحقاً) / Tabby Installment (BNPL)");

    // ---- SEASONAL SPENDING (Ramadan / Eid uplift) ----
    // Saudi spending spikes around Ramadan & Eid (gifts, groceries, gatherings).
    // A single extra seasonal purchase in two months adds realistic seasonality
    // that the robust (winsorized) statistics are designed to absorb without
    // letting one festive month masquerade as the customer's "typical" level.
    // Festive spend is funded by payday, so it lands just after the 27th salary
    // (early in the month) — not in the tight pre-salary days. Timing only.
    if (i === 6 || i === 7)
      add(monthsBack, randInt(1, 8), rand(700, 1400), "debit", "Shopping", "Eid & Ramadan Purchases", "مشتريات العيد ورمضان / Seasonal Eid & Ramadan Spend");

    // ---- SAVINGS SINK — regular, then STOPS in the last 2 months (broken-savings story) ----
    if (i < MONTHS - 2)
      add(monthsBack, 28, 2000, "debit", "Transfers", "Alinma Savings Pot", "تحويل ادخاري شهري / Monthly Savings Transfer");
    else if (i === MONTHS - 2)
      add(monthsBack, 28, 500, "debit", "Transfers", "Alinma Savings Pot", "تحويل ادخاري مخفّض / Reduced Savings Transfer");
    // newest month: no savings transfer
  }

  // One large one-off impulse purchase (excluded from monthly-average outflow in Step-1 math).
  // Placed on day 28 — right after the 27th salary — so a 3,800 SAR buy is made when the
  // account is at its fullest, not drawn from a thin pre-salary balance. Timing only.
  add(6, 28, 3800, "debit", "Shopping", "Jarir Bookstore", "مكتبة جرير - آيباد برو / iPad Pro (one-off)");

  // ---- REFUNDS / REVERSALS (money coming BACK — reverse spend, never add income) ----
  // Two real-world reversals: a cancelled food-delivery order and an online-shopping
  // return. These exercise the refund path end-to-end — the report subtracts them
  // from their category's outflow, the forecast engine nets them out of the
  // merchant's monthly total, and income is NOT inflated (money is conserved).
  add(1, 12, 96.5, "credit", "Food & Restaurants", "Jahez", "استرداد قيمة طلب ملغى / Cancelled Order Refund");
  add(2, 20, 420, "credit", "Shopping", "Noon.com", "استرجاع مبلغ مشتريات / Online Purchase Refund");

  // ---- INTERNAL TRANSFER CREDIT (own money returning) — NOT income ----
  // The savings habit broke in the last two months; here the customer pulls part
  // of the pot back for an emergency. Money moving from the user's OWN savings pot
  // into checking is an INTERNAL TRANSFER, so avgMonthlyIncome must exclude it —
  // counting it as income would fabricate ~1,500 SAR of earnings that never came
  // from outside the household (data-integrity: transfers must not inflate income).
  add(1, 5, 1500, "credit", "Transfers", "Alinma Savings Pot", "سحب من الوعاء الادخاري / Savings Pot Withdrawal");

  // ---- Balance: back-compute a positive start so the ending balance is realistic ----
  list.sort((a, b) => a.transaction_date.localeCompare(b.transaction_date));
  let netSum = 0;
  list.forEach(t => { netSum += t.type === "credit" ? t.amount : -t.amount; });
  let startBalance = TARGET_END_BALANCE - netSum;
  if (startBalance < 2000) startBalance = 2000; // keep historical balance positive & realistic
  const balance = round2(startBalance + netSum);

  const transactions: Transaction[] = list.map((t, idx) => ({ ...t, id: `tx-${seedKey}-${idx + 1}` }));
  transactions.sort((a, b) => b.transaction_date.localeCompare(a.transaction_date)); // newest first (banking UI)

  return { transactions, balance };
}
