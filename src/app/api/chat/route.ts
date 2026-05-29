import { NextResponse } from "next/server";
import OpenAI from "openai";
import { Transaction } from "../../../lib/data/types";
import { USE_MOCK_AI } from "../../../lib/data/config";

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

    // ============================================================================
    // MOCK AI INTELLIGENT SIMULATION MODE
    // ============================================================================
    if (USE_MOCK_AI) {
      // Small simulated latency for natural AI typing feel
      await new Promise((r) => setTimeout(r, 1200));

      const queryLower = lastUserMessage.toLowerCase();

      // Differentiate Capability 1: PAST REPORTS
      const isReportQuery = 
        queryLower.includes("report") || 
        queryLower.includes("تقرير") || 
        queryLower.includes("صرفي") || 
        queryLower.includes("history") ||
        queryLower.includes("spent") ||
        queryLower.includes("week") ||
        queryLower.includes("month") ||
        queryLower.includes("أسبوع") ||
        queryLower.includes("شهر") ||
        queryLower.includes("تاريخ");

      // Differentiate Capability 3: FUTURE DECISION SIMULATION
      const isSimulationQuery = 
        queryLower.includes("car") || 
        queryLower.includes("سيارة") || 
        queryLower.includes("buy") || 
        queryLower.includes("شراء") || 
        queryLower.includes("ايفون") ||
        queryLower.includes("أيفون") ||
        queryLower.includes("iphone") ||
        queryLower.includes("قرض") ||
        queryLower.includes("loan") ||
        queryLower.includes("أقساط") ||
        queryLower.includes("installment");

      // Differentiate Capability 2: PRESENT HABITS / BEHAVIOR
      const isHabitsQuery = 
        queryLower.includes("habits") || 
        queryLower.includes("عادات") || 
        queryLower.includes("أحوالي") || 
        queryLower.includes("أموالي") || 
        queryLower.includes("صرفي") ||
        queryLower.includes("spending too much") ||
        queryLower.includes("bad habit") ||
        queryLower.includes("كيف أحوالي") ||
        queryLower.includes("أموري");

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
          insights.push(`إجمالي الدخل لهذه الفترة بلغ ${totalIncome.toLocaleString()} ريال، بينما بلغ الصرف ${totalSpent.toLocaleString()} ريال.`);
          
          if (hungerstationTotal > 150) {
            insights.push(`لاحظنا زيادة صرف على تطبيقات التوصيل (هنجرستيشن وجاهز) بقيمة ${hungerstationTotal.toLocaleString()} ريال. تقليل الصرف هنا بمعدل مرتين أسبوعياً يوفر لك الكثير.`);
          }
          
          const shoppingCat = topCategories.find(c => c.category === "Shopping");
          if (shoppingCat && shoppingCat.amount > 500) {
            insights.push(`فئة التسوق كانت من أعلى فئات الصرف بنسبة ${shoppingCat.percentage}%، نوصي بتأجيل المشتريات غير الضرورية.`);
          }

          if (insights.length < 3) {
            insights.push(`صافي وفرك المالي للفترة الحالية يقدر بـ ${(totalIncome - totalSpent).toLocaleString()} ريال. خطتك الادخارية جيدة، استمر بالتركيز!`);
          }
        } else {
          insights.push(`Total income for this period is ${totalIncome.toLocaleString()} SAR, while total spending is ${totalSpent.toLocaleString()} SAR.`);
          
          if (hungerstationTotal > 150) {
            insights.push(`You spent a total of ${hungerstationTotal.toLocaleString()} SAR on Hungerstation & Jahez delivery. Reducing this could save you up to 20% on food expenses.`);
          }
          
          const shoppingCat = topCategories.find(c => c.category === "Shopping");
          if (shoppingCat && shoppingCat.amount > 500) {
            insights.push(`Shopping stands out as a top category at ${shoppingCat.percentage}% of your expenses. We recommend prioritizing essentials.`);
          }

          if (insights.length < 3) {
            insights.push(`Your net cashflow for this period is ${(totalIncome - totalSpent).toLocaleString()} SAR. Keep tracking to meet your goals!`);
          }
        }

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
        const totalBalance = transactions[0]?.amount || 12450.75; // current balance
        
        // Sum Hungerstation & Jahez spending in last 30 days
        const last30Days = new Date();
        last30Days.setDate(last30Days.getDate() - 30);
        
        const last30Txs = transactions.filter(t => new Date(t.transaction_date) >= last30Days);
        const foodDeliveryTotal = last30Txs
          .filter(t => t.category === "Food & Restaurants" && (t.merchant === "Hungerstation" || t.merchant === "Jahez"))
          .reduce((sum, t) => sum + t.amount, 0);

        // Check if there was any Transfer to savings recently (broken savings pattern)
        const recentSavings = last30Txs.filter(t => t.category === "Transfers" && t.merchant === "Alinma Savings Pot");
        const hasSavedRecently = recentSavings.length > 0;

        let content = "";
        
        if (isArabic) {
          content = `أهلاً بك يا أحمد. قمتُ بتحليل كامل لحسابك وعادات صرفك في الشهر الماضي، وإليك التشخيص المالي الدقيق لـ «معك» 🧐:

🚨 **العادة الأكثر استنزافاً:**
الصرف على تطبيقات توصيل الطعام (**هنجرستيشن وجاهز**) مرتفع جداً ووصل إلى **${foodDeliveryTotal} ريال** خلال الـ 30 يوماً الماضية! هذا يمثل حوالي **${Math.round((foodDeliveryTotal / 15000) * 100)}%** من دخل راتبك الإجمالي.

📉 **فجوة الادخار (تنبيه مهم):**
لاحظتُ أنك **توقفت تماماً عن تحويل الادخار المعتاد** (٢,٠٠٠ ريال شهرياً لحساب الادخار الإضافي) في شهري أبريل ومايو. الرصيد الحالي المتبقي هو **${transactions[0]?.amount || "12,450"} ريال**. إذا استمر هذا الصرف غير المنضبط، فقد تواجه نقصاً في تغطية دفعة السيارة القادمة في نهاية السنة.

📈 **توقعات نهاية الشهر:**
بناءً على وتيرة صرفك الحالية، من المتوقع أن يتبقى لك حوالي **٧٥٠ ريال** فقط كفائض قبل نزول الراتب القادم في ٢٧ يونيو، مما يجعلك قريباً من منطقة العجز المالي.

💡 **نصيحة الأسبوع العملية:**
«تحدي الـ ١٥٠ ريالاً»: ضع حدّاً أقصى لخدمات توصيل الطعام بقيمة **١٥٠ ريالاً كلياً للأسبوع القادم**. قم بطهي وجباتك بالمنزل، وستلاحظ توفير أكثر من **٧٠٠ ريال** بنهاية الشهر كدفعة لادخارك المتوقف!`;
        } else {
          content = `Hello Ahmed. I did a thorough audit of your finances and recent spending patterns, here is your financial checkup 🧐:

🚨 **Primary Leak (Food Delivery Spike):**
Your spending on **Hungerstation & Jahez** is exceptionally high, totaling **${foodDeliveryTotal} SAR** over the last 30 days! This accounts for nearly **${Math.round((foodDeliveryTotal / 15000) * 100)}%** of your monthly income.

📉 **Savings Alert (Broken Trend):**
My records show that **you stopped your usual monthly savings transfer of 2,000 SAR** in April and May. Your current balance is **${transactions[0]?.amount || "12,450"} SAR**. Keeping this trajectory active might stall your Car Down Payment goal scheduled for December.

📈 **Balance Trajectory:**
Based on current velocity, you are projected to finish this monthly cycle with just **750 SAR** in cash buffer before your next salary on June 27th. This puts you very close to the red line.

💡 **Actionable Weekly Tip:**
"The 150 SAR Food Challenge": Limit your delivery orders to a total of **150 SAR for the upcoming week**. Meal-prep at home and you will instantly redirect over **700 SAR** back to your broken savings pot!`;
        }

        return NextResponse.json({
          type: "text",
          content
        });
      }

      // ============================================================================
      // CAPABILITY 3: DECISION SIMULATION
      // ============================================================================
      if (isSimulationQuery) {
        // Parse purchase request (iPhone, car, loan)
        let decisionType = isArabic ? "شراء سيارة بقسط ٢,٠٠٠ ريال" : "Buying a car in installments (2,000 SAR/mo)";
        let amount = 120000;
        let monthlyCost = 2000;

        if (queryLower.includes("iphone") || queryLower.includes("أيفون") || queryLower.includes("ايفون") || queryLower.includes("5000")) {
          decisionType = isArabic ? "شراء آيفون جديد بقسط ٤٥٠ ريال" : "Buying an iPhone in installments (450 SAR/mo)";
          amount = 5000;
          monthlyCost = 450;
        } else if (queryLower.includes("loan") || queryLower.includes("قرض") || queryLower.includes("50000")) {
          decisionType = isArabic ? "أخذ قرض شخصي بقيمة ٥٠,٠٠٠ ريال بقسط ١,٢٠٠ ريال" : "Taking a 50,000 SAR loan (1,200 SAR/mo)";
          amount = 50000;
          monthlyCost = 1200;
        }

        // Current user context
        const currentBalance = transactions[0]?.amount || 12450.75;
        const baseMonthlySavings = 3000; // salary 15k - avg fixed costs (rent 2.5k + bills 1k + living 8.5k)

        // Scenario A: Do it now
        // Directly impacts cashflow
        const impactNow = -monthlyCost;
        const balance12mNow = currentBalance + (12 * baseMonthlySavings) - (12 * monthlyCost) - (amount * 0.1); // down payment assumed 10%
        const verdictNow = isArabic 
          ? "مخاطرة عالية! ستواجه عجزاً في تدفقك النقدي وسيتعطل هدف السيارة تماماً." 
          : "High risk! Will cause immediate cash flow strains and break your car savings goal.";

        // Scenario B: Wait 6 months
        // Save for 6 months, then start
        const impactWait = -monthlyCost; // only starts after 6m
        const balance12mWait = currentBalance + (12 * baseMonthlySavings) - (6 * monthlyCost); // only 6 installments paid
        const verdictWait = isArabic
          ? "موصى به بشدة! يمنحك مهلة ٦ أشهر لبناء احتياطي طوارئ وتخفيف الضغط."
          : "Highly recommended! Gives you a 6-month buffer to accumulate emergency reserves.";

        // Scenario C: Adjusted Terms (Larger down payment, longer tenure)
        const adjustedMonthlyCost = Math.round(monthlyCost * 0.6); // 40% lower monthly installment
        const adjustedDownPayment = amount * 0.25; // 25% down payment
        const balance12mAdjusted = currentBalance - adjustedDownPayment + (12 * baseMonthlySavings) - (12 * adjustedMonthlyCost);
        const verdictAdjusted = isArabic
          ? "مقبول ومستقر، بشرط خفض مصروفات المطاعم بنسبة ٣٠٪ لتعويض الدفعة الأولى."
          : "Stable and feasible, provided you trim food delivery by 30% to offset the down payment.";

        let recommendation = "";
        if (isArabic) {
          recommendation = `توصية «معك» النهائية 🌟:
أنصحك بـ **السيناريو ب (الانتظار لمدة ٦ أشهر)**. 

**السبب المالي:** 
بسبب توقف ادخارك في الشهرين الماضيين ووجود قفزة مصروفات سابقة في مكتبة جرير بقيمة ٣,٥٠٠ ريال، فإن اتخاذ التزام مالي بقيمة **${monthlyCost} ريال** شهرياً فوراً سيضعف شبكة الأمان المالي الخاصة بك تماماً ويهدد رصيدك المتاح. 

الانتظار لـ ٦ أشهر سيتيح لك استعادة خطة الادخار التراكمي وتنزيل قسطك الشهري بأمان تام دون الوقوع في أي عجز مالي!`;
        } else {
          recommendation = `Ma3ak's Final Recommendation 🌟:
I strongly recommend **Scenario B (Waiting for 6 Months)**. 

**Financial Rationale:**
Due to your recent saving breakdown in April/May and your prior large impulse purchase of 3,500 SAR at Jarir, taking on an immediate obligation of **${monthlyCost} SAR** per month will strain your cash buffer and delay your critical emergency reserves.

Waiting 6 months allows you to re-establish your 2,000 SAR monthly savings and ensures you can afford this decision comfortably without risking financial stress.`;
        }

        return NextResponse.json({
          type: "simulation",
          decision: decisionType,
          scenarios: [
            {
              name: isArabic ? "أ: البدء فوراً" : "A: Start Now",
              monthly_impact: impactNow,
              balance_in_12m: Math.round(balance12mNow),
              verdict: verdictNow
            },
            {
              name: isArabic ? "ب: الانتظار ٦ أشهر" : "B: Wait 6 Months",
              monthly_impact: 0, // no monthly impact for first 6 months
              balance_in_12m: Math.round(balance12mWait),
              verdict: verdictWait
            },
            {
              name: isArabic ? "ج: تعديل الشروط" : "C: Adjusted Terms",
              monthly_impact: -adjustedMonthlyCost,
              balance_in_12m: Math.round(balance12mAdjusted),
              verdict: verdictAdjusted
            }
          ],
          recommendation
        });
      }

      // Default plain text reply (e.g. conversational chit-chat)
      let textReply = "";
      if (isArabic) {
        textReply = `أهلاً بك يا أحمد. أنا معك، مستشارك المالي الذكي من مصرف الإنماء 🦊.

يمكنك أن تطلب مني:
١. **الحصول على تقارير الصرف:** مثل "اعطني تقريراً لـ ٧ أيام الماضية".
٢. **تحليل عاداتك المالية الحالية:** مثل "هل أصرف أكثر من اللازم؟".
٣. **محاكاة قراراتك المستقبلية:** مثل "أفكر في أخذ تمويل شخصي بقيمة ٥٠,٠٠٠ ريال، ما رأيك؟".

كيف يمكنني مساعدتك اليوم في تنمية وإدارة أموالك؟`;
      } else {
        textReply = `Hello Ahmed! I am Ma3ak, your Alinma Bank smart financial companion 🦊.

You can ask me to:
1. **Analyze your history (Smart Reports):** e.g., "Show me my spending from the last month".
2. **Review your present habits (Audit):** e.g., "Am I spending too much?".
3. **Simulate future decisions (Forecast):** e.g., "I want to buy a car for 120,000 SAR in installments, should I?".

How can I help you optimize and grow your wealth today?`;
      }

      return NextResponse.json({
        type: "text",
        content: textReply
      });
    }

    // ============================================================================
    // REAL OPENAI API MODE
    // ============================================================================
    const apiKey = process.env.OPENAI_API_KEY;
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
You are Ma3ak (معك), a personal financial advisor for Alinma Bank customers. You are warm, smart, concise, and culturally aware (Saudi context). You speak in the user's selected language (Arabic or English).

You have access to the user's transaction data. Always base your answers on real data, never fabricate numbers.

Below is the user's recent transaction history:
${txSummary}

You can do three things:
1. Generate financial reports for any time period (min 7 days)
2. Analyze current spending habits and give actionable tips
3. Simulate future financial decisions with 3 scenarios

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
  "scenarios": [
    {"name": "Now", "monthly_impact": ..., "balance_in_12m": ..., "verdict": "..."},
    {"name": "Wait 6 months", "monthly_impact": ..., "balance_in_12m": ..., "verdict": "..."},
    {"name": "Adjusted terms", "monthly_impact": ..., "balance_in_12m": ..., "verdict": "..."}
  ],
  "recommendation": "..."
}

Otherwise, return a JSON object with this structure:
{"type": "text", "content": "..."}

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
