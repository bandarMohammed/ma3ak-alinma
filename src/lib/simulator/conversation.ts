import { Transaction } from "../data/types";
import { ExtractedIntent, PendingSim, SimulationResult, SimulationSlot } from "./types";
import { SimulatorManager } from "./manager";

export type ConversationResult =
  | SimulationResult
  | { type: "text"; content: string; pendingSim?: PendingSim | null };

// ============================================================================
// Text / number parsing helpers (offline; the LLM upgrade only seeds the start)
// ============================================================================

function arabicToLatin(text: string): string {
  return text.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
}

/** Extracts the largest SAR amount from free text; understands ألف / k / مليون. */
export function parseAmount(text: string): number | null {
  let s = arabicToLatin(text).toLowerCase();
  // NOTE: no \b after Arabic unit words — Arabic letters aren't ASCII word chars,
  // so \b never matches after them and the multiplier would silently be skipped.
  s = s.replace(/(\d+(?:\.\d+)?)\s*(مليون|million)/gi, (_m, v) => String(parseFloat(v) * 1_000_000));
  s = s.replace(/(\d+(?:\.\d+)?)\s*(ألف|الف|آلاف|ألاف)/gi, (_m, v) => String(parseFloat(v) * 1000));
  s = s.replace(/(\d+(?:\.\d+)?)\s*k\b/gi, (_m, v) => String(parseFloat(v) * 1000));
  const matches = s.match(/\d+(?:[,،]\d{3})*(?:\.\d+)?/g);
  if (!matches) return null;
  const nums = matches.map((n) => parseFloat(n.replace(/[,،]/g, ""))).filter((n) => isFinite(n));
  return nums.length ? Math.max(...nums) : null;
}

/** Detects an explicit "none / zero" answer (for optional money slots). */
function isNoneAnswer(text: string): boolean {
  return /(^|\s)(لا|ما\s?في|مافي|مافيه|بدون|صفر|ما\s?عندي|no|none|zero)(\s|$|\.)/i.test(text.trim());
}

/** cash vs financing from a free-text answer. Returns null if unclear. */
export function parseFinancingType(text: string): "cash" | "financing" | null {
  const s = text.toLowerCase();
  if (/قرض|قروض|تمويل|قسط|أقساط|اقساط|تقسيط|بالتقسيط|أقسّط|اقسّط|رهن|مرابحة|loan|financ|installment|monthly/i.test(s)) {
    return "financing";
  }
  if (/نقد|كاش|كامل|مرة\s?و?حدة|مره\s?و?حده|دفعة\s?و?حدة|cash|أدفعه|ادفعه|دفع\s?مباشر|مبلغ/i.test(s)) {
    return "cash";
  }
  return null;
}

/** Repayment / horizon period → months. */
export function parseTenureMonths(text: string): number | null {
  const s = arabicToLatin(text).toLowerCase();
  const yr = s.match(/(\d+)\s*(سنوات|سنة|سنين|عام|أعوام|year|yr)/);
  if (yr) return parseInt(yr[1], 10) * 12;
  const mo = s.match(/(\d+)\s*(أشهر|اشهر|شهور|شهر|month)/);
  if (mo) return parseInt(mo[1], 10);
  if (/سنتين|عامين/.test(s)) return 24;
  if (/نص\s*سنة/.test(s)) return 6;
  if (/سنة|عام\b|year/.test(s)) return 12;
  const bare = s.match(/\d+/);
  if (bare) {
    const n = parseInt(bare[0], 10);
    if (n > 0 && n <= 7) return n * 12; // small bare number ⇒ years
    if (n >= 6 && n <= 360) return n;   // otherwise months
  }
  return null;
}

/** Best-effort category detection for nicer decision labels. */
function detectCategory(text: string): ExtractedIntent["category"] {
  const s = text.toLowerCase();
  if (/سيارة|سياره|car|مركبة/.test(s)) return "car";
  if (/جوال|آيفون|ايفون|iphone|phone|هاتف/.test(s)) return "phone";
  if (/لابتوب|كمبيوتر|laptop|computer/.test(s)) return "laptop";
  if (/سفر|سياحة|رحلة|travel|trip|vacation/.test(s)) return "travel";
  if (/زواج|عرس|wedding|marry/.test(s)) return "wedding";
  if (/ترميم|تجديد|renovat/.test(s)) return "renovation";
  if (/دراسة|جامعة|رسوم|tuition|university|college/.test(s)) return "tuition";
  if (/علاج|طبي|صحي|medical|treatment/.test(s)) return "medical";
  if (/مشروع|تجارة|business|project/.test(s)) return "business";
  if (/قرض|تمويل|loan/.test(s)) return "loan";
  return "generic";
}

// ============================================================================
// Question copy (AR / EN)
// ============================================================================

function questionFor(slot: SimulationSlot, isRtl: boolean): string {
  const q: Record<SimulationSlot, [string, string]> = {
    financingType: [
      "لأقدّم لك استشارة دقيقة، هل هذا القرار **تمويل/أقساط** أم **مبلغ نقدي (كاش)** تدفعه دفعة واحدة؟",
      "To advise you accurately, is this decision a **loan/installment** or a **one-time cash** payment?"
    ],
    amount: [
      "تمام. كم **المبلغ الإجمالي** التقديري بالريال؟",
      "Understood. What is the estimated **total amount** in SAR?"
    ],
    installment: [
      "كم القسط الشهري؟",
      "How much is the monthly installment?"
    ],
    downPayment: [
      "كم ممكن الدفعه الاوله اذا مافي قول لا؟",
      "How much is the down payment? If there is none, say no."
    ],
    finalPayment: [
      "هل في دفعه اخيره اذا لا اكتب لا ؟",
      "Is there a final payment? If there is none, write no."
    ],
    tenure: [
      "كم مدت القسط بالشهور ؟",
      "What is the installment period in months?"
    ]
  };
  const [ar, en] = q[slot];
  return isRtl ? ar : en;
}

// ============================================================================
// Slot machine
// ============================================================================

type Collected = PendingSim["collected"];

/** Returns the next unanswered slot, or null when everything is collected. */
function nextMissingSlot(c: Collected): SimulationSlot | null {
  if (c.amount === undefined) return "amount";
  if (c.financingType === undefined) return "financingType";
  if (c.financingType === "financing") {
    if (c.downPayment === undefined) return "downPayment";
    if (c.installment === undefined) return "installment";
    if (c.tenureMonths === undefined) return "tenure";
    if (c.finalPayment === undefined) return "finalPayment";
  }
  return null;
}

/** Applies the customer's latest message as the answer to the awaited slot. */
function applyAnswer(c: Collected, awaiting: SimulationSlot, userText: string): Collected {
  const next = { ...c };
  switch (awaiting) {
    case "financingType": {
      const t = parseFinancingType(userText);
      if (t) next.financingType = t;
      break;
    }
    case "amount": {
      const n = parseAmount(userText);
      if (n) next.amount = n;
      break;
    }
    case "installment": {
      const n = parseAmount(userText);
      if (n) next.installment = n;
      break;
    }
    case "downPayment": {
      if (isNoneAnswer(userText)) next.downPayment = 0;
      else {
        const n = parseAmount(userText);
        next.downPayment = n ?? 0;
      }
      break;
    }
    case "finalPayment": {
      if (isNoneAnswer(userText)) next.finalPayment = 0;
      else {
        const n = parseAmount(userText);
        next.finalPayment = n ?? 0;
      }
      break;
    }
    case "tenure": {
      const m = parseTenureMonths(userText);
      if (m) next.tenureMonths = m;
      break;
    }
  }
  return next;
}

/** Seeds collected slots from an LLM-parsed intent (Hybrid start). */
function fromIntent(seed: ExtractedIntent): Collected {
  const c: Collected = {};
  if (seed.financingType) c.financingType = seed.financingType;
  if (seed.category) c.category = seed.category;
  if (seed.amount != null) c.amount = seed.amount;
  if (seed.installment != null) c.installment = seed.installment;
  if (seed.downPayment != null) c.downPayment = seed.downPayment;
  if (seed.tenureMonths != null) c.tenureMonths = seed.tenureMonths;
  if (seed.finalPayment != null) c.finalPayment = seed.finalPayment;
  return c;
}

/** Offline: pull whatever the customer already stated in their opening message. */
function parseInitial(text: string): Collected {
  const c: Collected = {};
  const type = parseFinancingType(text);
  if (type) c.financingType = type;
  const amount = parseAmount(text);
  if (amount) c.amount = amount;
  c.category = detectCategory(text);
  return c;
}

/** Finds the most recent assistant message still awaiting a slot answer. */
export function findPendingSim(messages: any[]): PendingSim | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m?.role === "assistant") {
      const p = m?.metadata?.pendingSim;
      return p && p.awaiting ? (p as PendingSim) : null;
    }
  }
  return null;
}

// ============================================================================
// Entry point
// ============================================================================

export function runSimulationConversation(
  messages: any[],
  transactions: Transaction[],
  language: "ar" | "en",
  seed?: ExtractedIntent | null,
  balance?: number
): ConversationResult {
  const isRtl = language === "ar";
  const userText = messages[messages.length - 1]?.content || "";
  const pending = findPendingSim(messages);

  // 1. Build / advance collected state
  let collected: Collected;
  if (pending) {
    collected = applyAnswer(pending.collected, pending.awaiting, userText);
    // If parsing failed to fill the awaited slot, re-ask the same question.
    if (nextMissingSlot(collected) === pending.awaiting && collected[slotKey(pending.awaiting)] === undefined) {
      return {
        type: "text",
        content: reaskPrefix(isRtl) + questionFor(pending.awaiting, isRtl),
        pendingSim: pending
      };
    }
  } else {
    collected = seed ? fromIntent(seed) : parseInitial(userText);
  }

  // 2. Ask for the next missing slot, or finalize
  const missing = nextMissingSlot(collected);
  if (missing) {
    const content = questionFor(missing, isRtl);
    return { type: "text", content, pendingSim: { awaiting: missing, collected } };
  }

  // 3. Complete → deterministic simulation with the ACTUAL provided values
  // Horizon/tenure for cash: exactly 6 months
  // Horizon/tenure for financing: tenureMonths
  const finalTenure = collected.financingType === "cash" ? 6 : (collected.tenureMonths ?? 60);

  const intent: ExtractedIntent = {
    isSimulation: true,
    financingType: collected.financingType!,
    category: collected.category ?? "generic",
    amount: collected.amount ?? null,
    tenureMonths: finalTenure,
    downPayment: collected.financingType === "cash" ? (collected.amount ?? null) : (collected.downPayment ?? 0),
    installment: collected.financingType === "cash" ? 0 : (collected.installment ?? 0),
    finalPayment: collected.financingType === "cash" ? 0 : (collected.finalPayment ?? 0)
  };
  return SimulatorManager.simulateFromParams(intent, transactions, language, balance) as ConversationResult;
}

function slotKey(slot: SimulationSlot): keyof Collected {
  switch (slot) {
    case "tenure": return "tenureMonths";
    case "financingType": return "financingType";
    default: return slot as keyof Collected;
  }
}

function reaskPrefix(isRtl: boolean): string {
  return isRtl ? "لم أتمكن من فهم الإجابة بوضوح. " : "I couldn't read that clearly. ";
}

