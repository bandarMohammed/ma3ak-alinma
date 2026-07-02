import OpenAI from "openai";
import { ExtractedIntent } from "./types";

/**
 * Uses gpt-4o-mini to parse a customer's free-text message (often written in Saudi
 * colloquial Arabic / عامية) into a structured decision-simulation intent. The numeric
 * outputs are then handed to the deterministic SimulatorManager, so the LLM only handles
 * language understanding — never the financial math.
 *
 * Returns null on any failure so the caller can fall back to keyword matching.
 */
export async function extractSimulationIntent(
  openai: OpenAI,
  message: string,
  language: "ar" | "en"
): Promise<ExtractedIntent | null> {
  const systemPrompt = `You parse a bank customer's message into a financial DECISION-SIMULATION intent. The customer often writes in Saudi colloquial Arabic (عامية).

Return ONLY a JSON object with this exact shape (no prose, no markdown):
{
  "isSimulation": boolean,
  "financingType": "cash" | "financing",
  "category": "car" | "phone" | "laptop" | "travel" | "wedding" | "renovation" | "tuition" | "medical" | "business" | "loan" | "generic",
  "amount": number | null,
  "tenureMonths": number | null,
  "downPayment": number | null,
  "installment": number | null
}

Rules:
- isSimulation = true ONLY if the user wants to evaluate, afford, plan, buy, finance, or borrow for a future expense/purchase/loan/travel/wedding/etc. Set false for greetings, reports, spending-history questions, or habit analysis.
- financingType = "financing" if a loan / installments / تمويل / تقسيط / قسط / أقساط / رهن is implied; otherwise "cash".
- category = best match. Use "loan" for a pure cash loan/borrowing with no specific asset; "generic" if unclear.
- amount = the total price or financing amount as a plain number in SAR. Convert words: "ألف"/"الف"/"k" = ×1000, "مليون" = ×1,000,000 (e.g. "مليون ونص" = 1500000, "120 ألف" = 120000, "٥٠ الف" = 50000). Strip commas. null if not stated.
- tenureMonths = repayment/period in months ("سنة"/"سنوات" ×12). null if not stated.
- downPayment / installment = only if the user explicitly states them; else null.
- Understand dialect phrasings such as: "ودّي/ابغى/أبي أشتري", "بكم", "كم يطلع علي", "تكفى احسبها لي", "بقسّطها", "أغيّر سيارتي", "ناوي أسافر", "ودي أتزوج", "أفكر آخذ قرض".`;

  try {
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message }
      ]
    });

    const raw = res.choices[0]?.message?.content || "{}";
    const p = JSON.parse(raw);

    const numOrNull = (v: any): number | null => {
      const n = typeof v === "string" ? parseFloat(v.replace(/,/g, "")) : v;
      return typeof n === "number" && isFinite(n) && n > 0 ? n : null;
    };

    const allowed = new Set([
      "car", "phone", "laptop", "travel", "wedding",
      "renovation", "tuition", "medical", "business", "loan", "generic"
    ]);

    return {
      isSimulation: !!p.isSimulation,
      financingType: p.financingType === "financing" ? "financing" : "cash",
      category: allowed.has(p.category) ? p.category : "generic",
      amount: numOrNull(p.amount),
      tenureMonths: numOrNull(p.tenureMonths),
      downPayment: numOrNull(p.downPayment),
      installment: numOrNull(p.installment)
    };
  } catch (err: any) {
    // Surface the reason (e.g. 401 invalid key, 429 quota/billing) so the fallback
    // to deterministic mode is diagnosable instead of silent.
    console.error("extractSimulationIntent failed:", err?.status || "", err?.message || err);
    return null;
  }
}
