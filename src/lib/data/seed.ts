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
export const SEED_VERSION = 4;

const MONTHS = 14;
const TODAY = new Date(2026, 4, 29); // local anchor (May 29 2026); Step-1 derives "today" from max tx date
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
    add(monthsBack, 1, 2500, "debit", "Bills & Utilities", "Emaar Real Estate", "إيجار الشقة / Apartment Rent");
    add(monthsBack, 28, jitter(287.5, 0.02), "debit", "Bills & Utilities", "stc pay", "فاتورة الجوال / Mobile Bill");
    add(monthsBack, 5, jitter(299, 0.02), "debit", "Bills & Utilities", "Mobily Home Internet", "الإنترنت المنزلي / Home Internet");
    add(monthsBack, 15, jitter(56, 0.01), "debit", "Entertainment", "Netflix", "اشتراك نتفلكس / Netflix Subscription");
    add(monthsBack, 10, jitter(350, 0.02), "debit", "Bills & Utilities", "Tawuniya Insurance", "قسط التأمين / Insurance Premium");
    add(monthsBack, 27, jitter(1200, 0.005), "debit", "Bills & Utilities", "Alinma Auto Finance", "قسط تمويل السيارة / Car Finance Installment");

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

    for (let k = 0, n = randInt(1, 3); k < n; k++)
      add(monthsBack, randInt(1, 28), rand(350, 1100), "debit", "Shopping", pick(shopMerchants), "تسوق إلكتروني / Online Shopping");
    if (rng() > 0.4)
      add(monthsBack, randInt(5, 25), rand(95, 300), "debit", "Entertainment", rng() > 0.5 ? "VOX Cinemas" : "Riyadh Boulevard", "ترفيه / Entertainment");
    if (i % 2 === 0)
      add(monthsBack, randInt(5, 25), rand(120, 400), "debit", "Healthcare", "Al-Dawaa Pharmacy", "صيدلية / Pharmacy");

    // ---- SAVINGS SINK — regular, then STOPS in the last 2 months (broken-savings story) ----
    if (i < MONTHS - 2)
      add(monthsBack, 28, 2000, "debit", "Transfers", "Alinma Savings Pot", "تحويل ادخاري شهري / Monthly Savings Transfer");
    else if (i === MONTHS - 2)
      add(monthsBack, 28, 500, "debit", "Transfers", "Alinma Savings Pot", "تحويل ادخاري مخفّض / Reduced Savings Transfer");
    // newest month: no savings transfer
  }

  // One large one-off impulse purchase (excluded from monthly-average outflow in Step-1 math)
  add(6, 15, 3800, "debit", "Shopping", "Jarir Bookstore", "مكتبة جرير - آيباد برو / iPad Pro (one-off)");

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
