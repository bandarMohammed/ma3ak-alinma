import { NextResponse } from "next/server";
import OpenAI from "openai";
import { Transaction } from "../../../lib/data/types";
import { USE_MOCK_AI } from "../../../lib/data/config";
import { SimulatorManager } from "../../../lib/simulator/manager";
import { ExtractedIntent } from "../../../lib/simulator/types";
import {
  computeReport,
  computeHabits,
  computeCommitments,
  buildFinancialSummary,
  deriveToday,
  calendarMonthRange,
  ReportRange
} from "../../../lib/finance/calculations";

// Force Node.js runtime
export const runtime = "nodejs";

function cleanAndParseJSON(text: string): any {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
  }
  return JSON.parse(cleaned);
}

// ============================================================================
// ORCHESTRATION — the LLM understands intent; the ENGINES do the math.
//
//   user message → intent classifier (LLM; keyword fallback offline)
//     ├─ report            → Report Engine        (computeReport)
//     ├─ habits            → Analytics Engine     (computeHabits)
//     ├─ commitments_view  → Commitments Engine   (computeCommitments)
//     ├─ simulation        → Simulation Agent     (slot-filling → SimulatorManager)
//     └─ general / manage  → Context Agent        (phrases engine-computed numbers)
//
// The LLM never computes a financial figure — it only routes and phrases.
// ============================================================================

type RouterPeriod =
  | { kind: "days"; days: number }
  | { kind: "month"; offset: number }
  | { kind: "range"; startDate: string; endDate: string };

interface RouterIntent {
  intent: "report" | "habits" | "commitments_view" | "commitments_manage" | "simulation" | "general";
  period?: RouterPeriod;
}

// ---- deterministic date extraction (regex beats an LLM at parsing dates) ----
// Accepts YYYY-MM-DD / YYYY/M/D / DD-MM-YYYY / D/M/YYYY, padded or not,
// normalized to ISO YYYY-MM-DD, in order of appearance.
function extractDates(text: string): string[] {
  const found: string[] = [];
  const ymd = /(\d{4})[-/](\d{1,2})[-/](\d{1,2})/g;
  let m: RegExpExecArray | null;
  while ((m = ymd.exec(text))) {
    found.push(`${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`);
  }
  if (found.length < 2) {
    const dmy = /(\d{1,2})[-/](\d{1,2})[-/](\d{4})/g;
    while ((m = dmy.exec(text))) {
      found.push(`${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`);
    }
  }
  return found;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Calendar-month ReportRange with a human label ("شهر أبريل 2026" / "April 2026"). */
function monthRange(transactions: Transaction[], offset: number, isArabic: boolean): ReportRange {
  const r = calendarMonthRange(transactions, offset);
  const monthNamesAr = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
  const monthNamesEn = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const [ry, rm] = r.month.split("-").map(Number);
  const monthName = isArabic ? monthNamesAr[rm - 1] : monthNamesEn[rm - 1];
  const toDate = offset === 0 ? (isArabic ? " (حتى تاريخه)" : " (to date)") : "";
  const label = isArabic ? `شهر ${monthName} ${ry}${toDate}` : `${monthName} ${ry}${toDate}`;
  return { startDate: r.startDate, endDate: r.endDate, label };
}

/**
 * Resolves the report window. Priority:
 *  1. explicit dates in the message (deterministic regex — always wins);
 *  2. the classifier's structured period;
 *  3. keyword regexes (offline fallback);
 *  4. default: last 30 days.
 */
function resolveReportRange(
  transactions: Transaction[],
  message: string,
  queryLower: string,
  isArabic: boolean,
  period?: RouterPeriod
): ReportRange {
  const dates = extractDates(message);
  if (dates.length >= 2) return { startDate: dates[0], endDate: dates[1] };
  if (dates.length === 1) return { startDate: dates[0], endDate: dates[0] };

  if (period) {
    if (period.kind === "range" && ISO_DATE.test(period.startDate) && ISO_DATE.test(period.endDate)) {
      return { startDate: period.startDate, endDate: period.endDate };
    }
    if (period.kind === "month" && Number.isFinite(period.offset)) {
      return monthRange(transactions, Math.max(-24, Math.min(0, Math.round(period.offset))), isArabic);
    }
    if (period.kind === "days" && Number.isFinite(period.days) && period.days > 0) {
      return Math.min(730, Math.round(period.days));
    }
  }

  // Keyword fallback (mock mode / classifier failure). Calendar months first.
  const wantsThisMonth = /هذا الشهر|الشهر الحالي|this month|current month/.test(queryLower);
  const wantsLastMonth = /الشهر الماضي|الشهر السابق|last month/.test(queryLower);
  const wantsMonthly = /تقرير شهري|تقرير الشهر|monthly report|month report/.test(queryLower);
  if (wantsThisMonth || wantsLastMonth || wantsMonthly) {
    return monthRange(transactions, wantsThisMonth ? 0 : -1, isArabic);
  }
  // Bare numbers must match as whole words so "2017" can't trigger the 7-day report.
  if (/\byear\b|سنة|سنه|(^|\s)عام(\s|$)|\b365\b/.test(queryLower)) return 365;
  if (/\b6\s*months?\b|٦ أشهر|٦ اشهر|سته اشهر|ستة أشهر|\b180\b/.test(queryLower)) return 180;
  if (/\b3\s*months?\b|٣ أشهر|٣ اشهر|ثلاث اشهر|ثلاثة أشهر|\b90\b/.test(queryLower)) return 90;
  if (/\bweek\b|أسبوع|اسبوع|\b7\b/.test(queryLower)) return 7;
  if (/\b15\b|١٥/.test(queryLower)) return 15;
  return 30;
}

// ----------------------------------------------------------------------------
// Financial-history boundaries (Step 3). A real banking app never serves a report
// for a period it has no data for. We DERIVE the dataset's window (earliest tx →
// latest tx, both from the data — never hardcoded) and either clamp a partially
// overlapping request or, if it falls entirely outside, return a friendly message
// instead of an empty/zero/fake report. computeReport itself is untouched.
// ----------------------------------------------------------------------------

/** Earliest and latest dates actually present in the dataset (derived, not hardcoded). */
function historyBounds(transactions: Transaction[]): { earliest: string; latest: string } {
  const latest = deriveToday(transactions); // robust latest (ignores future-clock outliers)
  let earliest = latest;
  for (const t of transactions) {
    const d = t.transaction_date.slice(0, 10);
    if (d < earliest) earliest = d;
  }
  return { earliest, latest };
}

/** DD-MM-YYYY display form of an ISO date, for user-facing boundary messages. */
function displayDate(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : iso;
}

type ReportGuard =
  | { ok: true; range: ReportRange }
  | { ok: false; message: string };

/**
 * Enforces the dataset's history window on a resolved report range.
 *  - "last N days" (number) ranges are always anchored to the latest data and can
 *    never fall outside history, so they pass through untouched.
 *  - an explicit [start,end] window entirely outside the data → friendly message.
 *  - a partially overlapping window → clamped to [earliest, latest].
 */
function guardReportRange(transactions: Transaction[], range: ReportRange, isArabic: boolean): ReportGuard {
  if (typeof range === "number") return { ok: true, range };
  if (!transactions.length) return { ok: true, range };

  const { earliest, latest } = historyBounds(transactions);
  let start = range.startDate.slice(0, 10);
  let end = range.endDate.slice(0, 10);
  if (start > end) [start, end] = [end, start]; // tolerate inverted input

  // Entirely outside the available history → do NOT fabricate an empty report.
  if (end < earliest || start > latest) {
    return {
      ok: false,
      message: isArabic
        ? `عذراً، الفترة المطلوبة تقع خارج نطاق سجلك المالي المتاح. تتوفر بياناتك المالية فقط بين ${displayDate(earliest)} و ${displayDate(latest)}.`
        : `Sorry, the requested period is outside your available financial history. Your financial data is only available between ${displayDate(earliest)} and ${displayDate(latest)}.`
    };
  }

  // Partial overlap → clamp to the window. Keep the friendly label only when nothing
  // was clamped; otherwise let computeReport format an accurate label for the real window.
  const clampedStart = start < earliest ? earliest : start;
  const clampedEnd = end > latest ? latest : end;
  const wasClamped = clampedStart !== start || clampedEnd !== end;
  return {
    ok: true,
    range: wasClamped
      ? { startDate: clampedStart, endDate: clampedEnd }
      : { startDate: clampedStart, endDate: clampedEnd, label: range.label }
  };
}

// ----------------------------------------------------------------------------
// OFFLINE fallback intent detection (keywords). Used ONLY when there is no API
// key (mock mode) or the LLM classifier call fails — never as the primary path.
// ----------------------------------------------------------------------------
function detectIntentByKeywords(queryLower: string, inSimulation: boolean): RouterIntent {
  const isCommitmentsQuery =
    queryLower.includes("commitment") ||
    queryLower.includes("التزام") ||
    queryLower.includes("التزامات") ||
    queryLower.includes("التزاماتي");

  if (isCommitmentsQuery) {
    const isManage = ["أضف", "اضف", "اضافه", "إضافة", "احذف", "حذف", "شيل", "ازالة", "إزالة",
      "هل عندي", "هل لدي", "عندي التزام ", "لدي التزام ", "اضهرلي", "أظهر لي", "اظهر لي",
      "أبي أشوف", "ابي اشوف", "اعرض التزام"].some(k => queryLower.includes(k));
    return { intent: isManage ? "commitments_manage" : "commitments_view" };
  }

  const hasReportKeyword = queryLower.includes("report") || queryLower.includes("تقرير");

  const isFeedbackOrQuestion = ["خطأ", "خطا", "مشكلة", "مشكله", "عيوب", "عيب", "لاحظت", "لاحظه",
    "مو دقيق", "غير دقيق", "ما يحسب", "ليش", "لماذا", "كيف", "why", "error", "bug", "wrong", "not accurate"]
    .some(k => queryLower.includes(k));

  const isHabitsQuery = !hasReportKeyword && ["habits", "عادات", "أحوالي", "أموالي", "كيف أحوالي", "أموري"]
    .some(k => queryLower.includes(k));
  if (isHabitsQuery && !isFeedbackOrQuestion) return { intent: "habits" };

  const isReportQuery = !isFeedbackOrQuestion && (
    hasReportKeyword ||
    ["history", "week", "أسبوع", "اسبوع", "الشهر الماضي", "last month", "تاريخ معاملاتي", "سجل معاملاتي"]
      .some(k => queryLower.includes(k))
  );
  if (isReportQuery) return { intent: "report" };

  const simulationKeywords = [
    "سيارة", "سياره", "شراء", "ايفون", "أيفون", "iphone", "قرض", "loan", "أقساط", "installment",
    "أفكر", "ودي", "ناوي", "هل أقدر", "تتوقع أقدر", "ودي أشتري", "ودي أسافر", "ودي أتزوج",
    "بشتري", "بسافر", "بآخذ قرض", "بقسط", "بمول", "أقدر أتحمل", "وش يصير لو", "لو اشتريت", "لو سافرت", "لو دفعت",
    "لو أخذت قرض", "لو مولت", "سفر", "سياحة", "رحلة", "زواج", "عرس", "ترميم", "تجديد", "دراسة", "جامعة", "مشروع",
    "علاج", "لابتوب", "كمبيوتر", "عقار", "منزل", "travel", "vacation", "wedding", "marry", "renovate",
    "education", "tuition", "afford", "thinking of", "planning to", "considering", "what if i", "borrow",
    "financing", "installments", "monthly payment", "lease", "leasing", "mortgage"
  ];
  if (inSimulation || simulationKeywords.some(k => queryLower.includes(k))) {
    return { intent: "simulation" };
  }

  return { intent: "general" };
}

// ----------------------------------------------------------------------------
// PRIMARY intent classification — a fast LLM call that UNDERSTANDS the message
// instead of pattern-matching it. Returns a validated RouterIntent or throws.
// ----------------------------------------------------------------------------
async function classifyIntent(
  openai: OpenAI,
  recentMessages: { role: string; content: string }[],
  inSimulation: boolean,
  todayISO: string
): Promise<RouterIntent> {
  const classifierPrompt = `You are the intent ROUTER of a banking assistant. Today's date is ${todayISO}. Read the conversation and classify the user's LAST message into exactly one intent:

- "report": the user asks for a spending/income report, financial summary, or transaction history for a time period.
- "habits": the user asks for an OVERALL analysis of their spending habits / financial behaviour / "how am I doing financially". NOT for questions about one specific category or merchant (e.g. "how much did I spend on coffee?" is "general").
- "commitments_view": the user wants to SEE their monthly commitments list (all of them).
- "commitments_manage": the user wants to add, delete, edit, or ask about ONE specific commitment.
- "simulation": the user wants to evaluate a FUTURE financial decision (buying something, travel, wedding, loan, financing, "can I afford X"), OR is currently answering the assistant's simulation questions (inSimulation=${inSimulation}) with prices/installments/tenure/"cash".
- "general": everything else — balance, last transfer, specific spending questions, advice, greetings, complaints, feedback, questions about how something was calculated.

IMPORTANT DISAMBIGUATION:
- Phrases like "أبي أعرف" / "ودي أشوف" (I want to know/see) are NOT simulation — the user wants information, not a purchase decision.
- If inSimulation=true but the user changes the subject (asks about balance, reports, commitments…), classify by the NEW subject — do not stay in simulation.
- Asking "what are my commitments next month?" is "commitments_view".

If intent="report", also extract the period:
  {"kind":"days","days":<7|15|30|90|180|365>} for trailing windows ("last week" → 7),
  {"kind":"month","offset":N} for calendar months, where N = months back from TODAY's month
    (0 = current month, -1 = previous month; e.g. if today is 2026-07-15 and the user says "April", offset = -3),
  {"kind":"range","startDate":"YYYY-MM-DD","endDate":"YYYY-MM-DD"} for explicit dates.

Return ONLY JSON: {"intent":"...","period":{...} or null}`;

  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    max_tokens: 120,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: classifierPrompt },
      ...recentMessages.slice(-6).map(m => ({
        role: m.role as "user" | "assistant",
        content: String(m.content || "").slice(0, 500)
      }))
    ]
  });

  const parsed = cleanAndParseJSON(res.choices[0]?.message?.content || "{}");
  const valid = ["report", "habits", "commitments_view", "commitments_manage", "simulation", "general"];
  if (!parsed || !valid.includes(parsed.intent)) {
    throw new Error(`Classifier returned invalid intent: ${JSON.stringify(parsed)}`);
  }
  const period = parsed.period && typeof parsed.period === "object" && parsed.period.kind
    ? (parsed.period as RouterPeriod)
    : undefined;
  return { intent: parsed.intent, period };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      messages,
      transactions,
      language,
      balance,
      customCommitments,
      deletedCommitments
    } = body as {
      messages: any[];
      transactions: Transaction[];
      language: "ar" | "en";
      balance?: number;
      customCommitments?: any[];
      deletedCommitments?: string[];
    };

    const isArabic = language === "ar";
    const lastUserMessage = messages[messages.length - 1]?.content || "";
    const queryLower = lastUserMessage.toLowerCase();

    const apiKey = process.env.OPENAI_API_KEY;
    const hasRealKey = !!apiKey && !apiKey.includes("dummy");
    const isMockMode = !hasRealKey || USE_MOCK_AI;

    // Simulation slot-filling state: scoped to the LAST assistant turn only.
    // (Scanning ALL messages made one false positive lock the conversation in
    // simulation mode forever — the dead-end users hit.)
    const lastAssistantMsg = [...messages].reverse().find((m: any) => m.role === "assistant");
    const inSimulation = !!lastAssistantMsg?.metadata?.pendingSim;

    // ==========================================================================
    // STEP 1 — Intent: LLM classifier in real mode; keywords only offline.
    // ==========================================================================
    let intent: RouterIntent;
    if (isMockMode) {
      intent = detectIntentByKeywords(queryLower, inSimulation);
    } else {
      const openaiClassifier = new OpenAI({ apiKey });
      try {
        intent = await classifyIntent(openaiClassifier, messages, inSimulation, deriveToday(transactions));
      } catch (e) {
        console.error("Intent classifier failed, falling back to keywords:", e);
        intent = detectIntentByKeywords(queryLower, inSimulation);
      }
    }

    // ==========================================================================
    // STEP 2 — Deterministic engines answer directly (no generative step).
    // ==========================================================================
    if (intent.intent === "report") {
      const range = resolveReportRange(transactions, lastUserMessage, queryLower, isArabic, intent.period);
      // Enforce dataset history boundaries: clamp partial overlaps, and refuse
      // out-of-history windows with a friendly message instead of an empty report.
      const guard = guardReportRange(transactions, range, isArabic);
      if (!guard.ok) return NextResponse.json({ type: "text", content: guard.message });
      return NextResponse.json(computeReport(transactions, guard.range, language));
    }

    if (intent.intent === "habits") {
      return NextResponse.json(computeHabits(transactions, language, balance));
    }

    if (intent.intent === "commitments_view") {
      return NextResponse.json(
        computeCommitments(transactions, language, customCommitments, deletedCommitments)
      );
    }

    // ==========================================================================
    // STEP 3 — Generative turns (simulation slot-filling / contextual answers).
    // All numbers in the context are engine-computed; the LLM only phrases them.
    // ==========================================================================
    const financialContext = buildFinancialSummary(
      transactions,
      balance || 0,
      language,
      customCommitments,
      deletedCommitments
    );

    const fmt = (n: number) => Math.round(n).toLocaleString();
    const disclaimer = isArabic
      ? "\n\nيُرجى العلم بأن هذا التحليل يستند إلى البيانات المتاحة وهو لأغراض استشارية. للحصول على قرار تمويلي رسمي، يُرجى التواصل مع أحد مستشاري مصرف الإنماء."
      : "\n\nPlease note that this analysis is based on available data and is for advisory purposes only. For an official financing decision, please contact an Alinma Bank advisor.";

    const today = deriveToday(transactions);
    const currentMonth = today.slice(0, 7);
    const monthTxs = transactions.filter(t => t.transaction_date.startsWith(currentMonth));
    const monthDebits = monthTxs.filter(t => t.type === "debit");
    const totalSpent = monthDebits.reduce((s, t) => s + t.amount, 0);

    const welcome = isArabic
      ? `مرحباً! أنا **معك** 🏦 المستشار المالي الرقمي لمصرف الإنماء.\n\nأنا مطّلع على **كامل حسابك** وأقدر أجاوبك على أي سؤال:\n\n💰 \"**كم رصيدي؟**\" · \"**وش آخر حواله؟**\" · \"**كم صرفت على القهوة؟**\"\n📊 \"**تقرير الأسبوع**\" · \"**تقرير الشهر الماضي**\"\n📈 \"**كيف أحوالي المالية؟**\"\n🧮 \"**أبي أشتري سيارة بقسط 2000**\"\n📋 \"**التزاماتي هذا الشهر**\"\n\nرصيدك الحالي: **${fmt(financialContext.balance)} ريال** | معاملاتك هذا الشهر: **${monthTxs.length}**\n\nوش أقدر أساعدك فيه؟${disclaimer}`
      : `Hello! I'm **Ma3ak** 🏦 your Alinma Bank digital financial advisor.\n\nI have **full access to your account** and can answer any question:\n\n💰 \"**What's my balance?**\" · \"**Last transfer?**\" · \"**Coffee spending?**\"\n📊 \"**Weekly report**\" · \"**Monthly report**\"\n📈 \"**Analyze my spending habits**\"\n🧮 \"**Can I afford a car at 2000/month?**\"\n📋 \"**My commitments this month**\"\n\nCurrent balance: **${fmt(financialContext.balance)} SAR** | Transactions this month: **${monthTxs.length}**\n\nHow can I help you?${disclaimer}`;

    // -------------------------------------------------------------------------
    // MOCK AI MODE (Offline / Fallback)
    // -------------------------------------------------------------------------
    if (isMockMode) {
      if (USE_MOCK_AI) await new Promise(r => setTimeout(r, 600));

      // Balance
      if (queryLower.includes("رصيد") || queryLower.includes("كم عندي") || queryLower.includes("كم فلوسي") || queryLower.includes("balance") || queryLower.includes("how much do i have")) {
        const content = isArabic
          ? `💰 رصيدك الحالي في حسابك لدى مصرف الإنماء: **${fmt(financialContext.balance)} ريال سعودي**\n\n📊 متوسط دخلك الشهري: **${fmt(financialContext.monthlyIncome)} ريال**\n📉 متوسط مصروفاتك: **${fmt(financialContext.monthlyExpenses)} ريال**\n📈 الفائض الشهري: **${fmt(financialContext.monthlySurplus)} ريال**${disclaimer}`
          : `💰 Your current balance at Alinma Bank: **${fmt(financialContext.balance)} SAR**\n\n📊 Avg monthly income: **${fmt(financialContext.monthlyIncome)} SAR**\n📉 Avg monthly expenses: **${fmt(financialContext.monthlyExpenses)} SAR**\n📈 Monthly surplus: **${fmt(financialContext.monthlySurplus)} SAR**${disclaimer}`;
        return NextResponse.json({ type: "text", content });
      }

      // Greetings
      const greetingKeywords = ["مرحبا", "هلا", "السلام", "أهلا", "هاي", "hello", "hi", "hey"];
      if (greetingKeywords.some(k => queryLower.includes(k)) || queryLower.length < 10) {
        return NextResponse.json({ type: "text", content: welcome });
      }

      const fallback = isArabic
        ? `بناءً على بياناتك المالية:\n\n💰 **الرصيد:** ${fmt(financialContext.balance)} ريال\n📉 **صرفت هذا الشهر:** ${fmt(totalSpent)} ريال\n📊 **الفائض الشهري:** ${fmt(financialContext.monthlySurplus)} ريال\n\nاسألني عن:\n• \"كم صرفت على القهوة؟\" · \"وش آخر حواله؟\" · \"كم إيجاري؟\" · \"تقرير الأسبوع\"${disclaimer}`
        : `Based on your financial data:\n\n💰 **Balance:** ${fmt(financialContext.balance)} SAR\n📉 **Spent this month:** ${fmt(totalSpent)} SAR\n📊 **Monthly surplus:** ${fmt(financialContext.monthlySurplus)} SAR\n\nAsk me:\n• \"How much on coffee?\" · \"Last transfer?\" · \"How much is my rent?\" · \"Weekly report\"${disclaimer}`;
      return NextResponse.json({ type: "text", content: fallback });
    }

    // ==========================================================================
    // REAL AI MODE — the classified intent picks the agent; engines do the math.
    // ==========================================================================
    const openai = new OpenAI({ apiKey });
    const isSimulationTurn = intent.intent === "simulation";

    let systemPrompt = "";

    if (isSimulationTurn) {
      systemPrompt = `You are Ma3ak (معك), the personal financial advisor embedded inside Alinma Bank's official app.

CRITICAL IDENTITY & CONVERSATION GOAL:
- You are an EMBEDDED SYSTEM with DIRECT READ ACCESS to the client's bank account.
- The client wants to simulate a financial decision (e.g. buying a car, travel, loan, house, etc.).
- Your goal is to gather the necessary parameters to run a SAMA-compliant decision simulation.
- You MUST review the conversation history to see what parameters the client already stated, and ask for the missing ones.

REQUIRED PARAMETERS:
1. Total amount/price of the purchase or loan (المبلغ الإجمالي)
2. Payment type: Cash or Installments (كاش أم أقساط/تمويل)
3. If it is Installments/Financing (أقساط/تمويل):
   - Down payment (الدفعة الأولى) - ask: "كم ممكن الدفعه الاوله اذا مافي قول لا؟"
   - Monthly installment (القسط الشهري) - ask: "كم القسط الشهري؟"
   - Installment period in months (مدة القسط بالشهور) - ask: "كم مدت القسط بالشهور ؟"
   - Final payment (الدفعة الأخيرة) - ask: "هل في دفعه اخيره اذا لا اكتب لا ؟"

STRICT PROTOCOL RULES:
- If the client specifies "كاش" (Cash), do NOT ask for down payment, monthly installment, tenure, or final payment. Cash purchases only need the total price/amount!
- Ask questions naturally and intelligently in a warm, professional Gulf Arabic dialect (لهجة خليجية بيضاء ودية ومحترفة).
- You can ask for multiple missing parameters at once to make the conversation faster and smarter!
- Return valid JSON format:
  {"type": "text", "content": "Your conversational reply asking for missing details..."}
- Once you have gathered ALL required parameters, you must output a simulation trigger JSON object:
  {"type": "simulation_trigger", "params": {
    "price": <number, total price/amount>,
    "isCash": <boolean, true if cash, false if installments>,
    "downPayment": <number, 0 if none/cash>,
    "installment": <number, 0 if cash>,
    "tenure": <number, repayment months (if cash, set to 6 months)>,
    "finalPayment": <number, 0 if none/cash>,
    "category": <"loan" if the client is borrowing MONEY (personal loan / قرض / تمويل شخصي — cash they receive), otherwise the asset/goal: "car" | "phone" | "laptop" | "travel" | "wedding" | "renovation" | "tuition" | "medical" | "business" | "generic">
  }}
  Do not write any text, markdown formatting, or markdown code blocks when returning the simulation_trigger. Return ONLY the JSON object.

End every text reply with:
${isArabic
  ? "يُرجى العلم بأن هذا التحليل يستند إلى البيانات المتاحة وهو لأغراض استشارية. للحصول على قرار تمويلي رسمي، يُرجى التواصل مع أحد مستشاري مصرف الإنماء."
  : "Please note that this analysis is based on available data and is for advisory purposes only. For an official financing decision, please contact an Alinma Bank advisor."}
Return ONLY valid JSON: {"type":"text","content":"..."} or {"type":"simulation_trigger","params":{...}} with no markdown wrappers.`;
    } else {
      systemPrompt = `You are Ma3ak (معك), the personal financial assistant embedded inside Alinma Bank's app.

CRITICAL ROLE:
- You are an EMBEDDED BANKING ASSISTANT with DIRECT READ ACCESS to this client's account.
- You already retrieved and analyzed the client's full financial data (in the system data load message), including their monthly commitments.
- You MUST use those numbers to answer. NEVER say "I cannot access your account".
- Reply in ${isArabic ? "Arabic (formal Gulf Arabic)" : "English"}.
- Use markdown (**bold**, bullet points) for clarity.
- Be concise, warm, and professional.

CONVERSATIONAL COMMITMENTS COMMANDS (CRITICAL):
- If the user asks to ADD a commitment (e.g., "أضف التزام حليب أطفال بـ 200 ريال يوم 10"), you MUST return a JSON containing the structured commitment fields so the system can save it:
  {"type": "text", "content": "لقد قمت بإضافة التزامك المالي (حليب أطفال) بقيمة 200 ريال بنجاح! 💸", "addCommitment": {"merchant": "حليب أطفال", "expectedAmount": 200, "dueDate": 10, "category": "Bills & Utilities", "emoji": "🍼", "duration": "ongoing", "startMonth": "2026-05"}}
  Make sure you parse the merchant name, expectedAmount (number), dueDate (number, default 15 if not specified), category (default "Bills & Utilities"), and pick a matching emoji (e.g. 🍼, 🏠, 📶, 🚗).
- If the user asks to DELETE a commitment (e.g., "احذف التزام stc pay" or "شيل التزام المدارس"), you MUST return:
  {"type": "text", "content": "تم حذف التزام stc pay بنجاح من قائمتك. 🧹", "deleteCommitment": "stc pay"}
  Parse the exact merchant name to delete (e.g. "stc pay").
- If the user asks if they have a specific commitment (e.g., "هل عندي التزام stc؟" or "عندي التزام نتفلكس؟"), check if it exists in the active list, then answer with "نعم" or "لا" and detail it (e.g., "نعم، لديك التزام stc pay بقيمة 287 ريال مستحق يوم 28.").
- If the user asks to SHOW, VIEW, DISPLAY, or SEE a specific commitment (e.g., "اضهرلي التزام Noon.com" or "اعرض التزام stc pay" or "أبي أشوف التزام Netflix" or "اعرضه لي"), you MUST return a commitments JSON payload containing ONLY that matched commitment:
  {"type": "commitments", "total_commitments": [amount], "total_paid": [paid], "paid_percentage": [pct], "commitments_list": [{"merchant": "[merchant]", "category": "[category]", "emoji": "[emoji]", "expectedAmount": [expected], "dueDate": [due_date], "paidAmount": [paid], "remainingAmount": [remaining], "remainingPercentage": [rem_pct], "status": "[status]", "duration": "[duration]", "startMonth": "[start_month]"}]}
  Ensure you look up all details (merchant, expectedAmount, dueDate, category, emoji, paidAmount, status) from the commitments listed in the system financial context text and fill them in the list.

FORBIDDEN RESPONSES:
- "I cannot access your account"
- "I don't have access to your financial data"
- "Please check your banking app"

STRICT MATH RULE: All numbers in the system load message are FINAL. Use them as-is.

End every reply with:
${isArabic
  ? "يُرجى العلم بأن هذا التحليل يستند إلى البيانات المتاحة وهو لأغراض استشارية. للحصول على قرار تمويلي رسمي، يُرجى التواصل مع أحد مستشاري مصرف الإنماء."
  : "Please note that this analysis is based on available data and is for advisory purposes only. For an official financing decision, please contact an Alinma Bank advisor."}
Return ONLY valid JSON: {"type":"text","content":"..."} (plus addCommitment/deleteCommitment if requested) or {"type":"commitments",...} with no markdown wrappers.`;
    }

    // Inject financial context as prior assistant Turn
    const conversationHistory = [
      {
        role: "assistant" as const,
        content: `[DATABASE QUERY COMPLETE] I have successfully retrieved the client's full financial profile from Alinma Bank's core system:\n\n${financialContext.text}\n\n[READY] I now have all the data I need to answer the client's questions accurately.`
      },
      ...messages.map((m: any) => ({
        role: m.role as "user" | "assistant",
        content: m.content
      }))
    ];

    // Trailing schema reminder: with long mixed histories the model sometimes
    // returns an empty {} — re-anchoring the output contract right before
    // generation makes it answer the LAST message reliably.
    const outputReminder = isSimulationTurn
      ? `Answer the user's LAST message now. Output exactly one JSON object: {"type":"text","content":"..."} or {"type":"simulation_trigger","params":{...}}. Never output an empty object.`
      : `Answer the user's LAST message now using the numbers from the financial context. Output exactly one JSON object: {"type":"text","content":"..."} (with addCommitment/deleteCommitment only if requested) or {"type":"commitments",...}. Never output an empty object.`;

    const chatResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        ...conversationHistory,
        { role: "system", content: outputReminder }
      ]
    });

    const rawContent = chatResponse.choices[0]?.message?.content || "{}";
    let parsed: any;
    try {
      parsed = cleanAndParseJSON(rawContent);
    } catch {
      parsed = { type: "text", content: rawContent };
    }

    // Handle simulation trigger
    if (parsed?.type === "simulation_trigger" && parsed?.params) {
      const p = parsed.params;
      // Route by the decision's real category so LOANS run through the Loan
      // Simulator (which credits the borrowed principal) and purchases through
      // the Purchase Simulator. Previously everything was "generic", so a
      // conversational personal-loan request never received its principal.
      const knownCategories = ["loan", "car", "phone", "laptop", "travel", "wedding", "renovation", "tuition", "medical", "business", "generic"];
      const category = knownCategories.includes(p.category) ? p.category : "generic";
      const simIntent: ExtractedIntent = {
        isSimulation: true,
        financingType: p.isCash ? "cash" : "financing",
        category,
        amount: p.price,
        tenureMonths: p.tenure,
        downPayment: p.downPayment,
        installment: p.installment,
        finalPayment: p.finalPayment
      };

      const simResult = SimulatorManager.simulateFromParams(simIntent, transactions, language, balance);
      return NextResponse.json(simResult);
    }

    // Handle commitments payload directly from OpenAI (filtered card display)
    if (parsed?.type === "commitments") {
      return NextResponse.json(parsed);
    }

    // Handle normal text message (conversation/questions). Accept any JSON with
    // a string `content` — models occasionally omit the "type" wrapper field,
    // and falling back to the welcome message would silently eat the answer.
    const textContent = typeof parsed?.content === "string" && parsed.content.trim()
      ? parsed.content
      : null;
    return NextResponse.json(
      textContent
        ? {
            type: "text",
            content: textContent,
            addCommitment: parsed.addCommitment ?? undefined,
            deleteCommitment: parsed.deleteCommitment ?? undefined,
            // Keep slot-filling alive ONLY while this turn is a simulation turn.
            // The next message is re-classified from scratch, so changing the
            // subject exits simulation mode instead of locking the conversation.
            pendingSim: isSimulationTurn ? { awaiting: "any", collected: {} } : undefined
          }
        : { type: "text", content: welcome }
    );

  } catch (error: any) {
    console.error("Error in /api/chat:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
