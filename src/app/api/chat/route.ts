import { NextResponse } from "next/server";
import OpenAI from "openai";
import { Transaction } from "../../../lib/data/types";
import { USE_MOCK_AI } from "../../../lib/data/config";
import { SimulatorManager } from "../../../lib/simulator/manager";
import { extractSimulationIntent } from "../../../lib/simulator/intent";
import { runSimulationConversation, findPendingSim } from "../../../lib/simulator/conversation";

// Force Node.js runtime as required by Recharts/Next environments
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { messages, transactions, language } = body as {
      messages: any[];
      transactions: Transaction[];
      language: "ar" | "en";
    };

    const isArabic = language === "ar";
    const lastUserMessage = messages[messages.length - 1]?.content || "";

    const apiKey = process.env.OPENAI_API_KEY;
    const hasRealKey = !!apiKey && !apiKey.includes("dummy");

    // ============================================================================
    // CONVERSATIONAL SIMULATION (advisor asks step-by-step, no assumed defaults)
    // ------------------------------------------------------------------------
    // If we are mid-conversation (the last assistant message is still awaiting a
    // slot answer), always resume the slot-filling here regardless of keywords.
    // ============================================================================
    const pendingSim = findPendingSim(messages);
    if (pendingSim) {
      const result = runSimulationConversation(messages, transactions, language);
      return NextResponse.json(result);
    }

    // ============================================================================
    // HYBRID INTENT LAYER (understands Saudi colloquial Arabic / عامية)
    // When a real OpenAI key is present, gpt-4o-mini parses the opening message
    // into structured slots; the conversation then asks for anything still missing
    // and the deterministic SimulatorManager does all the math.
    // If no real key (demo/offline), this is skipped and keyword matching is used.
    // ============================================================================
    if (hasRealKey) {
      try {
        const openaiClient = new OpenAI({ apiKey });
        const intent = await extractSimulationIntent(openaiClient, lastUserMessage, language);
        if (intent?.isSimulation) {
          const result = runSimulationConversation(messages, transactions, language, intent);
          return NextResponse.json(result);
        }
      } catch (err) {
        console.error("Hybrid intent extraction failed; falling back to keyword mode:", err);
      }
    }

    // ============================================================================
    // MOCK AI INTELLIGENT SIMULATION MODE
    // ============================================================================
    if (USE_MOCK_AI) {
      // Small simulated latency for natural AI typing feel
      await new Promise((r) => setTimeout(r, 1200));

      const queryLower = lastUserMessage.toLowerCase();

      // Differentiate Capability 3: FUTURE DECISION SIMULATION
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

      // Differentiate Capability 1: PAST REPORTS
      const isReportQuery = 
        !isSimulationQuery && (
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

      // Differentiate Capability 2: PRESENT HABITS / BEHAVIOR
      const isHabitsQuery = 
        !isSimulationQuery && !isReportQuery && (
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

      // ============================================================================
      // CAPABILITY 3: DECISION SIMULATION (conversational — asks for missing inputs)
      // ============================================================================
      if (isSimulationQuery) {
        const result = runSimulationConversation(messages, transactions, language);
        return NextResponse.json(result);
      }

      // ============================================================================
      // CAPABILITY 1: DETAILED PAST REPORTS
      // ============================================================================
      if (isReportQuery) {
        // Detect period
        let daysRange = 30; // default 30 days
        let periodName = isArabic ? "الشهر الماضي" : "Last 30 Days";

        if (queryLower.includes("week") || queryLower.includes("أسبوع") || queryLower.includes("7")) {
          daysRange = 7;
          periodName = isArabic ? "الأسبوع الماضي" : "Last 7 Days";
        } else if (queryLower.includes("15") || queryLower.includes("١٥")) {
          daysRange = 15;
          periodName = isArabic ? "الـ 15 يوماً الماضية" : "Last 15 Days";
        } else if (queryLower.includes("month") || queryLower.includes("30") || queryLower.includes("شهر")) {
          daysRange = 30;
          periodName = isArabic ? "الشهر الماضي" : "Last Month";
        }

        // Filter transactions within range
        const today = new Date("2026-05-29");
        const startDateLimit = new Date(today);
        startDateLimit.setDate(today.getDate() - daysRange);

        const filteredTxs = transactions.filter(t => new Date(t.transaction_date) >= startDateLimit);

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

        // Compute top categories sorted by amount
        const topCategories = Object.entries(categoryGroups)
          .map(([category, amount]) => {
            const percentage = totalSpent > 0 ? Math.round((amount / totalSpent) * 100) : 0;
            return { category, amount, percentage };
          })
          .sort((a, b) => b.amount - a.amount);

        // Find largest transactions
        const largestTxs = filteredTxs
          .filter(t => t.type === "debit")
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 3);

        // Generate intelligent Saudi context insights
        const insights: string[] = [];
        const hungerstationTotal = filteredTxs
          .filter(t => t.merchant === "Hungerstation" || t.merchant === "Jahez")
          .reduce((sum, t) => sum + t.amount, 0);

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

        // Append disclaimer to insights
        insights.push(isArabic 
          ? "يُرجى العلم بأن هذا التحليل يستند إلى البيانات المتاحة وهو لأغراض استشارية. للحصول على قرار تمويلي رسمي، يُرجى التواصل مع أحد مستشاري مصرف الإنماء."
          : "Please note that this analysis is based on available data and is for advisory purposes only. For an official financing decision, please contact an Alinma Bank advisor."
        );

        return NextResponse.json({
          type: "report",
          period: periodName,
          total_spent: totalSpent,
          total_income: totalIncome,
          top_categories: topCategories,
          largest_transactions: largestTxs,
          insights
        });
      }

      // ============================================================================
      // CAPABILITY 2: PRESENT HABITS ANALYSIS
      // ============================================================================
      if (isHabitsQuery) {
        // Run deep audit of April/May habits from seed data
        const last30Days = new Date();
        last30Days.setDate(last30Days.getDate() - 30);
        
        const last30Txs = transactions.filter(t => new Date(t.transaction_date) >= last30Days);
        const foodDeliveryTotal = last30Txs
          .filter(t => t.category === "Food & Restaurants" && (t.merchant === "Hungerstation" || t.merchant === "Jahez"))
          .reduce((sum, t) => sum + t.amount, 0);

        let content = "";
        
        if (isArabic) {
          content = `بناءً على البيانات المتاحة، يُشير التحليل المالي لمصرف الإنماء إلى سلوكك الإنفاقي وعادات الصرف خلال الـ 30 يوماً الماضية وفقاً للتالي:

🚨 **الإنفاق الاستهلاكي المرتفع:**
يتضح من تحليل سلوكك الإنفاقي ارتفاع ملحوظ في مصروفات تطبيقات توصيل الأغذية (هنجرستيشن وجاهز) بقيمة **${foodDeliveryTotal} ريال سعودي**، وهو ما يُمثّل نسبة **${Math.round((foodDeliveryTotal / 15000) * 100)}%** من إجمالي الدخل الشهري.

📉 **تحليل الوعاء الادخاري:**
تُظهر المؤشرات توقف التدفقات النقدية الموجهة للادخار (والبالغ متوسطها المعتاد 2,000 ريال سعودي شهرياً لصندوق ادخار الإنماء) خلال شهري أبريل ومايو، ويبلغ رصيد حسابك الجاري المتاح حالياً **${transactions[0]?.amount || "12,450"} ريال سعودي**. يُشير التحليل المالي إلى أن استمرار نمط الإنفاق الحالي قد يؤثر سلباً على قدرتك على الوفاء بالتزامات الدفعة الأولى للسيارة المقررة في نهاية العام الحالي.

📈 **توقعات الرصيد:**
وفقاً لبياناتك والإنفاق الحالي، يتضح من تحليل سلوكك الإنفاقي أن الفائض المالي المتوقع قبل دورة الرواتب القادمة في 27 يونيو يُقدّر بـ **750 ريال سعودي** فقط، مما يزيد من احتمالية التعرض لضغوط مالية.

💡 **التوصيات التنظيمية:**
لتحسين كفاءة إدارتك المالية، يُقترح وضع سقف إنفاق أقصى لتطبيقات التوصيل لا يتجاوز **150 ريال سعودي أسبوعياً**، وتحويل الفائض الناتج مباشرة لتعزيز وعاء الادخار.

يُرجى العلم بأن هذا التحليل يستند إلى البيانات المتاحة وهو لأغراض استشارية. للحصول على قرار تمويلي رسمي، يُرجى التواصل مع أحد مستشاري مصرف الإنماء.`;
        } else {
          content = `Based on the available data, Alinma Bank's financial analysis of your spending habits and consumption patterns over the past 30 days indicates the following:

🚨 **Elevated Discretionary Spend:**
It is evident from auditing your spending behavior that food delivery app expenditures (Hungerstation & Jahez) totaled **${foodDeliveryTotal} SAR**, representing approximately **${Math.round((foodDeliveryTotal / 15000) * 100)}%** of your monthly income.

📉 **Savings Trajectory Analysis:**
Financial indicators point to a disruption in your recurring savings transfers (typically averaging 2,000 SAR monthly to your Alinma Savings Pot) during April and May. The current available balance is **${transactions[0]?.amount || "12,450"} SAR**. According to your data, maintaining this spending rate may impair your capacity to meet your car down payment target at the end of the year.

📈 **Surplus Forecast:**
Financial analysis indicates that the projected surplus prior to the next salary cycle on June 27th is estimated at **750 SAR**, placing your cash buffer close to a deficit state.

💡 **Corrective Recommendations:**
To optimize financial efficiency, it is recommended to enforce a spending cap on food delivery apps not exceeding **150 SAR per week**, thereby redirecting the preserved funds to restore your savings pot.

Please note that this analysis is based on available data and is for advisory purposes only. For an official financing decision, please contact an Alinma Bank advisor.`;
        }

        return NextResponse.json({
          type: "text",
          content
        });
      }



      // Default plain text reply (e.g. conversational chit-chat)
      let textReply = "";
      if (isArabic) {
        textReply = `مرحباً بك. أنا «معك»، المستشار المالي الرقمي لمصرف الإنماء.

وفقاً لبياناتك المالية المتاحة، يُمكنني تقديم التحليلات التالية:
1. **تقارير الأداء المالي:** إصدار تقارير الإنفاق التفصيلية (مثال: "توفير تقرير مالي للأسبوع الماضي").
2. **تحليل السلوك الإنفاقي:** تقييم عادات الصرف ومواطن الهدر (مثال: "تحليل عادات الصرف الجارية").
3. **محاكاة القرارات التمويلية:** دراسة الأثر المالي للالتزامات المستقبلية (مثال: "دراسة جدوى شراء سيارة بقسط 2,000 ريال").

بناءً على البيانات المتاحة، كيف يمكنني دعم إدارتك المالية اليوم؟

يُرجى العلم بأن هذا التحليل يستند إلى البيانات المتاحة وهو لأغراض استشارية. للحصول على قرار تمويلي رسمي، يُرجى التواصل مع أحد مستشاري مصرف الإنماء.`;
      } else {
        textReply = `Welcome. I am Ma3ak, the digital financial advisor representing Alinma Bank.

Based on your available financial data, I am authorized to perform the following services:
1. **Financial Performance Reports:** Generating detailed spending reports (e.g., "Provide a financial report for the last week").
2. **Spending Behavior Analysis:** Auditing consumption habits (e.g., "Analyze current spending behavior").
3. **Financial Decision Simulation:** Evaluating the cashflow impact of future commitments (e.g., "Simulate a car purchase with a 2,000 SAR monthly installment").

How may I assist you with your financial management today?

Please note that this analysis is based on available data and is for advisory purposes only. For an official financing decision, please contact an Alinma Bank advisor.`;
      }

      return NextResponse.json({
        type: "text",
        content: textReply
      });
    }

    // ============================================================================
    // REAL OPENAI API MODE
    // ============================================================================
    if (!apiKey || apiKey.includes("dummy")) {
      return NextResponse.json(
        { error: "OpenAI API Key is missing or invalid. Set USE_MOCK_AI to true in src/lib/data/config.ts to run in mock mode." },
        { status: 500 }
      );
    }

    const openai = new OpenAI({ apiKey });

    // Build standard prompt with live transactions injection
    const txSummary = transactions.slice(0, 50).map(t => (
      `- Date: ${t.transaction_date}, Merchant: ${t.merchant}, Category: ${t.category}, Amount: ${t.amount} SAR, Type: ${t.type}, Description: ${t.description}`
    )).join("\n");

    const systemPrompt = `
You are Ma3ak (معك), a professional financial advisor representing Alinma Bank. You communicate in a formal, official banking tone, never casual. You speak in the user's selected language (Arabic or English). Always base your answers on real data, never fabricate numbers.

Below is the user's recent transaction history:
${txSummary}

Strict Guidelines for Tone & Style:
1. FORBIDDEN Words and Phrases (DO NOT USE):
   - In Arabic: "أنصحك", "حاول", "ممكن", "ربما", "أعتقد", "بصراحة", "طبعاً"
   - In English: "I recommend", "try to", "maybe", "probably", "I think", "honestly", "of course", "should", "you could"
2. REQUIRED Words and Phrases (USE THEM):
   - In Arabic: "يُشير التحليل المالي إلى", "وفقاً لبياناتك", "تُظهر المؤشرات", "يتضح من تحليل سلوكك الإنفاقي", "بناءً على البيانات المتاحة"
   - In English: "Financial analysis indicates", "According to your data", "Indicators show", "It is evident from auditing your spending behavior", "Based on the available data"
3. You must end all consultations, recommendations, and text responses with the following exact disclaimer text:
   - In Arabic: "يُرجى العلم بأن هذا التحليل يستند إلى البيانات المتاحة وهو لأغراض استشارية. للحصول على قرار تمويلي رسمي، يُرجى التواصل مع أحد مستشاري مصرف الإنماء."
   - In English: "Please note that this analysis is based on available data and is for advisory purposes only. For an official financing decision, please contact an Alinma Bank advisor."

You can do three things:
1. Generate financial reports for any time period (min 7 days)
2. Analyze current spending habits and give actionable tips
3. Simulate future financial decisions with 3 scenarios.

Decision Simulation Guidelines:
- Categorize the user's intent into either:
  1) Category 1: One-Time Purchase / Expense (e.g. traveling, wedding, buying land, university fees, home renovation, buying phone/car in cash, starting a business, etc.).
  2) Category 2: Financing / Loan / Installment (e.g. loan, borrowing, installments, mortgage, monthly payments, lease, etc.).
- Information Gathering:
  - For Category 1: Verify you have the "Total Cost/Price". If missing, you MUST return a type "text" JSON response politely requesting the cost.
  - For Category 2: Verify you have the "Financing Amount/Price". If missing, you MUST return a type "text" JSON response politely requesting the amount.
  - Retrieve all remaining information (income, savings, fixed expenses, obligations) from the customer's transaction profile below.
- If you have the required cost/amount, return type "simulation" JSON. Otherwise, return type "text" JSON to request the missing info.

When generating a report, return a JSON object with this structure:
{
  "type": "report",
  "period": "...",
  "total_spent": ...,
  "total_income": ...,
  "top_categories": [{"category": "...", "amount": ..., "percentage": ...}],
  "largest_transactions": [{"merchant": "...", "amount": ..., "category": "...", "transaction_date": "..."}],
  "insights": ["...", "..."]
}

When simulating a decision, return a JSON object with this structure:
{
  "type": "simulation",
  "decision": "...",
  "score": {
    "score": ..., // 0-100 score
    "color": "...", // "green" | "blue" | "yellow" | "red"
    "label": "...", // "Excellent Decision" | "Good Decision" | "Needs Review" | "Not Recommended"
    "reasons": ["...", "..."] // Bullet points of diagnostic reasoning (DTI under 33%, etc.)
  },
  "riskLevel": "...", // "Low Risk" | "Medium Risk" | "High Risk"
  "scenarios": [
    {"name": "Proceed Today", "monthly_impact": ..., "balance_in_period": ..., "verdict": "..."},
    {"name": "Increase Down Payment", "monthly_impact": ..., "balance_in_period": ..., "verdict": "..."},
    {"name": "Delay Purchase", "monthly_impact": ..., "balance_in_period": ..., "verdict": "..."}
  ],
  "insights": [{"text": "..."}, {"text": "..."}], // Programmatic metrics styled in bank language
  "timeline": [
    {"month": 0, "monthName": "Month 0", "balanceNow": ..., "balanceWait": ..., "balanceAdjusted": ...}
  ],
  "tableData": [
    {"metric": "...", "scenarioNow": "...", "scenarioAdjusted": "...", "scenarioWait": "..."}
  ],
  "sensitivity": [
    {"metric": "...", "value": "...", "impactText": "...", "isCritical": ...}
  ],
  "warnings": ["...", "..."],
  "summary": "...", // Final summary text
  "projectionMonths": ... // 6, 12, 36, 60
}

Otherwise, return a JSON object with this structure:
{
  "type": "text",
  "content": "..."
}

Always be honest. If a decision is bad for the user, say so clearly. Return ONLY valid JSON and nothing else. No markdown wrappers like \`\`\`json.
`;

    const chatResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        ...messages.map(m => ({ role: m.role, content: m.content }))
      ],
      response_format: { type: "json_object" }
    });

    const aiContent = chatResponse.choices[0]?.message?.content || "{}";
    return NextResponse.json(JSON.parse(aiContent));

  } catch (error: any) {
    console.error("Error in AI Chat API route:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
