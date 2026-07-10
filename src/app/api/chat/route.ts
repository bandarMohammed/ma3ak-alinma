import { NextResponse } from "next/server";
import OpenAI from "openai";
import { Transaction } from "../../../lib/data/types";
import { USE_MOCK_AI } from "../../../lib/data/config";
import { SimulatorManager } from "../../../lib/simulator/manager";
import { extractSimulationIntent } from "../../../lib/simulator/intent";
import { runSimulationConversation, findPendingSim } from "../../../lib/simulator/conversation";
import { computeReport, computeHabits, computeCommitments, buildFinancialSummary, deriveToday } from "../../../lib/finance/calculations";

// Force Node.js runtime as required by Recharts/Next environments
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { messages, transactions, language, balance, customCommitments, deletedCommitments } = body as {
      messages: any[];
      transactions: Transaction[];
      language: "ar" | "en";
      balance?: number; // real account balance, sent from the client
      customCommitments?: any[];
      deletedCommitments?: string[];
    };

    const isArabic = language === "ar";
    const lastUserMessage = messages[messages.length - 1]?.content || "";

    const apiKey = process.env.OPENAI_API_KEY;
    const hasRealKey = !!apiKey && !apiKey.includes("dummy");

    // ============================================================================
    // CONVERSATIONAL SIMULATION (advisor asks step-by-step, no assumed defaults)
    // If we are mid-conversation (last assistant msg awaits a slot answer), resume it.
    // ============================================================================
    const pendingSim = findPendingSim(messages);
    if (pendingSim) {
      return NextResponse.json(
        runSimulationConversation(messages, transactions, language, undefined, balance)
      );
    }

    // ============================================================================
    // HYBRID INTENT LAYER (understands Saudi colloquial Arabic / عامية)
    // gpt-4o-mini parses the opening message into structured slots ONLY (language
    // understanding). All financial math stays in the deterministic SimulatorManager.
    // ============================================================================
    if (hasRealKey) {
      try {
        const openaiClient = new OpenAI({ apiKey });
        const intent = await extractSimulationIntent(openaiClient, lastUserMessage, language);
        if (intent?.isSimulation) {
          return NextResponse.json(
            runSimulationConversation(messages, transactions, language, intent, balance)
          );
        }
      } catch (err) {
        console.error("Hybrid intent extraction failed; falling back to keyword mode:", err);
      }
    }

    // ============================================================================
    // INTENT ROUTING — money math is computed in CODE, never the LLM.
    // Report / Habits / Simulation are handled deterministically here, regardless
    // of USE_MOCK_AI. The LLM (if enabled) only handles general chit-chat phrasing.
    // ============================================================================
    const queryLower = lastUserMessage.toLowerCase();

    const simulationKeywords = [
      "car", "سيارة", "سياره", "buy", "شراء", "ايفون", "أيفون", "iphone", "قرض", "loan", "أقساط", "installment",
      "أبي", "ابغى", "أفكر", "ودي", "ناوي", "هل أقدر", "وش رأيك", "تتوقع أقدر", "ودي أشتري", "ودي أسافر", "ودي أتزوج",
      "بشتري", "بسافر", "بآخذ قرض", "بقسط", "بمول", "أقدر أتحمل", "وش يصير لو", "لو اشتريت", "لو سافرت", "لو دفعت",
      "لو أخذت قرض", "لو مولت", "سفر", "سياحة", "رحلة", "زواج", "عرس", "ترميم", "تجديد", "دراسة", "جامعة", "مشروع",
      "علاج", "لابتوب", "كمبيوتر", "عقار", "بيت", "منزل", "rent", "travel", "vacation", "wedding", "marry", "renovate",
      "education", "tuition", "business", "afford", "thinking of", "planning to", "considering", "what if i", "borrow",
      "financing", "finance", "installments", "monthly payment", "lease", "leasing", "mortgage"
    ];
    const isSimulationQuery = simulationKeywords.some(keyword => queryLower.includes(keyword));

    const isCommitmentsQuery =
      !isSimulationQuery && (
        queryLower.includes("commitment") ||
        queryLower.includes("commitments") ||
        queryLower.includes("التزام") ||
        queryLower.includes("التزامات") ||
        queryLower.includes("التزاماتي")
      );

    const hasReportKeyword = queryLower.includes("report") || queryLower.includes("تقرير");

    const isHabitsQuery =
      !isSimulationQuery && !isCommitmentsQuery && !hasReportKeyword && (
        queryLower.includes("habits") ||
        queryLower.includes("عادات") ||
        queryLower.includes("أحوالي") ||
        queryLower.includes("أموالي") ||
        queryLower.includes("صرفي") ||
        queryLower.includes("spending too much") ||
        queryLower.includes("bad habit") ||
        queryLower.includes("كيف أحوالي") ||
        queryLower.includes("أموري")
      );

    const isReportQuery =
      !isSimulationQuery && !isCommitmentsQuery && !isHabitsQuery && (
        hasReportKeyword ||
        queryLower.includes("صرفي") ||
        queryLower.includes("history") ||
        queryLower.includes("spent") ||
        queryLower.includes("week") ||
        queryLower.includes("month") ||
        queryLower.includes("أسبوع") ||
        queryLower.includes("شهر") ||
        queryLower.includes("تاريخ")
      );

    // CAPABILITY 3 — DECISION SIMULATION (deterministic conversation + math)
    if (isSimulationQuery) {
      return NextResponse.json(
        runSimulationConversation(messages, transactions, language, undefined, balance)
      );
    }

    // CAPABILITY 1 — DETAILED PAST REPORTS (numbers computed in code)
    if (isReportQuery) {
      // Check for explicit YYYY-MM-DD custom date range
      const dateMatch = lastUserMessage.match(/(\d{4}-\d{2}-\d{2})\s*(?:إلى|الى|to|-)\s*(\d{4}-\d{2}-\d{2})/i) ||
                        lastUserMessage.match(/(\d{4}-\d{2}-\d{2}).*?(\d{4}-\d{2}-\d{2})/);
      if (dateMatch) {
        const startDate = dateMatch[1];
        const endDate = dateMatch[2];
        return NextResponse.json(computeReport(transactions, { startDate, endDate }, language));
      }

      let daysRange = 30;
      if (queryLower.includes("week") || queryLower.includes("أسبوع") || queryLower.includes("7")) {
        daysRange = 7;
      } else if (queryLower.includes("15") || queryLower.includes("١٥")) {
        daysRange = 15;
      } else if (queryLower.includes("month") || queryLower.includes("30") || queryLower.includes("شهر")) {
        daysRange = 30;
      }
      return NextResponse.json(computeReport(transactions, daysRange, language));
    }

    // CAPABILITY 2 — PRESENT HABITS ANALYSIS (numbers computed in code)
    if (isHabitsQuery) {
      return NextResponse.json(computeHabits(transactions, language, balance));
    }

    // CAPABILITY 4 — MY COMMITMENTS THIS MONTH (numbers computed in code)
    if (isCommitmentsQuery) {
      return NextResponse.json(computeCommitments(transactions, language, customCommitments, deletedCommitments));
    }

    // ============================================================================
    // GENERAL CHAT — AI is now FULLY AWARE of the user's financial data.
    // The buildFinancialSummary() function computes ALL numbers in code and
    // produces a text snapshot that gets injected into the system prompt.
    // The AI sees the finished numbers and phrases answers — it never computes.
    // ============================================================================
    const financialContext = buildFinancialSummary(transactions, balance || 0, language);

    // --- Smart Mock Responses (code-computed, no AI needed) ---
    // These handle the most common direct questions deterministically.
    const balanceKeywords = ["رصيد", "رصيدي", "كم عندي", "كم فلوسي", "كم معي", "balance", "how much do i have"];
    const transferKeywords = ["حواله", "حوالة", "تحويل", "آخر تحويل", "حولت", "transfer", "last transfer"];
    const spentKeywords = ["كم صرفت", "صرفت كم", "how much did i spend", "how much spent"];
    const biggestKeywords = ["أكبر مصروف", "أكثر شي صرفت", "اكبر", "biggest expense", "largest"];
    const countKeywords = ["كم عدد", "كم معامله", "كم معاملة", "how many transactions"];
    const salaryKeywords = ["راتب", "راتبي", "متى الراتب", "salary", "payroll", "income"];
    const commitmentQuickKeys = ["إيجار", "ايجار", "rent", "نتفلكس", "netflix", "تأمين", "insurance", "stc", "موبايلي", "mobily", "قسط", "تمويل"];

    const isBalanceQ = balanceKeywords.some(k => queryLower.includes(k));
    const isTransferQ = transferKeywords.some(k => queryLower.includes(k));
    const isSpentQ = spentKeywords.some(k => queryLower.includes(k));
    const isBiggestQ = biggestKeywords.some(k => queryLower.includes(k));
    const isCountQ = countKeywords.some(k => queryLower.includes(k));
    const isSalaryQ = salaryKeywords.some(k => queryLower.includes(k));

    const fmt = (n: number) => Math.round(n).toLocaleString();
    const disclaimer = isArabic
      ? "\n\nيُرجى العلم بأن هذا التحليل يستند إلى البيانات المتاحة وهو لأغراض استشارية. للحصول على قرار تمويلي رسمي، يُرجى التواصل مع أحد مستشاري مصرف الإنماء."
      : "\n\nPlease note that this analysis is based on available data and is for advisory purposes only. For an official financing decision, please contact an Alinma Bank advisor.";

    // Quick deterministic answers (no AI call needed)
    if (isBalanceQ && (!hasRealKey || USE_MOCK_AI)) {
      const content = isArabic
        ? `💰 رصيدك الحالي في حسابك الجاري لدى مصرف الإنماء يبلغ **${fmt(financialContext.balance)} ريال سعودي**.\n\nمتوسط دخلك الشهري: **${fmt(financialContext.monthlyIncome)} ريال**\nمتوسط مصروفاتك الشهرية: **${fmt(financialContext.monthlyExpenses)} ريال**\nالفائض الشهري التقديري: **${fmt(financialContext.monthlySurplus)} ريال**${disclaimer}`
        : `💰 Your current balance at Alinma Bank is **${fmt(financialContext.balance)} SAR**.\n\nAverage monthly income: **${fmt(financialContext.monthlyIncome)} SAR**\nAverage monthly expenses: **${fmt(financialContext.monthlyExpenses)} SAR**\nEstimated monthly surplus: **${fmt(financialContext.monthlySurplus)} SAR**${disclaimer}`;
      return NextResponse.json({ type: "text", content });
    }

    if (isTransferQ && (!hasRealKey || USE_MOCK_AI)) {
      const tf = financialContext.lastTransfer;
      const content = tf
        ? (isArabic
          ? `💸 آخر تحويل تم تنفيذه من حسابك:\n\n📅 **التاريخ:** ${tf.date}\n🏦 **الجهة:** ${tf.merchant}\n💰 **المبلغ:** ${fmt(tf.amount)} ريال سعودي${disclaimer}`
          : `💸 Your last transfer:\n\n📅 **Date:** ${tf.date}\n🏦 **To:** ${tf.merchant}\n💰 **Amount:** ${fmt(tf.amount)} SAR${disclaimer}`)
        : (isArabic ? `لا يوجد تحويلات مسجلة في حسابك حالياً.${disclaimer}` : `No transfers recorded in your account.${disclaimer}`);
      return NextResponse.json({ type: "text", content });
    }

    if (isBiggestQ && (!hasRealKey || USE_MOCK_AI)) {
      const today = deriveToday(transactions);
      const currentMonth = today.slice(0, 7);
      const monthDebits = transactions.filter(t => t.transaction_date.startsWith(currentMonth) && t.type === "debit");
      const biggest = monthDebits.length > 0 ? monthDebits.reduce((max, t) => t.amount > max.amount ? t : max, monthDebits[0]) : null;
      const content = biggest
        ? (isArabic
          ? `🔴 أكبر مصروف لك هذا الشهر:\n\n🏪 **التاجر:** ${biggest.merchant}\n💰 **المبلغ:** ${fmt(biggest.amount)} ريال سعودي\n📅 **التاريخ:** ${biggest.transaction_date}\n📂 **الفئة:** ${biggest.category}${disclaimer}`
          : `🔴 Your biggest expense this month:\n\n🏪 **Merchant:** ${biggest.merchant}\n💰 **Amount:** ${fmt(biggest.amount)} SAR\n📅 **Date:** ${biggest.transaction_date}\n📂 **Category:** ${biggest.category}${disclaimer}`)
        : (isArabic ? `لا توجد مصروفات مسجلة لهذا الشهر.${disclaimer}` : `No expenses recorded this month.${disclaimer}`);
      return NextResponse.json({ type: "text", content });
    }

    if (isCountQ && (!hasRealKey || USE_MOCK_AI)) {
      const today = deriveToday(transactions);
      const currentMonth = today.slice(0, 7);
      const monthTxs = transactions.filter(t => t.transaction_date.startsWith(currentMonth));
      const debits = monthTxs.filter(t => t.type === "debit");
      const credits = monthTxs.filter(t => t.type === "credit");
      const content = isArabic
        ? `📊 إحصائيات معاملاتك هذا الشهر:\n\n📋 **إجمالي المعاملات:** ${monthTxs.length} معاملة\n📉 **معاملات الصرف:** ${debits.length} معاملة\n📈 **معاملات الدخل:** ${credits.length} معاملة${disclaimer}`
        : `📊 Your transaction stats this month:\n\n📋 **Total:** ${monthTxs.length} transactions\n📉 **Debits:** ${debits.length}\n📈 **Credits:** ${credits.length}${disclaimer}`;
      return NextResponse.json({ type: "text", content });
    }

    if (isSalaryQ && (!hasRealKey || USE_MOCK_AI)) {
      const sortedTxs = [...transactions].sort((a, b) => b.transaction_date.localeCompare(a.transaction_date));
      const lastSalary = sortedTxs.find(t => t.type === "credit");
      const content = lastSalary
        ? (isArabic
          ? `💵 معلومات الراتب:\n\n🏦 **المصدر:** ${lastSalary.merchant}\n💰 **المبلغ:** ${fmt(lastSalary.amount)} ريال سعودي\n📅 **آخر إيداع:** ${lastSalary.transaction_date}\n📆 **يوم الإيداع المعتاد:** يوم ${lastSalary.transaction_date.slice(8, 10)} من كل شهر${disclaimer}`
          : `💵 Salary Information:\n\n🏦 **Source:** ${lastSalary.merchant}\n💰 **Amount:** ${fmt(lastSalary.amount)} SAR\n📅 **Last Deposit:** ${lastSalary.transaction_date}\n📆 **Usual Day:** Day ${lastSalary.transaction_date.slice(8, 10)} of each month${disclaimer}`)
        : (isArabic ? `لا يوجد سجل رواتب متاح.${disclaimer}` : `No salary records available.${disclaimer}`);
      return NextResponse.json({ type: "text", content });
    }

    // For spending questions with specific category/merchant in mock mode
    if (isSpentQ && (!hasRealKey || USE_MOCK_AI)) {
      // Try to identify what category/merchant the user is asking about
      let categoryTotal = 0;
      let matchedLabel = "";
      const today = deriveToday(transactions);
      const currentMonth = today.slice(0, 7);
      const monthDebits = transactions.filter(t => t.transaction_date.startsWith(currentMonth) && t.type === "debit");

      if (queryLower.includes("قهوة") || queryLower.includes("coffee") || queryLower.includes("starbucks")) {
        categoryTotal = monthDebits.filter(t => t.merchant.toLowerCase().includes("starbucks") || t.merchant.toLowerCase().includes("arabica") || t.merchant.toLowerCase().includes("barns") || t.description.toLowerCase().includes("قهوة")).reduce((s, t) => s + t.amount, 0);
        matchedLabel = isArabic ? "القهوة ☕" : "Coffee ☕";
      } else if (queryLower.includes("توصيل") || queryLower.includes("هنقر") || queryLower.includes("جاهز") || queryLower.includes("delivery")) {
        categoryTotal = monthDebits.filter(t => t.merchant === "Hungerstation" || t.merchant === "Jahez").reduce((s, t) => s + t.amount, 0);
        matchedLabel = isArabic ? "توصيل الطعام 🍔" : "Food Delivery 🍔";
      } else if (queryLower.includes("بقال") || queryLower.includes("مقاضي") || queryLower.includes("grocer")) {
        categoryTotal = monthDebits.filter(t => t.description.toLowerCase().includes("مقاضي") || t.description.toLowerCase().includes("groceries")).reduce((s, t) => s + t.amount, 0);
        matchedLabel = isArabic ? "البقالة والمقاضي 🛒" : "Groceries 🛒";
      } else if (queryLower.includes("وقود") || queryLower.includes("بنزين") || queryLower.includes("fuel") || queryLower.includes("gas")) {
        categoryTotal = monthDebits.filter(t => t.description.toLowerCase().includes("وقود") || t.merchant.toLowerCase().includes("petrol")).reduce((s, t) => s + t.amount, 0);
        matchedLabel = isArabic ? "الوقود ⛽" : "Fuel ⛽";
      } else if (queryLower.includes("تسوق") || queryLower.includes("shopping") || queryLower.includes("أمازون") || queryLower.includes("amazon")) {
        categoryTotal = monthDebits.filter(t => t.category === "Shopping").reduce((s, t) => s + t.amount, 0);
        matchedLabel = isArabic ? "التسوق 🛍️" : "Shopping 🛍️";
      } else if (queryLower.includes("أكل") || queryLower.includes("مطاعم") || queryLower.includes("food") || queryLower.includes("restaurant")) {
        categoryTotal = monthDebits.filter(t => t.category === "Food & Restaurants").reduce((s, t) => s + t.amount, 0);
        matchedLabel = isArabic ? "الأكل والمطاعم 🍽️" : "Food & Restaurants 🍽️";
      } else {
        // General: total spent this month
        categoryTotal = monthDebits.reduce((s, t) => s + t.amount, 0);
        matchedLabel = isArabic ? "إجمالي المصروفات هذا الشهر" : "Total expenses this month";
      }

      const content = isArabic
        ? `📊 بناءً على بياناتك المالية:\n\n**${matchedLabel}:** ${fmt(categoryTotal)} ريال سعودي (هذا الشهر)${disclaimer}`
        : `📊 Based on your financial data:\n\n**${matchedLabel}:** ${fmt(categoryTotal)} SAR (this month)${disclaimer}`;
      return NextResponse.json({ type: "text", content });
    }

    // --- Welcome message (first interaction / greeting) ---
    const greetingKeywords = ["مرحبا", "هلا", "السلام", "أهلا", "هاي", "hello", "hi ", "hey", "good morning", "صباح", "مساء"];
    const isGreeting = greetingKeywords.some(k => queryLower.includes(k)) || queryLower.length < 10;

    const welcome = isArabic
      ? `مرحباً بك. أنا «معك»، المستشار المالي الرقمي لمصرف الإنماء. 🏦

أنا مطّلع بالكامل على بياناتك المالية ويمكنني مساعدتك في:

💰 **الاستعلام عن حسابك** — "كم رصيدي؟" · "وش آخر حواله؟" · "كم صرفت على القهوة؟"
📊 **التقارير المالية** — "تقرير الأسبوع" · "تقرير الشهر الماضي"
📈 **تحليل عاداتك** — "كيف أحوالي المالية؟" · "تحليل صرفي"
🧮 **محاكاة قراراتك** — "أبي أشتري سيارة بقسط 2000" · "لو سافرت بـ 5000 وش يصير؟"
📋 **التزاماتك الشهرية** — "التزاماتي هذا الشهر"

رصيدك الحالي: **${fmt(financialContext.balance)} ريال**
عدد معاملاتك هذا الشهر: **${transactions.filter(t => t.transaction_date.startsWith(deriveToday(transactions).slice(0, 7))).length} معاملة**

كيف أقدر أساعدك اليوم؟${disclaimer}`
      : `Welcome. I am Ma3ak, the digital financial advisor for Alinma Bank. 🏦

I have full access to your financial data and can help you with:

💰 **Account Inquiries** — "What's my balance?" · "Last transfer?" · "How much did I spend on coffee?"
📊 **Financial Reports** — "Weekly report" · "Monthly report"
📈 **Spending Analysis** — "How are my finances?" · "Analyze my spending"
🧮 **Decision Simulation** — "Can I afford a car at 2000/month?" · "What if I travel for 5000?"
📋 **Monthly Commitments** — "My commitments this month"

Current balance: **${fmt(financialContext.balance)} SAR**
Transactions this month: **${transactions.filter(t => t.transaction_date.startsWith(deriveToday(transactions).slice(0, 7))).length}**

How can I assist you today?${disclaimer}`;

    // Offline / mock: return smart responses or welcome
    if (!hasRealKey || USE_MOCK_AI) {
      if (USE_MOCK_AI) await new Promise((r) => setTimeout(r, 800));
      
      if (isGreeting) {
        return NextResponse.json({ type: "text", content: welcome });
      }

      // For any other unmatched question in mock mode, provide a helpful response
      // with a summary of what the user can ask
      const today = deriveToday(transactions);
      const currentMonth = today.slice(0, 7);
      const monthDebits = transactions.filter(t => t.transaction_date.startsWith(currentMonth) && t.type === "debit");
      const totalSpent = monthDebits.reduce((s, t) => s + t.amount, 0);
      
      // Check for commitment-specific quick questions
      const commitmentMatch = commitmentQuickKeys.find(k => queryLower.includes(k));
      if (commitmentMatch) {
        const merchantMatch = transactions.find(t => t.type === "debit" && (
          t.merchant.toLowerCase().includes(commitmentMatch) ||
          t.description.toLowerCase().includes(commitmentMatch)
        ));
        if (merchantMatch) {
          const merchantTxs = monthDebits.filter(t => t.merchant === merchantMatch.merchant);
          const paidThisMonth = merchantTxs.reduce((s, t) => s + t.amount, 0);
          const content = isArabic
            ? `📋 بخصوص **${merchantMatch.merchant}**:\n\n💰 **المبلغ المدفوع هذا الشهر:** ${fmt(paidThisMonth)} ريال\n📅 **آخر دفعة:** ${merchantMatch.transaction_date}\n📂 **الفئة:** ${merchantMatch.category}${disclaimer}`
            : `📋 Regarding **${merchantMatch.merchant}**:\n\n💰 **Paid this month:** ${fmt(paidThisMonth)} SAR\n📅 **Last payment:** ${merchantMatch.transaction_date}\n📂 **Category:** ${merchantMatch.category}${disclaimer}`;
          return NextResponse.json({ type: "text", content });
        }
      }

      // General fallback with financial snapshot
      const fallbackContent = isArabic
        ? `بناءً على بياناتك المالية المتاحة، إليك ملخص سريع:\n\n💰 **رصيدك الحالي:** ${fmt(financialContext.balance)} ريال\n📉 **مصروفاتك هذا الشهر:** ${fmt(totalSpent)} ريال\n📊 **الفائض الشهري:** ${fmt(financialContext.monthlySurplus)} ريال\n\nيمكنك سؤالي عن أي شيء يخص حسابك — مثل:\n• "كم صرفت على القهوة؟"\n• "وش آخر حواله؟"\n• "كم إيجاري؟"\n• "تقرير الأسبوع"\n• "التزاماتي"${disclaimer}`
        : `Based on your financial data, here's a quick snapshot:\n\n💰 **Current Balance:** ${fmt(financialContext.balance)} SAR\n📉 **Spent This Month:** ${fmt(totalSpent)} SAR\n📊 **Monthly Surplus:** ${fmt(financialContext.monthlySurplus)} SAR\n\nYou can ask me anything about your account — for example:\n• "How much did I spend on coffee?"\n• "What was my last transfer?"\n• "How much is my rent?"\n• "Weekly report"\n• "My commitments"${disclaimer}`;
      return NextResponse.json({ type: "text", content: fallbackContent });
    }

    // Real OpenAI key: send the FULL financial context so the AI can answer anything
    const openai = new OpenAI({ apiKey });
    const systemPrompt = `You are Ma3ak (معك), a professional and knowledgeable financial advisor for Alinma Bank. Reply in the user's language (${isArabic ? "Arabic" : "English"}).

PERSONALITY:
- You are a trusted, intelligent financial companion — NOT a generic chatbot.
- You know EVERYTHING about this client's financial life from the data below.
- Be warm, professional, and direct. Answer questions precisely with real numbers.
- If the user asks about a specific transaction, merchant, or amount — find it in the data and answer.
- If the user asks a general financial question, give a thoughtful answer based on their actual financial situation.
- Use markdown formatting (**bold**, bullet points) to structure your answers clearly.
- Keep answers concise but complete. Don't be verbose.

${financialContext.text}

STRICT RULES:
1. The numbers above are computed by the system and are FINAL. Use them as-is. NEVER recalculate, estimate, or invent numbers.
2. If asked for a full report, habits analysis, or decision simulation, tell the user to use the quick action buttons or ask explicitly (e.g., "تقرير الشهر", "عاداتي", "محاكاة شراء سيارة").
3. For questions about specific transactions, merchants, or amounts — answer directly from the data above.
4. End every reply with this exact disclaimer:
${isArabic
  ? "يُرجى العلم بأن هذا التحليل يستند إلى البيانات المتاحة وهو لأغراض استشارية. للحصول على قرار تمويلي رسمي، يُرجى التواصل مع أحد مستشاري مصرف الإنماء."
  : "Please note that this analysis is based on available data and is for advisory purposes only. For an official financing decision, please contact an Alinma Bank advisor."}
Return ONLY valid JSON: {"type":"text","content":"..."} with no markdown wrappers.`;

    const chatResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        ...messages.map((m: any) => ({ role: m.role, content: m.content }))
      ]
    });

    const aiContent = chatResponse.choices[0]?.message?.content || "{}";
    const parsed = JSON.parse(aiContent);
    return NextResponse.json(
      parsed?.type === "text" && typeof parsed.content === "string"
        ? { type: "text", content: parsed.content }
        : { type: "text", content: welcome }
    );

  } catch (error: any) {
    console.error("Error in AI Chat API route:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

