import { NextResponse } from "next/server";
import OpenAI from "openai";
import { Transaction } from "../../../lib/data/types";
import { USE_MOCK_AI } from "../../../lib/data/config";
import { SimulatorManager } from "../../../lib/simulator/manager";
import { extractSimulationIntent } from "../../../lib/simulator/intent";
import { computeReport, computeHabits, computeCommitments } from "../../../lib/finance/calculations";

// Force Node.js runtime as required by Recharts/Next environments
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { messages, transactions, language, balance, customCommitments } = body as {
      messages: any[];
      transactions: Transaction[];
      language: "ar" | "en";
      balance?: number; // real account balance, sent from the client
      customCommitments?: any[];
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

    const isHabitsQuery =
      !isSimulationQuery && !isCommitmentsQuery && (
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
        queryLower.includes("report") ||
        queryLower.includes("تقرير") ||
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
      return NextResponse.json(computeCommitments(transactions, language, customCommitments));
    }

    // ============================================================================
    // GENERAL CHAT (no money math involved)
    // ============================================================================
    const welcome = isArabic
      ? `مرحباً بك. أنا «معك»، المستشار المالي الرقمي لمصرف الإنماء.

وفقاً لبياناتك المالية المتاحة، يُمكنني تقديم التحليلات التالية:
1. **تقارير الأداء المالي:** إصدار تقارير الإنفاق التفصيلية (مثال: "توفير تقرير مالي للأسبوع الماضي").
2. **تحليل السلوك الإنفاقي:** تقييم عادات الصرف ومواطن الهدر (مثال: "تحليل عادات الصرف الجارية").
3. **محاكاة القرارات التمويلية:** دراسة الأثر المالي للالتزامات المستقبلية (مثال: "دراسة جدوى شراء سيارة بقسط 2,000 ريال").

بناءً على البيانات المتاحة، كيف يمكنني دعم إدارتك المالية اليوم؟

يُرجى العلم بأن هذا التحليل يستند إلى البيانات المتاحة وهو لأغراض استشارية. للحصول على قرار تمويلي رسمي، يُرجى التواصل مع أحد مستشاري مصرف الإنماء.`
      : `Welcome. I am Ma3ak, the digital financial advisor representing Alinma Bank.

Based on your available financial data, I am authorized to perform the following services:
1. **Financial Performance Reports:** Generating detailed spending reports (e.g., "Provide a financial report for the last week").
2. **Spending Behavior Analysis:** Auditing consumption habits (e.g., "Analyze current spending behavior").
3. **Financial Decision Simulation:** Evaluating the cashflow impact of future commitments (e.g., "Simulate a car purchase with a 2,000 SAR monthly installment").

How may I assist you with your financial management today?

Please note that this analysis is based on available data and is for advisory purposes only. For an official financing decision, please contact an Alinma Bank advisor.`;

    // Offline / mock: return the templated welcome (no LLM needed).
    if (!hasRealKey || USE_MOCK_AI) {
      if (USE_MOCK_AI) await new Promise((r) => setTimeout(r, 800)); // natural typing feel
      return NextResponse.json({ type: "text", content: welcome });
    }

    // Real key: let the LLM PHRASE a general reply only. It must NOT compute any figures —
    // reports, habits, and simulations are all produced by code above.
    const openai = new OpenAI({ apiKey });
    const systemPrompt = `You are Ma3ak (معك), a professional financial advisor for Alinma Bank. Reply in the user's language (${isArabic ? "Arabic" : "English"}) in a formal banking tone.
STRICT: Do NOT perform any arithmetic and do NOT produce totals, percentages, balances, ratios, or forecasts — financial reports, spending-habit analysis, and decision simulations are generated by the system, not by you. If the user asks for any of those, invite them to request it explicitly (e.g. "a report for last week", "analyze my habits", "simulate buying a car"). Keep general answers brief and helpful.
End every reply with this exact disclaimer:
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
