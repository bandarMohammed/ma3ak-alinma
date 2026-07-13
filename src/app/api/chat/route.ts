import { NextResponse } from "next/server";
import OpenAI from "openai";
import { Transaction } from "../../../lib/data/types";
import { USE_MOCK_AI } from "../../../lib/data/config";
import { runSimulationConversation, findPendingSim } from "../../../lib/simulator/conversation";
import { extractSimulationIntent } from "../../../lib/simulator/intent";
import {
  computeReport,
  computeHabits,
  computeCommitments,
  buildFinancialSummary,
  deriveToday
} from "../../../lib/finance/calculations";

// Force Node.js runtime
export const runtime = "nodejs";

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

    // =========================================================================
    // STEP 1 — Resume pending simulation conversation if mid-flow
    // =========================================================================
    const pendingSim = findPendingSim(messages);
    if (pendingSim) {
      return NextResponse.json(
        runSimulationConversation(messages, transactions, language, undefined, balance)
      );
    }

    // =========================================================================
    // STEP 2 — Hybrid intent: use OpenAI to detect simulation intent (colloquial)
    // =========================================================================
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

    // =========================================================================
    // STEP 3 — Keyword intent routing (deterministic, code-computed math)
    // =========================================================================
    const isCommitmentsQuery =
      queryLower.includes("commitment") ||
      queryLower.includes("commitments") ||
      queryLower.includes("التزام") ||
      queryLower.includes("التزامات") ||
      queryLower.includes("التزاماتي");

    const hasReportKeyword = queryLower.includes("report") || queryLower.includes("تقرير");

    const isHabitsQuery =
      !isCommitmentsQuery &&
      !hasReportKeyword && (
        queryLower.includes("habits") ||
        queryLower.includes("عادات") ||
        queryLower.includes("أحوالي") ||
        queryLower.includes("أموالي") ||
        queryLower.includes("كيف أحوالي") ||
        queryLower.includes("أموري")
      );

    const isReportQuery =
      !isCommitmentsQuery &&
      !isHabitsQuery && (
        hasReportKeyword ||
        queryLower.includes("history") ||
        queryLower.includes("week") ||
        queryLower.includes("أسبوع") ||
        queryLower.includes("الشهر الماضي") ||
        queryLower.includes("last month") ||
        queryLower.includes("تاريخ معاملاتي") ||
        queryLower.includes("سجل معاملاتي")
      );


    // --- Capability: Financial Reports ---
    if (isReportQuery) {
      const dateMatch =
        lastUserMessage.match(/(\d{4}-\d{2}-\d{2})\s*(?:إلى|الى|to|-)\s*(\d{4}-\d{2}-\d{2})/i) ||
        lastUserMessage.match(/(\d{4}-\d{2}-\d{2}).*?(\d{4}-\d{2}-\d{2})/);
      if (dateMatch) {
        return NextResponse.json(
          computeReport(transactions, { startDate: dateMatch[1], endDate: dateMatch[2] }, language)
        );
      }
      let daysRange = 30;
      if (queryLower.includes("week") || queryLower.includes("أسبوع") || queryLower.includes("7")) {
        daysRange = 7;
      } else if (queryLower.includes("15") || queryLower.includes("١٥")) {
        daysRange = 15;
      }
      return NextResponse.json(computeReport(transactions, daysRange, language));
    }

    // --- Capability: Habits Analysis ---
    if (isHabitsQuery) {
      return NextResponse.json(computeHabits(transactions, language, balance));
    }

    // --- Capability: Monthly Commitments ---
    if (isCommitmentsQuery) {
      return NextResponse.json(
        computeCommitments(transactions, language, customCommitments, deletedCommitments)
      );
    }

    // =========================================================================
    // STEP 4 — General Chat: AI with FULL financial context
    // Build financial summary from transaction data (all math in code)
    // =========================================================================
    const financialContext = buildFinancialSummary(transactions, balance || 0, language);

    const fmt = (n: number) => Math.round(n).toLocaleString();
    const disclaimer = isArabic
      ? "\n\nيُرجى العلم بأن هذا التحليل يستند إلى البيانات المتاحة وهو لأغراض استشارية. للحصول على قرار تمويلي رسمي، يُرجى التواصل مع أحد مستشاري مصرف الإنماء."
      : "\n\nPlease note that this analysis is based on available data and is for advisory purposes only. For an official financing decision, please contact an Alinma Bank advisor.";

    // -------------------------------------------------------------------------
    // MOCK AI — deterministic code-based answers for common questions
    // These run WITHOUT calling OpenAI (fast, no API cost)
    // -------------------------------------------------------------------------
    const isMockMode = !hasRealKey || USE_MOCK_AI;

    const today = deriveToday(transactions);
    const currentMonth = today.slice(0, 7);
    const monthTxs = transactions.filter(t => t.transaction_date.startsWith(currentMonth));
    const monthDebits = monthTxs.filter(t => t.type === "debit");
    const totalSpent = monthDebits.reduce((s, t) => s + t.amount, 0);

    // Balance question
    if (queryLower.includes("رصيد") || queryLower.includes("كم عندي") || queryLower.includes("كم فلوسي") || queryLower.includes("balance") || queryLower.includes("how much do i have")) {
      const content = isArabic
        ? `💰 رصيدك الحالي في حسابك لدى مصرف الإنماء: **${fmt(financialContext.balance)} ريال سعودي**\n\n📊 متوسط دخلك الشهري: **${fmt(financialContext.monthlyIncome)} ريال**\n📉 متوسط مصروفاتك: **${fmt(financialContext.monthlyExpenses)} ريال**\n📈 الفائض الشهري: **${fmt(financialContext.monthlySurplus)} ريال**${disclaimer}`
        : `💰 Your current balance at Alinma Bank: **${fmt(financialContext.balance)} SAR**\n\n📊 Avg monthly income: **${fmt(financialContext.monthlyIncome)} SAR**\n📉 Avg monthly expenses: **${fmt(financialContext.monthlyExpenses)} SAR**\n📈 Monthly surplus: **${fmt(financialContext.monthlySurplus)} SAR**${disclaimer}`;
      return NextResponse.json({ type: "text", content });
    }

    // Transfer question
    if (queryLower.includes("حواله") || queryLower.includes("حوالة") || queryLower.includes("آخر تحويل") || queryLower.includes("حولت") || queryLower.includes("transfer") || queryLower.includes("last transfer")) {
      const tf = financialContext.lastTransfer;
      const content = tf
        ? (isArabic
          ? `💸 آخر تحويل من حسابك:\n\n📅 **التاريخ:** ${tf.date}\n🏦 **الجهة:** ${tf.merchant}\n💰 **المبلغ:** ${fmt(tf.amount)} ريال سعودي${disclaimer}`
          : `💸 Your last transfer:\n\n📅 **Date:** ${tf.date}\n🏦 **To:** ${tf.merchant}\n💰 **Amount:** ${fmt(tf.amount)} SAR${disclaimer}`)
        : (isArabic ? `لا يوجد تحويلات مسجلة حالياً.${disclaimer}` : `No transfers recorded.${disclaimer}`);
      return NextResponse.json({ type: "text", content });
    }

    // Biggest expense
    if (queryLower.includes("أكبر مصروف") || queryLower.includes("أكثر شي صرفت") || queryLower.includes("biggest") || queryLower.includes("largest expense")) {
      const biggest = monthDebits.length > 0
        ? monthDebits.reduce((max, t) => t.amount > max.amount ? t : max, monthDebits[0])
        : null;
      const content = biggest
        ? (isArabic
          ? `🔴 أكبر مصروف هذا الشهر:\n\n🏪 **التاجر:** ${biggest.merchant}\n💰 **المبلغ:** ${fmt(biggest.amount)} ريال\n📅 **التاريخ:** ${biggest.transaction_date}\n📂 **الفئة:** ${biggest.category}${disclaimer}`
          : `🔴 Biggest expense this month:\n\n🏪 **Merchant:** ${biggest.merchant}\n💰 **Amount:** ${fmt(biggest.amount)} SAR\n📅 **Date:** ${biggest.transaction_date}\n📂 **Category:** ${biggest.category}${disclaimer}`)
        : (isArabic ? `لا توجد مصروفات هذا الشهر.${disclaimer}` : `No expenses this month.${disclaimer}`);
      return NextResponse.json({ type: "text", content });
    }

    // Transaction count
    if (queryLower.includes("كم عدد") || queryLower.includes("كم معامل") || queryLower.includes("how many transactions")) {
      const credits = monthTxs.filter(t => t.type === "credit");
      const content = isArabic
        ? `📊 معاملاتك هذا الشهر (${currentMonth}):\n\n📋 **الإجمالي:** ${monthTxs.length} معاملة\n📉 **مصروفات:** ${monthDebits.length}\n📈 **إيرادات:** ${credits.length}${disclaimer}`
        : `📊 Your transactions this month (${currentMonth}):\n\n📋 **Total:** ${monthTxs.length}\n📉 **Debits:** ${monthDebits.length}\n📈 **Credits:** ${credits.length}${disclaimer}`;
      return NextResponse.json({ type: "text", content });
    }

    // Salary question
    if (queryLower.includes("راتب") || queryLower.includes("راتبي") || queryLower.includes("salary") || queryLower.includes("income")) {
      const sortedTxs = [...transactions].sort((a, b) => b.transaction_date.localeCompare(a.transaction_date));
      const lastSalary = sortedTxs.find(t => t.type === "credit");
      const content = lastSalary
        ? (isArabic
          ? `💵 معلومات الراتب:\n\n🏦 **المصدر:** ${lastSalary.merchant}\n💰 **المبلغ:** ${fmt(lastSalary.amount)} ريال\n📅 **آخر إيداع:** ${lastSalary.transaction_date}\n📆 **يوم الإيداع:** يوم ${lastSalary.transaction_date.slice(8, 10)} من كل شهر${disclaimer}`
          : `💵 Salary:\n\n🏦 **Source:** ${lastSalary.merchant}\n💰 **Amount:** ${fmt(lastSalary.amount)} SAR\n📅 **Last Deposit:** ${lastSalary.transaction_date}\n📆 **Day:** Day ${lastSalary.transaction_date.slice(8, 10)} of each month${disclaimer}`)
        : (isArabic ? `لا يوجد سجل رواتب.${disclaimer}` : `No salary records found.${disclaimer}`);
      return NextResponse.json({ type: "text", content });
    }

    // Spending by category
    if (queryLower.includes("كم صرفت") || queryLower.includes("صرفت كم") || queryLower.includes("how much") && queryLower.includes("spend")) {
      let categoryTotal = 0;
      let label = isArabic ? "إجمالي المصروفات" : "Total expenses";
      if (queryLower.includes("قهوة") || queryLower.includes("coffee") || queryLower.includes("starbucks")) {
        categoryTotal = monthDebits.filter(t => t.description.toLowerCase().includes("قهوة") || t.merchant.toLowerCase().includes("starbucks") || t.merchant.toLowerCase().includes("arabica") || t.merchant.toLowerCase().includes("barns")).reduce((s, t) => s + t.amount, 0);
        label = isArabic ? "القهوة ☕" : "Coffee ☕";
      } else if (queryLower.includes("توصيل") || queryLower.includes("هنقر") || queryLower.includes("جاهز") || queryLower.includes("delivery")) {
        categoryTotal = monthDebits.filter(t => t.merchant === "Hungerstation" || t.merchant === "Jahez").reduce((s, t) => s + t.amount, 0);
        label = isArabic ? "توصيل الطعام 🍔" : "Food Delivery 🍔";
      } else if (queryLower.includes("بقال") || queryLower.includes("مقاضي") || queryLower.includes("grocer")) {
        categoryTotal = monthDebits.filter(t => t.description.toLowerCase().includes("مقاضي") || t.description.toLowerCase().includes("groceries")).reduce((s, t) => s + t.amount, 0);
        label = isArabic ? "البقالة 🛒" : "Groceries 🛒";
      } else if (queryLower.includes("وقود") || queryLower.includes("بنزين") || queryLower.includes("fuel")) {
        categoryTotal = monthDebits.filter(t => t.description.toLowerCase().includes("وقود") || t.merchant.toLowerCase().includes("petrol")).reduce((s, t) => s + t.amount, 0);
        label = isArabic ? "الوقود ⛽" : "Fuel ⛽";
      } else if (queryLower.includes("تسوق") || queryLower.includes("shopping")) {
        categoryTotal = monthDebits.filter(t => t.category === "Shopping").reduce((s, t) => s + t.amount, 0);
        label = isArabic ? "التسوق 🛍️" : "Shopping 🛍️";
      } else if (queryLower.includes("أكل") || queryLower.includes("مطاعم") || queryLower.includes("food") || queryLower.includes("restaurant")) {
        categoryTotal = monthDebits.filter(t => t.category === "Food & Restaurants").reduce((s, t) => s + t.amount, 0);
        label = isArabic ? "الأكل والمطاعم 🍽️" : "Food & Restaurants 🍽️";
      } else {
        categoryTotal = totalSpent;
      }
      const content = isArabic
        ? `📊 **${label}** هذا الشهر: **${fmt(categoryTotal)} ريال**${disclaimer}`
        : `📊 **${label}** this month: **${fmt(categoryTotal)} SAR**${disclaimer}`;
      return NextResponse.json({ type: "text", content });
    }

    // Commitment-specific quick answer (e.g. "كم إيجاري؟")
    const commitmentKeywords = ["إيجار", "ايجار", "نتفلكس", "netflix", "تأمين", "insurance", "stc", "موبايلي", "mobily", "قسط", "تمويل", "كهرب", "مياه", "انترنت"];
    const matchedCommitmentKey = commitmentKeywords.find(k => queryLower.includes(k));
    if (matchedCommitmentKey) {
      const merchantTx = transactions.find(t =>
        t.type === "debit" && (
          t.merchant.toLowerCase().includes(matchedCommitmentKey) ||
          t.description.toLowerCase().includes(matchedCommitmentKey) ||
          t.category.toLowerCase().includes(matchedCommitmentKey)
        )
      );
      if (merchantTx) {
        const allForMerchant = transactions.filter(t => t.merchant === merchantTx.merchant && t.type === "debit");
        const avgAmount = allForMerchant.reduce((s, t) => s + t.amount, 0) / allForMerchant.length;
        const paidThisMonth = monthDebits.filter(t => t.merchant === merchantTx.merchant).reduce((s, t) => s + t.amount, 0);
        const content = isArabic
          ? `📋 **${merchantTx.merchant}**:\n\n💰 **المبلغ الشهري المعتاد:** ${fmt(avgAmount)} ريال\n✅ **مدفوع هذا الشهر:** ${fmt(paidThisMonth)} ريال\n📂 **الفئة:** ${merchantTx.category}${disclaimer}`
          : `📋 **${merchantTx.merchant}**:\n\n💰 **Usual monthly amount:** ${fmt(avgAmount)} SAR\n✅ **Paid this month:** ${fmt(paidThisMonth)} SAR\n📂 **Category:** ${merchantTx.category}${disclaimer}`;
        return NextResponse.json({ type: "text", content });
      }
    }

    // Welcome / greeting
    const greetingKeywords = ["مرحبا", "هلا", "السلام", "أهلا", "هاي", "hello", "hi", "hey", "صباح", "مساء"];
    const isGreeting = greetingKeywords.some(k => queryLower.includes(k)) || queryLower.length < 10;

    const welcome = isArabic
      ? `مرحباً! أنا **معك** 🏦 المستشار المالي الرقمي لمصرف الإنماء.\n\nأنا مطّلع على **كامل حسابك** وأقدر أجاوبك على أي سؤال:\n\n💰 \"**كم رصيدي؟**\" · \"**وش آخر حواله؟**\" · \"**كم صرفت على القهوة؟**\"\n📊 \"**تقرير الأسبوع**\" · \"**تقرير الشهر الماضي**\"\n📈 \"**كيف أحوالي المالية؟**\"\n🧮 \"**أبي أشتري سيارة بقسط 2000**\"\n📋 \"**التزاماتي هذا الشهر**\"\n\nرصيدك الحالي: **${fmt(financialContext.balance)} ريال** | معاملاتك هذا الشهر: **${monthTxs.length}**\n\nوش أقدر أساعدك فيه؟${disclaimer}`
      : `Hello! I'm **Ma3ak** 🏦 your Alinma Bank digital financial advisor.\n\nI have **full access to your account** and can answer any question:\n\n💰 \"**What's my balance?**\" · \"**Last transfer?**\" · \"**Coffee spending?**\"\n📊 \"**Weekly report**\" · \"**Monthly report**\"\n📈 \"**Analyze my spending habits**\"\n🧮 \"**Can I afford a car at 2000/month?**\"\n📋 \"**My commitments this month**\"\n\nCurrent balance: **${fmt(financialContext.balance)} SAR** | Transactions this month: **${monthTxs.length}**\n\nHow can I help you?${disclaimer}`;

    // Mock mode fallback (no OpenAI)
    if (isMockMode) {
      if (USE_MOCK_AI) await new Promise(r => setTimeout(r, 600));
      if (isGreeting) return NextResponse.json({ type: "text", content: welcome });

      // Generic fallback with financial snapshot
      const fallback = isArabic
        ? `بناءً على بياناتك المالية:\n\n💰 **الرصيد:** ${fmt(financialContext.balance)} ريال\n📉 **صرفت هذا الشهر:** ${fmt(totalSpent)} ريال\n📊 **الفائض الشهري:** ${fmt(financialContext.monthlySurplus)} ريال\n\nاسألني عن:\n• \"كم صرفت على القهوة؟\" · \"وش آخر حواله؟\" · \"كم إيجاري؟\" · \"تقرير الأسبوع\"${disclaimer}`
        : `Based on your financial data:\n\n💰 **Balance:** ${fmt(financialContext.balance)} SAR\n📉 **Spent this month:** ${fmt(totalSpent)} SAR\n📊 **Monthly surplus:** ${fmt(financialContext.monthlySurplus)} SAR\n\nAsk me:\n• \"How much on coffee?\" · \"Last transfer?\" · \"How much is my rent?\" · \"Weekly report\"${disclaimer}`;
      return NextResponse.json({ type: "text", content: fallback });
    }

    // =========================================================================
    // STEP 5 — OpenAI with financial context injected as prior assistant message
    // KEY: Data is injected as an "assistant" turn that already happened, making
    // the model treat it as its own pre-existing knowledge — not external claims.
    // This prevents the model from saying "I cannot access your account."
    // =========================================================================
    const openai = new OpenAI({ apiKey });

    const systemPrompt = `You are Ma3ak (معك), the AI financial assistant EMBEDDED inside Alinma Bank's official app.

CRITICAL IDENTITY:
- You are NOT a general AI. You are an EMBEDDED BANKING SYSTEM with DIRECT DATABASE ACCESS to this client's account.
- You have already retrieved and loaded the client's complete financial data (visible in your previous message).
- You MUST answer using the numbers from your previous message. They are FINAL and computed by the bank's system.
- Reply in ${isArabic ? "Arabic (Gulf dialect, formal tone)" : "English"}.
- Use **bold** and bullet points for clarity. Be concise and professional.
- For SAMA/eligibility questions: compute debt-to-income ratio using the client's actual salary and commitments. Saudi SAMA regulation: total monthly installments ≤ 33% of net salary.

ABSOLUTE PROHIBITIONS — NEVER say:
✗ "I cannot access your account"
✗ "I don't have access to your financial data"
✗ "Please check your banking app"
✗ "Please provide your income" (you already have it in your previous message)
✗ Invent or estimate any number not in your previous message

End every reply with:
${isArabic
  ? "يُرجى العلم بأن هذا التحليل يستند إلى البيانات المتاحة وهو لأغراض استشارية. للحصول على قرار تمويلي رسمي، يُرجى التواصل مع أحد مستشاري مصرف الإنماء."
  : "Please note that this analysis is based on available data and is for advisory purposes only. For an official financing decision, please contact an Alinma Bank advisor."}
Return ONLY valid JSON: {"type":"text","content":"..."} — no markdown code fences.`;

    // Inject financial data as a prior assistant message so model treats it as self-knowledge
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

    const chatResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        ...conversationHistory
      ]
    });

    const rawContent = chatResponse.choices[0]?.message?.content || "{}";
    let parsed: any;
    try {
      parsed = JSON.parse(rawContent);
    } catch {
      parsed = { type: "text", content: rawContent };
    }

    return NextResponse.json(
      parsed?.type === "text" && typeof parsed.content === "string"
        ? { type: "text", content: parsed.content }
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
