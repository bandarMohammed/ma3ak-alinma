import { Transaction } from "../data/types";
import { UserContext } from "../simulator/types";

// ============================================================================
// Ma3ak — SINGLE SOURCE OF TRUTH for all money math.
// Every monetary figure the app shows (totals, ratios, %, balances, DTI inputs,
// report/habits numbers) is computed HERE in deterministic code. The LLM never
// does arithmetic — it only phrases the numbers these functions return.
// ============================================================================

/** Savings transfers are allocations, not living expenses — excluded from outflow. */
const SAVINGS_CATEGORY = "Transfers";
/** Large one-off impulse buys that would distort a monthly average. */
const ONE_OFF_MERCHANTS = new Set(["Jarir Bookstore"]);

/** A loan / financing installment (counted as existingFinancingPayments, so it must
 *  NOT also be counted inside the living-outflow average — that would double-count it). */
function isFinancingTx(t: Transaction): boolean {
  return t.type === "debit" && (
    t.category === "Financing" ||
    /loan|financ|installment|قسط|تمويل|مرابحة|رهن/i.test(t.merchant)
  );
}
/** Last-resort demo balance when the client doesn't supply one (client normally does). */
const FALLBACK_BALANCE = 12450.75;

const round2 = (n: number) => Math.round(n * 100) / 100;

// ----------------------------------------------------------------------------
// Primitives
// ----------------------------------------------------------------------------

/**
 * "Today" for the simulated timeline.
 * 
 * The seed data is anchored around a specific date (May 29, 2026). If a user
 * pays a commitment or creates a transaction while the real system date is far
 * in the future (e.g. July 2026), a naive "max date" would jump the entire
 * timeline forward, breaking all date-range filters (reports, habits, etc.).
 *
 * Strategy: sort all distinct dates, use the 95th-percentile date as the anchor.
 * If the absolute max is more than 45 days beyond that anchor, it's an outlier
 * from a real-clock transaction — ignore it.
 */
export function deriveToday(txs: Transaction[]): string {
  if (!txs.length) return new Date().toISOString().split("T")[0];

  const dates = Array.from(new Set(txs.map(t => t.transaction_date))).sort();
  if (dates.length <= 2) return dates[dates.length - 1];

  // 95th percentile date (ignores top 5% outliers)
  const p95Idx = Math.min(dates.length - 1, Math.floor(dates.length * 0.95));
  const anchorDate = dates[p95Idx];
  const maxDate = dates[dates.length - 1];

  // If max is more than 45 days beyond the p95 anchor, it's an outlier
  const anchorMs = new Date(anchorDate).getTime();
  const maxMs = new Date(maxDate).getTime();
  const daysDiff = (maxMs - anchorMs) / (1000 * 60 * 60 * 24);

  return daysDiff > 45 ? anchorDate : maxDate;
}

const monthOf = (t: Transaction) => t.transaction_date.slice(0, 7); // YYYY-MM

/**
 * "Active" months = real monthly cycles. A month with only 1–2 transactions is a
 * data-window spillover (e.g. a single rent that landed just outside the intended
 * range) and would dilute every average — so it is dropped. Falls back to all
 * months if none reach the threshold (very sparse data).
 */
function activeMonths(txs: Transaction[]): Set<string> {
  const counts: Record<string, number> = {};
  txs.forEach(t => { counts[monthOf(t)] = (counts[monthOf(t)] || 0) + 1; });
  const active = Object.keys(counts).filter(m => counts[m] >= 3);
  return new Set(active.length ? active : Object.keys(counts));
}

/** Number of distinct active monthly cycles in the data (never 0). */
export function monthsSpan(txs: Transaction[]): number {
  return Math.max(1, activeMonths(txs).size);
}

/**
 * Average monthly total of the transactions matching `predicate`, computed over the
 * ACTIVE months that actually contain such transactions (so income ÷ salary-months,
 * outflow ÷ spending-months — no dilution by boundary/partial months).
 */
function monthlyAverage(txs: Transaction[], predicate: (t: Transaction) => boolean): number {
  const active = activeMonths(txs);
  const relevant = txs.filter(t => predicate(t) && active.has(monthOf(t)));
  if (!relevant.length) return 0;
  const monthsWith = new Set(relevant.map(monthOf)).size;
  const sum = relevant.reduce((acc, t) => acc + t.amount, 0);
  return Math.round(sum / Math.max(1, monthsWith));
}

/** Average monthly income = credits ÷ number of months that received income. */
export function avgMonthlyIncome(txs: Transaction[]): number {
  return monthlyAverage(txs, t => t.type === "credit");
}

/** Average monthly living outflow = debits (excl. savings transfers, one-off impulses & financing). */
export function avgMonthlyOutflow(txs: Transaction[]): number {
  return monthlyAverage(
    txs,
    t => t.type === "debit" && t.category !== SAVINGS_CATEGORY && !ONE_OFF_MERCHANTS.has(t.merchant) && !isFinancingTx(t)
  );
}

/** Real loan/financing installments only (accounted separately from living outflow). */
export function detectFinancingPayments(txs: Transaction[]): number {
  return monthlyAverage(txs, isFinancingTx);
}

/** Typical recurring monthly savings transfer (max month, from history — not a literal). */
export function typicalMonthlySaving(txs: Transaction[]): number {
  const byMonth: Record<string, number> = {};
  txs
    .filter(t => t.type === "debit" && t.category === SAVINGS_CATEGORY)
    .forEach(t => {
      const m = t.transaction_date.slice(0, 7);
      byMonth[m] = (byMonth[m] || 0) + t.amount;
    });
  const values = Object.values(byMonth);
  return values.length ? Math.round(Math.max(...values)) : 0;
}

// ----------------------------------------------------------------------------
// Financial profile (feeds the deterministic simulators)
// ----------------------------------------------------------------------------

/** Corrected UserContext: real balance as savings, detected financing, month-span averages. */
export function buildFinancialProfile(txs: Transaction[], balance?: number): UserContext {
  const monthlyIncome = avgMonthlyIncome(txs) || 15000;
  
  // Calculate essential fixed obligations (Rent, Utilities, Insurance)
  // excluding variable lifestyle costs like restaurants, coffee, Careem, or shopping
  const monthlyFixedExpenses = monthlyAverage(
    txs,
    t => t.type === "debit" && (
      t.category === "Bills & Utilities" ||
      t.category === "Insurance" ||
      t.merchant === "Emaar Real Estate"
    ) && !isFinancingTx(t)
  ) || 4000;

  const monthlyTotalExpenses = avgMonthlyOutflow(txs) || 0;
  const existingFinancingPayments = detectFinancingPayments(txs);
  const currentSavings = typeof balance === "number" && isFinite(balance) && balance > 0
    ? round2(balance)
    : FALLBACK_BALANCE;

  return { monthlyIncome, monthlyFixedExpenses, monthlyTotalExpenses, currentSavings, existingFinancingPayments };
}

// ----------------------------------------------------------------------------
// Reports (was inline in route.ts — now callable regardless of USE_MOCK_AI)
// ----------------------------------------------------------------------------

export interface ReportResult {
  type: "report";
  period: string;
  total_spent: number;
  total_income: number;
  top_categories: { category: string; amount: number; percentage: number }[];
  largest_transactions: Transaction[];
  insights: string[];
}

function periodLabel(daysRange: number, isArabic: boolean): string {
  if (daysRange <= 7) return isArabic ? "الأسبوع الماضي" : "Last 7 Days";
  if (daysRange <= 15) return isArabic ? "الـ 15 يوماً الماضية" : "Last 15 Days";
  if (daysRange <= 45) return isArabic ? "الشهر الماضي" : "Last Month";
  if (daysRange <= 100) return isArabic ? "الـ 3 أشهر الماضية" : "Last 3 Months";
  if (daysRange <= 200) return isArabic ? "الـ 6 أشهر الماضية" : "Last 6 Months";
  return isArabic ? "السنة الماضية" : "Last Year";
}

/** Deterministic spending report over the last daysRange or custom date range. */
export function computeReport(
  txs: Transaction[],
  range: number | { startDate: string; endDate: string },
  language: "ar" | "en"
): ReportResult {
  const isArabic = language === "ar";
  let filteredTxs: Transaction[] = [];
  let periodText = "";

  if (typeof range === "number") {
    const today = new Date(deriveToday(txs));
    const startDateLimit = new Date(today);
    startDateLimit.setDate(today.getDate() - range);
    filteredTxs = txs.filter(t => new Date(t.transaction_date) >= startDateLimit);
    periodText = periodLabel(range, isArabic);
  } else {
    const start = new Date(range.startDate);
    const end = new Date(range.endDate);
    filteredTxs = txs.filter(t => {
      const d = new Date(t.transaction_date);
      return d >= start && d <= end;
    });
    periodText = isArabic
      ? `الفترة من ${range.startDate} إلى ${range.endDate}`
      : `Period from ${range.startDate} to ${range.endDate}`;
  }

  let totalSpent = 0;
  let totalIncome = 0;
  const categoryGroups: Record<string, number> = {};

  filteredTxs.forEach(t => {
    if (t.type === "credit") {
      totalIncome += t.amount;
    } else {
      totalSpent += t.amount;
      categoryGroups[t.category] = (categoryGroups[t.category] || 0) + t.amount;
    }
  });

  const topCategories = Object.entries(categoryGroups)
    .map(([category, amount]) => ({
      category,
      amount,
      percentage: totalSpent > 0 ? Math.round((amount / totalSpent) * 100) : 0
    }))
    .sort((a, b) => b.amount - a.amount);

  const largestTxs = filteredTxs
    .filter(t => t.type === "debit")
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 3);

  const hungerstationTotal = filteredTxs
    .filter(t => {
      const m = t.merchant.toLowerCase();
      return m.includes("hungerstation") || m.includes("jahez");
    })
    .reduce((sum, t) => sum + t.amount, 0);

  const insights: string[] = [];
  if (isArabic) {
    insights.push(`يُشير التحليل المالي إلى أن إجمالي الدخل لهذه الفترة بلغ ${totalIncome.toLocaleString()} ريال سعودي، بينما بلغ إجمالي الصرف الاستهلاكي ${totalSpent.toLocaleString()} ريال سعودي.`);
    if (hungerstationTotal > 150) {
      insights.push(`يتضح من تحليل سلوكك الإنفاقي ارتفاع مصروفات تطبيقات توصيل الأغذية (هنجرستيشن وجاهز) بقيمة ${hungerstationTotal.toLocaleString()} ريال سعودي، مما يستدعي ترشيد هذا البند لتحسين الفائض المالي.`);
    }
    const shoppingCat = topCategories.find(c => c.category === "Shopping");
    if (shoppingCat && shoppingCat.amount > 500) {
      insights.push(`تُظهر المؤشرات أن فئة التسوق شكّلت جزءاً كبيراً من الإنفاق بواقع ${shoppingCat.percentage}%، وبناءً على البيانات المتاحة يُنصح بتأجيل المشتريات الكمالية.`);
    }
    if (insights.length < 3) {
      insights.push(`وفقاً لبياناتك، يُقدّر صافي الوفر المالي للفترة الحالية بقيمة ${(totalIncome - totalSpent).toLocaleString()} ريال سعودي، وهو ما يدعم خطتك الادخارية المستهدفة.`);
    }
  } else {
    insights.push(`Financial analysis indicates that total income for this period reached ${totalIncome.toLocaleString()} SAR, whereas aggregate consumption stood at ${totalSpent.toLocaleString()} SAR.`);
    if (hungerstationTotal > 150) {
      insights.push(`It is evident from auditing your spending behavior that food delivery app expenditures (Hungerstation & Jahez) totaled ${hungerstationTotal.toLocaleString()} SAR, necessitating category rationalization.`);
    }
    const shoppingCat = topCategories.find(c => c.category === "Shopping");
    if (shoppingCat && shoppingCat.amount > 500) {
      insights.push(`According to the available data, shopping constitutes a significant portion of your spending at ${shoppingCat.percentage}%, suggesting a deferral of non-essential purchases.`);
    }
    if (insights.length < 3) {
      insights.push(`Your net cash surplus for the current period is projected at ${(totalIncome - totalSpent).toLocaleString()} SAR, supporting your predefined savings target.`);
    }
  }

  insights.push(isArabic
    ? "يُرجى العلم بأن هذا التحليل يستند إلى البيانات المتاحة وهو لأغراض استشارية. للحصول على قرار تمويلي رسمي, يُرجى التواصل مع أحد مستشاري مصرف الإنماء."
    : "Please note that this analysis is based on available data and is for advisory purposes only. For an official financing decision, please contact an Alinma Bank advisor."
  );

  return {
    type: "report",
    period: periodText,
    total_spent: totalSpent,
    total_income: totalIncome,
    top_categories: topCategories,
    largest_transactions: largestTxs,
    insights
  };
}

// ----------------------------------------------------------------------------
// Habits (all narrative figures now computed from data — no 750 / 2,000 literals)
// ----------------------------------------------------------------------------

export interface HabitsResult {
  type: "text";
  content: string;
}

/** Deterministic 30-day spending-habits audit. Every number is computed from `txs`/`balance`. */
export function computeHabits(txs: Transaction[], language: "ar" | "en", balance?: number): HabitsResult {
  const isArabic = language === "ar";
  const today = new Date(deriveToday(txs));
  const last30 = new Date(today);
  last30.setDate(today.getDate() - 30);

  const last30Txs = txs.filter(t => new Date(t.transaction_date) >= last30);
  const foodDeliveryTotal = last30Txs
    .filter(t => t.category === "Food & Restaurants" && (t.merchant === "Hungerstation" || t.merchant === "Jahez"))
    .reduce((sum, t) => sum + t.amount, 0);

  const monthlyIncome = avgMonthlyIncome(txs) || 15000;
  const foodDeliveryPct = monthlyIncome > 0 ? Math.round((foodDeliveryTotal / monthlyIncome) * 100) : 0;
  const currentBalance = buildFinancialProfile(txs, balance).currentSavings;
  const typicalSaving = typicalMonthlySaving(txs);
  const monthlySurplus = monthlyIncome - avgMonthlyOutflow(txs) - detectFinancingPayments(txs);
  const weeklyCap = Math.max(0, Math.round((foodDeliveryTotal / 4) * 0.7 / 10) * 10);

  const fmt = (n: number) => Math.round(n).toLocaleString();

  let content = "";
  if (isArabic) {
    content = `بناءً على البيانات المتاحة، يُشير التحليل المالي لمصرف الإنماء إلى سلوكك الإنفاقي خلال الـ 30 يوماً الماضية وفقاً للتالي:

🚨 **الإنفاق الاستهلاكي المرتفع:**
يتضح من تحليل سلوكك الإنفاقي ارتفاع مصروفات تطبيقات توصيل الأغذية (هنجرستيشن وجاهز) بقيمة **${fmt(foodDeliveryTotal)} ريال سعودي**، وهو ما يُمثّل نسبة **${foodDeliveryPct}%** من متوسط دخلك الشهري.

📉 **تحليل الوعاء الادخاري:**
تُظهر المؤشرات أن متوسط تحويلك الادخاري الشهري المعتاد يبلغ **${fmt(typicalSaving)} ريال سعودي**، ويبلغ رصيد حسابك الجاري المتاح حالياً **${fmt(currentBalance)} ريال سعودي**. يُشير التحليل المالي إلى أن استمرار نمط الإنفاق الحالي قد يؤثر سلباً على استدامة خطتك الادخارية.

📈 **الفائض الشهري:**
وفقاً لبياناتك، يُقدّر الفائض المالي الشهري (الدخل ناقص المصروفات والالتزامات) بـ **${fmt(monthlySurplus)} ريال سعودي**.

💡 **التوصيات التنظيمية:**
لتحسين كفاءة إدارتك المالية، يُقترح وضع سقف إنفاق أقصى لتطبيقات التوصيل لا يتجاوز **${fmt(weeklyCap)} ريال سعودي أسبوعياً**، وتحويل الفائض الناتج مباشرة لتعزيز وعاء الادخار.

يُرجى العلم بأن هذا التحليل يستند إلى البيانات المتاحة وهو لأغراض استشارية. للحصول على قرار تمويلي رسمي، يُرجى التواصل مع أحد مستشاري مصرف الإنماء.`;
  } else {
    content = `Based on the available data, Alinma Bank's financial analysis of your spending habits over the past 30 days indicates the following:

🚨 **Elevated Discretionary Spend:**
It is evident from auditing your spending behavior that food delivery app expenditures (Hungerstation & Jahez) totaled **${fmt(foodDeliveryTotal)} SAR**, representing approximately **${foodDeliveryPct}%** of your average monthly income.

📉 **Savings Trajectory Analysis:**
Indicators show that your typical recurring monthly savings transfer averages **${fmt(typicalSaving)} SAR**, while your current available balance stands at **${fmt(currentBalance)} SAR**. According to your data, maintaining this spending rate may impair the sustainability of your savings plan.

📈 **Monthly Surplus:**
According to your data, your monthly surplus (income minus expenses and obligations) is estimated at **${fmt(monthlySurplus)} SAR**.

💡 **Corrective Recommendations:**
To optimize financial efficiency, it is recommended to enforce a spending cap on food delivery apps not exceeding **${fmt(weeklyCap)} SAR per week**, thereby redirecting the preserved funds to restore your savings pot.

Please note that this analysis is based on available data and is for advisory purposes only. For an official financing decision, please contact an Alinma Bank advisor.`;
  }

  return { type: "text", content };
}

export interface CommitmentItem {
  id: string;
  merchant: string;
  category: string;
  emoji: string;
  expectedAmount: number;
  paidAmount: number;
  remainingAmount: number;
  remainingPercentage: number;
  dueDate: number;
  status: "Completed" | "In Progress";
  date?: string;
  duration?: string | number;
  startMonth?: string;
}

export interface CommitmentsResult {
  type: "commitments";
  total_commitments: number;
  total_paid: number;
  paid_percentage: number;
  commitments_list: CommitmentItem[];
}

export function computeCommitments(
  txs: Transaction[],
  language: "ar" | "en",
  customCommitments: Omit<CommitmentItem, "paidAmount" | "remainingAmount" | "remainingPercentage" | "status">[] = [],
  deletedCommitments: string[] = []
): CommitmentsResult {
  const isArabic = language === "ar";
  
  // 1. Determine current month from latest transaction
  const latestDateStr = deriveToday(txs); // e.g. "2026-05-29"
  const currentMonthPrefix = latestDateStr.substring(0, 7); // e.g. "2026-05"
  const [currentYear, currentMonthVal] = currentMonthPrefix.split("-").map(Number);

  // 2. Dynamic commitments detection from transaction history
  const merchantGroups: Record<string, Transaction[]> = {};
  txs.forEach(t => {
    if (t.type === "debit") {
      const key = t.merchant.trim();
      if (!merchantGroups[key]) merchantGroups[key] = [];
      merchantGroups[key].push(t);
    }
  });

  const detectedDefaults: { merchant: string; category: string; emoji: string; expectedAmount: number; dueDate: number; duration: string; startMonth: string }[] = [];
  const ONE_OFF_MERCHANTS = new Set([
    "Jarir Bookstore", "Hungerstation", "Jahez", "Uber", "Careem", "Amazon", "Apple", "Google", 
    "Panda", "Othaim", "Lulu", "Subway", "Starbucks", "McDonalds", "KFC", "AlBaik", "Hyper Panda",
    "Carrefour", "Noon", "Shein", "Talabat", "Mrsool", "Sary", "Nana"
  ]);

  Object.entries(merchantGroups).forEach(([merchantName, group]) => {
    // Unique months this merchant was active
    const monthsActive = new Set(group.map(t => t.transaction_date.slice(0, 7)));
    const avgCountPerMonth = group.length / monthsActive.size;
    
    // We consider it a recurring commitment if:
    // - Active in 3+ months
    // - Paid roughly once/twice a month (avg frequency <= 1.8)
    // - Not a retail shop or food delivery
    if (monthsActive.size >= 3 && avgCountPerMonth <= 1.8 && !ONE_OFF_MERCHANTS.has(merchantName)) {
      // Calculate average amount
      const sum = group.reduce((acc, t) => acc + t.amount, 0);
      const avgAmount = Math.round(sum / group.length);
      
      // Category and due date day from the latest transaction
      const sortedGroup = [...group].sort((a, b) => b.transaction_date.localeCompare(a.transaction_date));
      const latestTx = sortedGroup[0];
      const category = latestTx.category;
      const avgDay = parseInt(latestTx.transaction_date.slice(8, 10), 10);
      
      // Select Emoji based on merchant name or category
      let emoji = "📋";
      const mLower = merchantName.toLowerCase();
      if (mLower.includes("emaar") || mLower.includes("real estate") || mLower.includes("rent") || mLower.includes("عقار")) emoji = "🏠";
      else if (mLower.includes("mobily") || mLower.includes("stc") || mLower.includes("internet") || mLower.includes("زين") || mLower.includes("موبايلي")) emoji = "📶";
      else if (mLower.includes("tawuniya") || mLower.includes("insurance") || mLower.includes("تأمين")) emoji = "🛡️";
      else if (mLower.includes("netflix") || mLower.includes("popcorn") || mLower.includes("cinema") || mLower.includes("نتفلكس")) emoji = "🍿";
      else if (mLower.includes("auto") || mLower.includes("car") || mLower.includes("سيارة") || mLower.includes("installment")) emoji = "🚗";
      else if (mLower.includes("electricity") || mLower.includes("water") || mLower.includes("كهرباء") || mLower.includes("فاتورة")) emoji = "⚡";
      else if (category === "Entertainment") emoji = "🎬";
      else if (category === "Financing") emoji = "🏦";
      else if (category === "Bills & Utilities") emoji = "🔌";
      
      detectedDefaults.push({
        merchant: merchantName,
        category,
        emoji,
        expectedAmount: avgAmount,
        dueDate: avgDay,
        duration: "ongoing",
        startMonth: sortedGroup[sortedGroup.length - 1].transaction_date.slice(0, 7) // earliest month
      });
    }
  });

  // Clean defaults definition from detected recurring groups
  const defaults = detectedDefaults;

  // Filter out any default commitments that are deleted
  const activeDefaults = defaults.filter(d => 
    !deletedCommitments.some(del => del.toLowerCase() === d.merchant.toLowerCase())
  );

  // Merge custom commitments with active check
  const merged = [...activeDefaults];
  if (Array.isArray(customCommitments)) {
    customCommitments.forEach(c => {
      if (c && c.merchant) {
        // Parse startMonth and duration
        const startMonthStr = c.startMonth || currentMonthPrefix;
        const [startY, startM] = startMonthStr.split("-").map(Number);
        const durationVal = c.duration === undefined ? "ongoing" : c.duration;
        
        // Calculate months passed
        const monthsPassed = (currentYear - startY) * 12 + (currentMonthVal - startM);
        
        let isActive = false;
        if (durationVal === "ongoing") {
          isActive = monthsPassed >= 0;
        } else {
          const durationNum = Number(durationVal);
          isActive = monthsPassed >= 0 && monthsPassed < durationNum;
        }
        
        if (isActive) {
          const defaultIdx = merged.findIndex(m => m.merchant.toLowerCase() === c.merchant.toLowerCase());
          const newObj = {
            merchant: c.merchant,
            category: c.category || "Bills & Utilities",
            emoji: c.emoji || "📋",
            expectedAmount: c.expectedAmount || 0,
            dueDate: c.dueDate || 15,
            duration: String(durationVal),
            startMonth: startMonthStr
          };
          if (defaultIdx !== -1) {
            merged[defaultIdx] = newObj;
          } else {
            merged.push(newObj);
          }
        }
      }
    });
  }

  // 3. Check current month transactions to see how much is paid
  const currentMonthTxs = txs.filter(t => t.transaction_date.startsWith(currentMonthPrefix) && t.type === "debit");

  const commitments_list: CommitmentItem[] = merged.map((item, idx) => {
    // Find all transactions for this merchant in the current month
    const matchedTxs = currentMonthTxs.filter(t => t.merchant.toLowerCase().includes(item.merchant.toLowerCase()));
    const paidAmount = matchedTxs.reduce((sum, t) => sum + t.amount, 0);
    const remainingAmount = Math.max(0, item.expectedAmount - paidAmount);
    const remainingPercentage = item.expectedAmount > 0 ? Math.round((remainingAmount / item.expectedAmount) * 100) : 0;
    
    return {
      id: `commitment-${idx + 1}`,
      merchant: item.merchant,
      category: item.category,
      emoji: item.emoji,
      expectedAmount: item.expectedAmount,
      paidAmount: round2(paidAmount),
      remainingAmount: round2(remainingAmount),
      remainingPercentage,
      dueDate: item.dueDate,
      status: remainingAmount === 0 ? "Completed" : "In Progress",
      date: matchedTxs[0] ? matchedTxs[0].transaction_date : undefined,
      duration: item.duration,
      startMonth: item.startMonth
    };
  });

  // Calculate totals
  const total_commitments = commitments_list.reduce((sum, item) => sum + item.expectedAmount, 0);
  const total_paid = commitments_list.reduce((sum, item) => sum + item.paidAmount, 0);
  const paid_percentage = total_commitments > 0 ? Math.round((total_paid / total_commitments) * 100) : 0;

  return {
    type: "commitments",
    total_commitments: round2(total_commitments),
    total_paid: round2(total_paid),
    paid_percentage,
    commitments_list
  };
}

// ----------------------------------------------------------------------------
// Financial Summary — injected into the AI system prompt so it can answer
// ANY question about the user's finances. All numbers computed by CODE.
// ----------------------------------------------------------------------------

export interface FinancialSummary {
  text: string;          // Human-readable summary for the system prompt
  balance: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  monthlySurplus: number;
  lastTransfer: { date: string; merchant: string; amount: number } | null;
  lastTransactions: { date: string; merchant: string; amount: number; type: string; category: string }[];
  topMerchants: { merchant: string; total: number; count: number }[];
  categoryBreakdown: { category: string; amount: number; pct: number }[];
}

/**
 * Builds a comprehensive financial context string that gets injected into the
 * AI system prompt. This allows the AI to answer ANY question about the user's
 * financial life — "what's my balance?", "last transfer?", "how much did I spend
 * on coffee?", etc.
 *
 * IMPORTANT: Every single number here is computed by this code function.
 * The AI receives the finished numbers and phrases them — it never computes.
 */
export function buildFinancialSummary(
  txs: Transaction[],
  balance: number,
  language: "ar" | "en",
  customCommitments: any[] = [],
  deletedCommitments: string[] = []
): FinancialSummary {
  const isArabic = language === "ar";
  const today = deriveToday(txs);
  const currentMonth = today.slice(0, 7);
  const fmt = (n: number) => Math.round(n).toLocaleString();

  // --- Core averages ---
  const monthlyIncome = avgMonthlyIncome(txs) || 0;
  const monthlyExpenses = avgMonthlyOutflow(txs) + detectFinancingPayments(txs);
  const monthlySurplus = monthlyIncome - monthlyExpenses;
  const savingsTransfer = typicalMonthlySaving(txs);

  // --- Current month transactions ---
  const currentMonthTxs = txs.filter(t => t.transaction_date.startsWith(currentMonth));
  const currentMonthDebits = currentMonthTxs.filter(t => t.type === "debit");
  const currentMonthCredits = currentMonthTxs.filter(t => t.type === "credit");
  const thisMonthSpent = currentMonthDebits.reduce((s, t) => s + t.amount, 0);
  const thisMonthIncome = currentMonthCredits.reduce((s, t) => s + t.amount, 0);

  // --- Last 10 transactions (sorted newest first) ---
  const sortedTxs = [...txs].sort((a, b) => b.transaction_date.localeCompare(a.transaction_date));
  const last10 = sortedTxs.slice(0, 10).map(t => ({
    date: t.transaction_date,
    merchant: t.merchant,
    amount: t.amount,
    type: t.type,
    category: t.category
  }));

  // --- Last transfer ---
  const lastTransfer = sortedTxs.find(t =>
    t.category === "Transfers" ||
    t.merchant.toLowerCase().includes("تحويل") ||
    t.merchant.toLowerCase().includes("transfer") ||
    t.description.toLowerCase().includes("تحويل") ||
    t.description.toLowerCase().includes("transfer")
  );
  const lastTransferInfo = lastTransfer ? {
    date: lastTransfer.transaction_date,
    merchant: lastTransfer.merchant,
    amount: lastTransfer.amount
  } : null;

  // --- Last salary / income ---
  const lastSalary = sortedTxs.find(t => t.type === "credit");

  // --- Category breakdown (current month) ---
  const catMap: Record<string, number> = {};
  currentMonthDebits.forEach(t => {
    catMap[t.category] = (catMap[t.category] || 0) + t.amount;
  });
  const categoryBreakdown = Object.entries(catMap)
    .map(([category, amount]) => ({
      category,
      amount: round2(amount),
      pct: thisMonthSpent > 0 ? Math.round((amount / thisMonthSpent) * 100) : 0
    }))
    .sort((a, b) => b.amount - a.amount);

  // --- Top merchants (current month) ---
  const merchantMap: Record<string, { total: number; count: number }> = {};
  currentMonthDebits.forEach(t => {
    if (!merchantMap[t.merchant]) merchantMap[t.merchant] = { total: 0, count: 0 };
    merchantMap[t.merchant].total += t.amount;
    merchantMap[t.merchant].count++;
  });
  const topMerchants = Object.entries(merchantMap)
    .map(([merchant, { total, count }]) => ({ merchant, total: round2(total), count }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);

  // --- Specific category queries (for quick answers) ---
  const coffeeSpend = currentMonthDebits
    .filter(t => t.merchant.toLowerCase().includes("starbucks") || t.merchant.toLowerCase().includes("arabica") || t.merchant.toLowerCase().includes("barns") || t.description.toLowerCase().includes("قهوة") || t.description.toLowerCase().includes("coffee"))
    .reduce((s, t) => s + t.amount, 0);
  const foodDeliverySpend = currentMonthDebits
    .filter(t => {
      const m = t.merchant.toLowerCase();
      return m.includes("hungerstation") || m.includes("jahez");
    })
    .reduce((s, t) => s + t.amount, 0);
  const grocerySpend = currentMonthDebits
    .filter(t => t.description.toLowerCase().includes("مقاضي") || t.description.toLowerCase().includes("groceries"))
    .reduce((s, t) => s + t.amount, 0);
  const fuelSpend = currentMonthDebits
    .filter(t => t.description.toLowerCase().includes("وقود") || t.description.toLowerCase().includes("fuel") || t.merchant.toLowerCase().includes("petrol"))
    .reduce((s, t) => s + t.amount, 0);

  // --- Dynamic commitments detection (including manual additions & excluding deleted ones) ---
  const commitmentsResult = computeCommitments(txs, language, customCommitments, deletedCommitments);
  const commitments = commitmentsResult.commitments_list;

  // --- Biggest single transaction this month ---
  const biggestThisMonth = currentMonthDebits.length > 0
    ? currentMonthDebits.reduce((max, t) => t.amount > max.amount ? t : max, currentMonthDebits[0])
    : null;

  // --- Build the text summary ---
  const lines: string[] = [];

  if (isArabic) {
    lines.push(`=== السياق المالي للعميل (محسوب بالنظام — الأرقام نهائية لا تعيد حسابها) ===`);
    lines.push(``);
    lines.push(`📅 تاريخ اليوم في النظام: ${today}`);
    lines.push(`💰 الرصيد الحالي: ${fmt(balance)} ريال سعودي`);
    lines.push(`📊 متوسط الدخل الشهري: ${fmt(monthlyIncome)} ريال (${lastSalary ? lastSalary.merchant : "غير محدد"}, يوم ${lastSalary ? lastSalary.transaction_date.slice(8, 10) : "27"} من كل شهر)`);
    lines.push(`📉 متوسط المصروفات الشهرية: ${fmt(monthlyExpenses)} ريال`);
    lines.push(`📈 الفائض الشهري التقديري: ${fmt(monthlySurplus)} ريال`);
    lines.push(`🏦 تحويل ادخاري معتاد: ${fmt(savingsTransfer)} ريال/شهر`);
    lines.push(``);
    lines.push(`--- إحصائيات الشهر الحالي (${currentMonth}) ---`);
    lines.push(`إجمالي الدخل هذا الشهر: ${fmt(thisMonthIncome)} ريال`);
    lines.push(`إجمالي المصروفات هذا الشهر: ${fmt(thisMonthSpent)} ريال`);
    lines.push(`عدد المعاملات هذا الشهر: ${currentMonthTxs.length} معاملة`);
    lines.push(``);

    if (biggestThisMonth) {
      lines.push(`🔴 أكبر مصروف هذا الشهر: ${biggestThisMonth.merchant} — ${fmt(biggestThisMonth.amount)} ريال (${biggestThisMonth.transaction_date})`);
    }

    lines.push(``);
    lines.push(`--- آخر 10 معاملات ---`);
    last10.forEach((t, i) => {
      const sign = t.type === "credit" ? "+" : "-";
      lines.push(`${i + 1}. ${t.date} | ${t.merchant} | ${sign}${fmt(t.amount)} ريال | ${t.category}`);
    });

    lines.push(``);
    if (lastTransferInfo) {
      lines.push(`💸 آخر تحويل/حوالة: ${lastTransferInfo.date} | ${lastTransferInfo.merchant} | ${fmt(lastTransferInfo.amount)} ريال`);
    } else {
      lines.push(`💸 لا يوجد تحويلات مسجلة.`);
    }

    lines.push(``);
    lines.push(`--- توزيع الصرف حسب الفئة (هذا الشهر) ---`);
    categoryBreakdown.forEach(c => {
      lines.push(`• ${c.category}: ${fmt(c.amount)} ريال (${c.pct}%)`);
    });

    lines.push(``);
    lines.push(`--- أعلى التجار صرفاً (هذا الشهر) ---`);
    topMerchants.forEach((m, i) => {
      lines.push(`${i + 1}. ${m.merchant}: ${fmt(m.total)} ريال (${m.count} معاملة)`);
    });

    lines.push(``);
    lines.push(`--- مصروفات محددة (هذا الشهر) ---`);
    lines.push(`☕ القهوة: ${fmt(coffeeSpend)} ريال`);
    lines.push(`🍔 توصيل الطعام (هنقرستيشن + جاهز): ${fmt(foodDeliverySpend)} ريال`);
    lines.push(`🛒 البقالة/المقاضي: ${fmt(grocerySpend)} ريال`);
    lines.push(`⛽ الوقود: ${fmt(fuelSpend)} ريال`);

    lines.push(``);
    lines.push(`--- الالتزامات الشهرية (المكتشفة والمضافة يدوياً) ---`);
    commitments.forEach((c: any) => {
      const status = c.status === "Completed" ? "✅ مسدد بالكامل" : `⏳ لم يُسدد بعد (المتبقي: ${fmt(c.remainingAmount)} ريال)`;
      lines.push(`• ${c.merchant} (${c.category}): ${fmt(c.expectedAmount)} ريال (يوم استحقاقه: ${c.dueDate} من كل شهر) — ${status}`);
    });

    lines.push(``);
    lines.push(`=== نهاية السياق المالي ===`);
  } else {
    lines.push(`=== CLIENT FINANCIAL CONTEXT (computed by system — numbers are final, do not recalculate) ===`);
    lines.push(``);
    lines.push(`📅 System Date: ${today}`);
    lines.push(`💰 Current Balance: ${fmt(balance)} SAR`);
    lines.push(`📊 Avg Monthly Income: ${fmt(monthlyIncome)} SAR (${lastSalary ? lastSalary.merchant : "N/A"}, day ${lastSalary ? lastSalary.transaction_date.slice(8, 10) : "27"})`);
    lines.push(`📉 Avg Monthly Expenses: ${fmt(monthlyExpenses)} SAR`);
    lines.push(`📈 Estimated Monthly Surplus: ${fmt(monthlySurplus)} SAR`);
    lines.push(`🏦 Typical Monthly Savings Transfer: ${fmt(savingsTransfer)} SAR/month`);
    lines.push(``);
    lines.push(`--- Current Month Stats (${currentMonth}) ---`);
    lines.push(`Total Income This Month: ${fmt(thisMonthIncome)} SAR`);
    lines.push(`Total Expenses This Month: ${fmt(thisMonthSpent)} SAR`);
    lines.push(`Transaction Count This Month: ${currentMonthTxs.length}`);
    lines.push(``);

    if (biggestThisMonth) {
      lines.push(`🔴 Biggest Expense This Month: ${biggestThisMonth.merchant} — ${fmt(biggestThisMonth.amount)} SAR (${biggestThisMonth.transaction_date})`);
    }

    lines.push(``);
    lines.push(`--- Last 10 Transactions ---`);
    last10.forEach((t, i) => {
      const sign = t.type === "credit" ? "+" : "-";
      lines.push(`${i + 1}. ${t.date} | ${t.merchant} | ${sign}${fmt(t.amount)} SAR | ${t.category}`);
    });

    lines.push(``);
    if (lastTransferInfo) {
      lines.push(`💸 Last Transfer: ${lastTransferInfo.date} | ${lastTransferInfo.merchant} | ${fmt(lastTransferInfo.amount)} SAR`);
    } else {
      lines.push(`💸 No transfers recorded.`);
    }

    lines.push(``);
    lines.push(`--- Spending by Category (This Month) ---`);
    categoryBreakdown.forEach(c => {
      lines.push(`• ${c.category}: ${fmt(c.amount)} SAR (${c.pct}%)`);
    });

    lines.push(``);
    lines.push(`--- Top Merchants (This Month) ---`);
    topMerchants.forEach((m, i) => {
      lines.push(`${i + 1}. ${m.merchant}: ${fmt(m.total)} SAR (${m.count} transactions)`);
    });

    lines.push(``);
    lines.push(`--- Specific Spending (This Month) ---`);
    lines.push(`☕ Coffee: ${fmt(coffeeSpend)} SAR`);
    lines.push(`🍔 Food Delivery (Hungerstation + Jahez): ${fmt(foodDeliverySpend)} SAR`);
    lines.push(`🛒 Groceries: ${fmt(grocerySpend)} SAR`);
    lines.push(`⛽ Fuel: ${fmt(fuelSpend)} SAR`);

    lines.push(``);
    lines.push(`--- Monthly Fixed Commitments (Detected & Manually Added) ---`);
    commitments.forEach((c: any) => {
      const status = c.status === "Completed" ? "✅ Paid in full" : `⏳ Outstanding (Remaining: ${fmt(c.remainingAmount)} SAR)`;
      lines.push(`• ${c.merchant} (${c.category}): ${fmt(c.expectedAmount)} SAR (due on day ${c.dueDate} of the month) — ${status}`);
    });

    lines.push(``);
    lines.push(`=== END FINANCIAL CONTEXT ===`);
  }

  return {
    text: lines.join("\n"),
    balance,
    monthlyIncome,
    monthlyExpenses,
    monthlySurplus,
    lastTransfer: lastTransferInfo,
    lastTransactions: last10,
    topMerchants,
    categoryBreakdown
  };
}
