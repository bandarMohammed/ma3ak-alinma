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

/** "Today" for all windows = the latest transaction date (survives data regeneration). */
export function deriveToday(txs: Transaction[]): string {
  if (!txs.length) return new Date().toISOString().split("T")[0];
  return txs.reduce((max, t) => (t.transaction_date > max ? t.transaction_date : max), txs[0].transaction_date);
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
  const monthlyFixedExpenses = avgMonthlyOutflow(txs) || 0;
  const existingFinancingPayments = detectFinancingPayments(txs);
  const currentSavings = typeof balance === "number" && isFinite(balance) && balance > 0
    ? round2(balance)
    : FALLBACK_BALANCE;

  return { monthlyIncome, monthlyFixedExpenses, currentSavings, existingFinancingPayments };
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
  return isArabic ? "الشهر الماضي" : "Last Month";
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
    .filter(t => t.merchant === "Hungerstation" || t.merchant === "Jahez")
    .reduce((sum, t) => sum + t.amount, 0);

  const insights: string[] = [];
  if (isArabic) {
    insights.push(`يُشير التحليل المالي إلى أن إجمالي الدخل لهذه الفترة بلغ ${totalIncome.toLocaleString()} ريال سعودي، بينما بلغ إجمالي الصرف الاستهلاكي ${totalSpent.toLocaleString()} ريال سعودي.`);
    if (hungerstationTotal > 150) {
      insights.push(`يتضح من تحليل سلوكك الإنفاقي ارتفاع مصروفات تطبيقات توصيل الأغذية (هنجرستيشن وجاهز) بقيمة ${hungerstationTotal.toLocaleString()} ريال سعودي، مما يستدعي ترشيد هذا البند لتحسين الفائض المالي.`);
    }
    const shoppingCat = topCategories.find(c => c.category === "Shopping");
    if (shoppingCat && shoppingCat.amount > 500) {
      insights.push(`تُظهر المؤشرات أن فئة التسوق شكّلت النسبة الأعلى من الإنفاق بوقع ${shoppingCat.percentage}%، وبناءً على البيانات المتاحة يُنصح بتأجيل المشتريات الكمالية.`);
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
      insights.push(`According to the available data, shopping constitutes a primary spending category at ${shoppingCat.percentage}%, suggesting a deferral of non-essential purchases.`);
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
      
      // Calculate typical due date day
      const days = group.map(t => parseInt(t.transaction_date.slice(8, 10)));
      const avgDay = Math.round(days.reduce((acc, d) => acc + d, 0) / days.length);
      
      // Category from the latest transaction
      const sortedGroup = [...group].sort((a, b) => b.transaction_date.localeCompare(a.transaction_date));
      const latestTx = sortedGroup[0];
      const category = latestTx.category;
      
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

  // Fallback if no recurring transactions detected
  let defaults = detectedDefaults;
  if (defaults.length === 0) {
    defaults = [
      { merchant: "Emaar Real Estate", category: "Bills & Utilities", emoji: "🏠", expectedAmount: 2500, dueDate: 1, duration: "ongoing", startMonth: "2025-01" },
      { merchant: "Mobily Home Internet", category: "Bills & Utilities", emoji: "📶", expectedAmount: 299, dueDate: 5, duration: "ongoing", startMonth: "2025-01" },
      { merchant: "Tawuniya Insurance", category: "Bills & Utilities", emoji: "🛡️", expectedAmount: 350, dueDate: 10, duration: "ongoing", startMonth: "2025-01" },
      { merchant: "Netflix", category: "Entertainment", emoji: "🎬", expectedAmount: 56, duration: "ongoing", startMonth: "2025-01", dueDate: 15 },
      { merchant: "Alinma Auto Finance", category: "Bills & Utilities", emoji: "🚗", expectedAmount: 1200, dueDate: 27, duration: "ongoing", startMonth: "2025-01" },
      { merchant: "stc pay", category: "Bills & Utilities", emoji: "📱", expectedAmount: 287.5, dueDate: 28, duration: "ongoing", startMonth: "2025-01" }
    ];
  }

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
            duration: durationVal,
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
