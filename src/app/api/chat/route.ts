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
  deriveToday
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

    // ============================================================================
    // STEP 1 — Intent Detection: Report, Habits, and Commitments (Deterministic)
    // ============================================================================
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

    // --- Report ---
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

    // --- Habits ---
    if (isHabitsQuery) {
      return NextResponse.json(computeHabits(transactions, language, balance));
    }

    // --- Commitments ---
    if (isCommitmentsQuery) {
      return NextResponse.json(
        computeCommitments(transactions, language, customCommitments, deletedCommitments)
      );
    }

    // ============================================================================
    // STEP 2 — Check if Simulation is Active (conversational or starting)
    // ============================================================================
    const simulationKeywords = [
      "car", "سيارة", "سياره", "buy", "شراء", "ايفون", "أيفون", "iphone", "قرض", "loan", "أقساط", "installment",
      "أبي", "ابغى", "أفكر", "ودي", "ناوي", "هل أقدر", "وش رأيك", "تتوقع أقدر", "ودي أشتري", "ودي أسافر", "ودي أتزوج",
      "بشتري", "بسافر", "بآخذ قرض", "بقسط", "بمول", "أقدر أتحمل", "وش يصير لو", "لو اشتريت", "لو سافرت", "لو دفعت",
      "لو أخذت قرض", "لو مولت", "سفر", "سياحة", "رحلة", "زواج", "عرس", "ترميم", "تجديد", "دراسة", "جامعة", "مشروع",
      "علاج", "لابتوب", "كمبيوتر", "عقار", "بيت", "منزل", "rent", "travel", "vacation", "wedding", "marry", "renovate",
      "education", "tuition", "business", "afford", "thinking of", "planning to", "considering", "what if i", "borrow",
      "financing", "finance", "installments", "monthly payment", "lease", "leasing", "mortgage"
    ];

    const hasSimulationKeyword = simulationKeywords.some(k => queryLower.includes(k));
    const isSimulationActive =
      hasSimulationKeyword ||
      messages.some(m => m.metadata?.pendingSim || m.metadata?.simulationData);

    // Build financial summary
    const financialContext = buildFinancialSummary(transactions, balance || 0, language);

    const fmt = (n: number) => Math.round(n).toLocaleString();
    const disclaimer = isArabic
      ? "\n\nيُرجى العلم بأن هذا التحليل يستند إلى البيانات المتاحة وهو لأغراض استشارية. للحصول على قرار تمويلي رسمي، يُرجى التواصل مع أحد مستشاري مصرف الإنماء."
      : "\n\nPlease note that this analysis is based on available data and is for advisory purposes only. For an official financing decision, please contact an Alinma Bank advisor.";

    // -------------------------------------------------------------------------
    // MOCK AI MODE (Offline / Fallback)
    // -------------------------------------------------------------------------
    const isMockMode = !hasRealKey || USE_MOCK_AI;
    const today = deriveToday(transactions);
    const currentMonth = today.slice(0, 7);
    const monthTxs = transactions.filter(t => t.transaction_date.startsWith(currentMonth));
    const monthDebits = monthTxs.filter(t => t.type === "debit");
    const totalSpent = monthDebits.reduce((s, t) => s + t.amount, 0);

    const welcome = isArabic
      ? `مرحباً! أنا **معك** 🏦 المستشار المالي الرقمي لمصرف الإنماء.\n\nأنا مطّلع على **كامل حسابك** وأقدر أجاوبك على أي سؤال:\n\n💰 \"**كم رصيدي؟**\" · \"**وش آخر حواله؟**\" · \"**كم صرفت على القهوة؟**\"\n📊 \"**تقرير الأسبوع**\" · \"**تقرير الشهر الماضي**\"\n📈 \"**كيف أحوالي المالية؟**\"\n🧮 \"**أبي أشتري سيارة بقسط 2000**\"\n📋 \"**التزاماتي هذا الشهر**\"\n\nرصيدك الحالي: **${fmt(financialContext.balance)} ريال** | معاملاتك هذا الشهر: **${monthTxs.length}**\n\nوش أقدر أساعدك فيه؟${disclaimer}`
      : `Hello! I'm **Ma3ak** 🏦 your Alinma Bank digital financial advisor.\n\nI have **full access to your account** and can answer any question:\n\n💰 \"**What's my balance?**\" · \"**Last transfer?**\" · \"**Coffee spending?**\"\n📊 \"**Weekly report**\" · \"**Monthly report**\"\n📈 \"**Analyze my spending habits**\"\n🧮 \"**Can I afford a car at 2000/month?**\"\n📋 \"**My commitments this month**\"\n\nCurrent balance: **${fmt(financialContext.balance)} SAR** | Transactions this month: **${monthTxs.length}**\n\nHow can I help you?${disclaimer}`;

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

    // ============================================================================
    // REAL AI MODE — Dynamic Conversational AI Slot-Filling & Analysis
    // ============================================================================
    const openai = new OpenAI({ apiKey });

    // Switch between Simulation Agent and General Chat Agent
    let systemPrompt = "";
    
    if (isSimulationActive) {
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
    "finalPayment": <number, 0 if none/cash>
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
- You already retrieved and analyzed the client's full financial data (in the system data load message).
- You MUST use those numbers to answer. NEVER say "I cannot access your account".
- Reply in ${isArabic ? "Arabic (formal Gulf Arabic)" : "English"}.
- Use markdown (**bold**, bullet points) for clarity.
- Be concise, warm, and professional.

FORBIDDEN RESPONSES:
- "I cannot access your account"
- "I don't have access to your financial data"
- "Please check your banking app"

STRICT MATH RULE: All numbers in the system load message are FINAL. Use them as-is.

End every reply with:
${isArabic
  ? "يُرجى العلم بأن هذا التحليل يستند إلى البيانات المتاحة وهو لأغراض استشارية. للحصول على قرار تمويلي رسمي، يُرجى التواصل مع أحد مستشاري مصرف الإنماء."
  : "Please note that this analysis is based on available data and is for advisory purposes only. For an official financing decision, please contact an Alinma Bank advisor."}
Return ONLY valid JSON: {"type":"text","content":"..."} with no markdown wrappers.`;
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
      parsed = cleanAndParseJSON(rawContent);
    } catch {
      parsed = { type: "text", content: rawContent };
    }

    // Handle simulation trigger
    if (parsed?.type === "simulation_trigger" && parsed?.params) {
      const p = parsed.params;
      const intent: ExtractedIntent = {
        isSimulation: true,
        financingType: p.isCash ? "cash" : "financing",
        category: "generic",
        amount: p.price,
        tenureMonths: p.tenure,
        downPayment: p.downPayment,
        installment: p.installment,
        finalPayment: p.finalPayment
      };
      
      const simResult = SimulatorManager.simulateFromParams(intent, transactions, language, balance);
      return NextResponse.json(simResult);
    }

    // Handle normal text message (conversation/questions)
    return NextResponse.json(
      parsed?.type === "text" && typeof parsed.content === "string"
        ? {
            type: "text",
            content: parsed.content,
            // Attach pendingSim metadata to keep the conversation in simulation mode on next turns
            pendingSim: isSimulationActive ? { awaiting: "any", collected: {} } : undefined
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
