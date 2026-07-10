import { UserContext, SimulationResult, ExtractedIntent } from "./types";
import { PurchaseSimulator } from "./modules/purchase";
import { LoanSimulator } from "./modules/loan";
import { Transaction } from "../data/types";
import { buildFinancialProfile } from "../finance/calculations";

export type SimulationOrTextResult = SimulationResult | { type: "text"; content: string };

export class SimulatorManager {
  /**
   * Builds the financial profile (income, avg outflow, real savings balance, financing) used by
   * the simulators. Delegates to the single-source-of-truth calculations module — no math here.
   * `balance` is the real account balance (sent from the client); falls back safely if absent.
   */
  public static calculateUserContext(transactions: Transaction[], balance?: number): UserContext {
    return buildFinancialProfile(transactions, balance);
  }

  /**
   * Cleans text to standard numbers, resolving Arabic digits and word suffixes like "k" or "ألف"
   */
  private static cleanAndExtractNumbers(query: string): number[] {
    // 1. Convert eastern Arabic digits to standard digits
    let cleaned = query.replace(/[٠-٩]/g, (d) => {
      return String("٠١٢٣٤٥٦٧٨٩".indexOf(d));
    });

    // 2. Expand words denoting thousands like "ألف" or "الف" or "k"
    // e.g. "50 الف" or "120 ألف" or "15k"
    cleaned = cleaned.replace(/(\d+(?:\.\d+)?)\s*(ألف|الف|k|K|ألاف|آلاف)/g, (_, val) => {
      return String(parseFloat(val) * 1000);
    });

    // 3. Match all decimal or integer numbers
    const matches = cleaned.match(/\d+(?:[,.]\d+)?/g);
    if (!matches) return [];

    return matches.map(n => parseFloat(n.replace(/,/g, "")));
  }

  /**
   * Run decision simulation based on user message and transaction history
   */
  public static simulate(
    query: string,
    transactions: Transaction[],
    language: "ar" | "en",
    balance?: number
  ): SimulationOrTextResult {
    const queryLower = query.toLowerCase();
    const isRtl = language === "ar";

    // 1. Calculate user context from transactions (real balance when provided)
    const context = this.calculateUserContext(transactions, balance);

    // 2. Classify intent: Category 2 (Financing/Loans/Installments) vs Category 1 (One-Time Purchase)
    const isFinancingQuery = 
      queryLower.includes("loan") || 
      queryLower.includes("financing") || 
      queryLower.includes("finance") || 
      queryLower.includes("installment") || 
      queryLower.includes("installments") || 
      queryLower.includes("monthly payment") || 
      queryLower.includes("lease") || 
      queryLower.includes("leasing") || 
      queryLower.includes("mortgage") || 
      queryLower.includes("borrow") || 
      queryLower.includes("قرض") || 
      queryLower.includes("قروض") || 
      queryLower.includes("تمويل") || 
      queryLower.includes("أقساط") || 
      queryLower.includes("اقساط") || 
      queryLower.includes("قسط") || 
      queryLower.includes("بقسط") || 
      queryLower.includes("تمويل شخصي") || 
      queryLower.includes("تأجير") || 
      queryLower.includes("مرابحة") || 
      queryLower.includes("رهن") || 
      queryLower.includes("بمول") || 
      queryLower.includes("تمويل عقاري") || 
      queryLower.includes("بقسطها");

    // Extract all numbers
    const numbers = this.cleanAndExtractNumbers(queryLower);

    // ============================================================================
    // FLOW 2: FINANCING / LOANS / INSTALLMENTS
    // ============================================================================
    if (isFinancingQuery) {
      // We need a total amount/price to run a simulation
      if (numbers.length === 0) {
        return {
          type: "text",
          content: isRtl 
            ? "وفقاً لبياناتك الجارية، يسعدني محاكاة خيار التمويل/التقسيط هذا لك. ليتسنى لي تقييم الأثر المالي بدقة، يُرجى تزويدي بمبلغ التمويل المطلوب أو سعر السلعة، ومدة السداد المفضلة (مثال: تمويل بقيمة 50,000 ريال على 5 سنوات)."
            : "According to your financial data, I would be pleased to simulate this financing option for you. To evaluate the budget impact accurately, please specify the financing amount or purchase price, and your preferred repayment period (e.g., 50,000 SAR over 5 years)."
        };
      }

      // Largest number is assumed to be the total financing amount
      const amount = Math.max(...numbers);
      
      // Look for tenure/period in query (e.g. 60 months, 5 years, 3 years, 12 months)
      let tenure = 60; // default for loans/cars
      let tenureDetected = false;

      // Extract tenure patterns (e.g. "5 years", "5 سنين", "٥ سنوات", "36 شهر")
      const yearMatch = queryLower.match(/(\d+)\s*(سنوات|سنة|سنين|years|year|سنة)/);
      const monthMatch = queryLower.match(/(\d+)\s*(أشهر|شهر|months|month|شهور)/);

      if (yearMatch) {
        const parsedYears = parseInt(yearMatch[1]);
        if (parsedYears > 0 && parsedYears <= 30) {
          tenure = parsedYears * 12;
          tenureDetected = true;
        }
      } else if (monthMatch) {
        const parsedMonths = parseInt(monthMatch[1]);
        if (parsedMonths >= 6 && parsedMonths <= 360) {
          tenure = parsedMonths;
          tenureDetected = true;
        }
      }

      // Check if we have a second number that might represent tenure/installment
      const otherNumbers = numbers.filter(n => n !== amount);
      let installmentVal = 0;
      let downPaymentVal = 0;

      // Look for explicit installment/downpayment words
      const installmentMatch = queryLower.match(/(قسط|installment|monthly|payment|بقسط)\s*(\d+)/i);
      if (installmentMatch) {
        installmentVal = parseFloat(installmentMatch[2]);
      }

      const downPaymentMatch = queryLower.match(/(دفعة|دفعه|down|payment)\s*(\d+)/i);
      if (downPaymentMatch) {
        downPaymentVal = parseFloat(downPaymentMatch[2]);
      }

      // If they weren't explicitly matched but we have other numbers, assign them logically
      if (otherNumbers.length > 0) {
        if (!tenureDetected) {
          // If a small number is between 6 and 84, it's probably tenure
          const possibleTenure = otherNumbers.find(n => n >= 6 && n <= 84);
          if (possibleTenure) {
            tenure = possibleTenure;
            // remove from otherNumbers list
            const index = otherNumbers.indexOf(possibleTenure);
            if (index > -1) otherNumbers.splice(index, 1);
          }
        }

        // If there are still numbers, the next largest is down payment (if > 1000) or installment
        if (otherNumbers.length > 0) {
          const nextVal = otherNumbers[0];
          if (nextVal > 1000 && downPaymentVal === 0) {
            downPaymentVal = nextVal;
          } else if (installmentVal === 0) {
            installmentVal = nextVal;
          }
        }
      }

      // Determine product name or category
      let isAssetFinancing = 
        queryLower.includes("سيارة") || 
        queryLower.includes("سياره") || 
        queryLower.includes("جوال") || 
        queryLower.includes("آيفون") || 
        queryLower.includes("ايفون") || 
        queryLower.includes("لابتوب") || 
        queryLower.includes("أجهزة") || 
        queryLower.includes("شراء") || 
        queryLower.includes("سلعة") ||
        queryLower.includes("car") || 
        queryLower.includes("iphone") || 
        queryLower.includes("phone") || 
        queryLower.includes("laptop") || 
        queryLower.includes("appliance") || 
        queryLower.includes("furniture");

      if (isAssetFinancing) {
        // Run financed purchase simulation
        let decisionName = isRtl ? "شراء أصول بالتقسيط" : "Financed Purchase";
        if (queryLower.includes("سيارة") || queryLower.includes("سياره") || queryLower.includes("car")) {
          decisionName = isRtl ? "تقسيط سيارة" : "Financed Car Purchase";
        } else if (queryLower.includes("جوال") || queryLower.includes("آيفون") || queryLower.includes("ايفون") || queryLower.includes("iphone") || queryLower.includes("phone")) {
          decisionName = isRtl ? "تقسيط جوال" : "Financed Phone Purchase";
          if (!tenureDetected) tenure = 12; // default to 1 year for phones
        }

        // If installment is not provided, calculate installment with 4% simple APR
        if (installmentVal === 0) {
          const apr = 0.04;
          const totalInterest = amount * apr * (tenure / 12);
          installmentVal = Math.round((amount - downPaymentVal + totalInterest) / tenure);
        }

        const simulator = new PurchaseSimulator(language, "generic");
        return simulator.calculate(context, {
          price: amount,
          tenure: tenure,
          installment: installmentVal,
          downPayment: downPaymentVal,
          decisionName: decisionName,
          projectionMonths: tenure
        });
      } else {
        // Run personal loan cash simulation
        // If installment is not provided, calculate installment with 4% simple APR
        if (installmentVal === 0) {
          const apr = 0.04;
          const totalProfit = amount * apr * (tenure / 12);
          installmentVal = Math.round((amount + totalProfit) / tenure);
        }

        const simulator = new LoanSimulator(language);
        return simulator.calculate(context, {
          amount: amount,
          tenure: tenure,
          installment: installmentVal,
          projectionMonths: tenure
        });
      }
    }

    // ============================================================================
    // FLOW 1: ONE-TIME PURCHASE / EXPENSE
    // ============================================================================
    // If no cost/price numbers are in the message, ask for it
    if (numbers.length === 0) {
      return {
        type: "text",
        content: isRtl 
          ? "وفقاً لبياناتك الجارية، يسعدني إجراء محاكاة لقرار الإنفاق هذا. ليتسنى لمستشارك المالي تقييم الأثر المالي بدقة، يُرجى تزويدنا بالتكلفة الإجمالية التقديرية (مثال: بـ 15,000 ريال) وتاريخ الشراء المتوقع."
          : "According to your available financial data, I would be pleased to simulate this expense for you. To evaluate the budget impact accurately, please specify the estimated total cost (e.g., 15,000 SAR) and the expected purchase date."
      };
    }

    const price = Math.max(...numbers);

    // Determine the type of purchase to customize decision name
    let decisionName = isRtl ? "قرار إنفاق" : "Expense Decision";
    let defaultTenure = 12;

    if (queryLower.includes("travel") || queryLower.includes("trip") || queryLower.includes("vacation") || queryLower.includes("سفر") || queryLower.includes("سياحة") || queryLower.includes("بسافر")) {
      decisionName = isRtl ? "سفر وسياحة" : "Travel & Vacation";
      defaultTenure = 6; // shorter horizon for travel
    } else if (queryLower.includes("wedding") || queryLower.includes("marry") || queryLower.includes("زواج") || queryLower.includes("عرس") || queryLower.includes("أتزوج")) {
      decisionName = isRtl ? "مصاريف زواج" : "Wedding Expenses";
      defaultTenure = 24;
    } else if (queryLower.includes("renovat") || queryLower.includes("house") || queryLower.includes("home") || queryLower.includes("ترميم") || queryLower.includes("تجديد") || queryLower.includes("أرمم")) {
      decisionName = isRtl ? "ترميم المنزل" : "Home Renovation";
      defaultTenure = 36;
    } else if (queryLower.includes("fees") || queryLower.includes("tuition") || queryLower.includes("college") || queryLower.includes("university") || queryLower.includes("دراسة") || queryLower.includes("جامعة") || queryLower.includes("أدرس")) {
      decisionName = isRtl ? "رسوم دراسية" : "Tuition Fees";
      defaultTenure = 12;
    } else if (queryLower.includes("medical") || queryLower.includes("treatment") || queryLower.includes("علاج") || queryLower.includes("صحي") || queryLower.includes("طبي")) {
      decisionName = isRtl ? "علاج طبي" : "Medical Expenses";
      defaultTenure = 6;
    } else if (queryLower.includes("business") || queryLower.includes("project") || queryLower.includes("مشروع") || queryLower.includes("تأسيس")) {
      decisionName = isRtl ? "تأسيس مشروع" : "Business Launch";
      defaultTenure = 36;
    } else if (queryLower.includes("car") || queryLower.includes("سيارة") || queryLower.includes("سياره") || queryLower.includes("بشتري سيارة")) {
      decisionName = isRtl ? "شراء سيارة نقداً" : "Car Cash Purchase";
      defaultTenure = 60;
    } else if (queryLower.includes("iphone") || queryLower.includes("phone") || queryLower.includes("جوال") || queryLower.includes("آيفون") || queryLower.includes("ايفون")) {
      decisionName = isRtl ? "شراء جوال نقداً" : "Phone Cash Purchase";
      defaultTenure = 12;
    } else if (queryLower.includes("laptop") || queryLower.includes("computer") || queryLower.includes("لابتوب") || queryLower.includes("كمبيوتر")) {
      decisionName = isRtl ? "شراء لابتوب نقداً" : "Laptop Cash Purchase";
      defaultTenure = 12;
    }

    // Since it's a cash purchase:
    // 1. Downpayment = price (100% of price is paid upfront)
    // 2. Installment = 0 (no recurring payment)
    const simulator = new PurchaseSimulator(language, "generic");
    return simulator.calculate(context, {
      price: price,
      tenure: defaultTenure,
      installment: 0,
      downPayment: price,
      decisionName: decisionName,
      projectionMonths: defaultTenure
    });
  }

  /**
   * Per-category display names, default projection horizon, and whether the item is a
   * financeable asset (asset financing → PurchaseSimulator; otherwise cash loan → LoanSimulator).
   */
  private static CATEGORY_META: Record<string, {
    ar: string; en: string; arFin: string; enFin: string; tenure: number; asset: boolean;
  }> = {
    car:        { ar: "شراء سيارة نقداً", en: "Car Cash Purchase",   arFin: "تقسيط سيارة",   enFin: "Financed Car Purchase",    tenure: 60, asset: true },
    phone:      { ar: "شراء جوال نقداً",  en: "Phone Cash Purchase",  arFin: "تقسيط جوال",    enFin: "Financed Phone Purchase",  tenure: 12, asset: true },
    laptop:     { ar: "شراء لابتوب نقداً", en: "Laptop Cash Purchase", arFin: "تقسيط لابتوب",  enFin: "Financed Laptop Purchase", tenure: 12, asset: true },
    travel:     { ar: "سفر وسياحة",       en: "Travel & Vacation",    arFin: "سفر وسياحة",    enFin: "Travel & Vacation",        tenure: 6,  asset: false },
    wedding:    { ar: "مصاريف زواج",      en: "Wedding Expenses",     arFin: "مصاريف زواج",   enFin: "Wedding Expenses",         tenure: 24, asset: false },
    renovation: { ar: "ترميم المنزل",     en: "Home Renovation",      arFin: "ترميم المنزل",  enFin: "Home Renovation",          tenure: 36, asset: false },
    tuition:    { ar: "رسوم دراسية",      en: "Tuition Fees",         arFin: "رسوم دراسية",   enFin: "Tuition Fees",             tenure: 12, asset: false },
    medical:    { ar: "علاج طبي",         en: "Medical Expenses",     arFin: "علاج طبي",      enFin: "Medical Expenses",         tenure: 6,  asset: false },
    business:   { ar: "تأسيس مشروع",      en: "Business Launch",      arFin: "تمويل مشروع",   enFin: "Business Financing",       tenure: 36, asset: false },
    loan:       { ar: "تمويل شخصي",       en: "Personal Loan",        arFin: "تمويل شخصي",    enFin: "Personal Loan",            tenure: 60, asset: false },
    generic:    { ar: "قرار إنفاق",       en: "Expense Decision",     arFin: "شراء بالتقسيط", enFin: "Financed Purchase",        tenure: 12, asset: true }
  };

  /**
   * Runs a simulation from a pre-parsed LLM intent (Hybrid path). Language understanding is
   * done by the LLM; all financial math stays here in the deterministic simulators.
   */
  public static simulateFromParams(
    intent: ExtractedIntent,
    transactions: Transaction[],
    language: "ar" | "en",
    balance?: number
  ): SimulationOrTextResult {
    const isRtl = language === "ar";
    const context = this.calculateUserContext(transactions, balance);
    const meta = this.CATEGORY_META[intent.category] || this.CATEGORY_META.generic;

    // Need a cost/amount to run any simulation
    if (!intent.amount || intent.amount <= 0) {
      return {
        type: "text",
        content: isRtl
          ? "وفقاً لبياناتك الجارية، يسعدني إجراء محاكاة لهذا القرار المالي. ليتسنى تقييم الأثر المالي بدقة، يُرجى تزويدنا بالتكلفة الإجمالية التقديرية (مثال: بـ 15,000 ريال)."
          : "According to your available financial data, I would be pleased to simulate this decision. To evaluate the budget impact accurately, please specify the estimated total cost (e.g., 15,000 SAR)."
      };
    }

    const amount = intent.amount;
    const isFinancing = intent.financingType === "financing" || intent.category === "loan";
    const apr = 0.04; // Alinma profit rate

    // Tenure: honor a valid explicit tenure, else category default
    let tenure = meta.tenure;
    if (intent.tenureMonths && intent.tenureMonths >= 6 && intent.tenureMonths <= 360) {
      tenure = Math.round(intent.tenureMonths);
    }

    // FINANCING — ASSET (car / phone / laptop / generic asset) → PurchaseSimulator
    if (isFinancing && meta.asset) {
      const downPayment = intent.downPayment && intent.downPayment > 0 ? intent.downPayment : 0;
      let installment = intent.installment && intent.installment > 0 ? intent.installment : 0;
      if (installment === 0) {
        const totalInterest = amount * apr * (tenure / 12);
        installment = Math.round((amount - downPayment + totalInterest) / tenure);
      }
      const simulator = new PurchaseSimulator(language, "generic");
      return simulator.calculate(context, {
        price: amount,
        tenure,
        installment,
        downPayment,
        finalPayment: intent.finalPayment ?? 0,
        decisionName: isRtl ? meta.arFin : meta.enFin,
        projectionMonths: tenure
      });
    }

    // FINANCING — NON-ASSET (loan, travel, wedding, ...) → cash LoanSimulator
    if (isFinancing && !meta.asset) {
      let installment = intent.installment && intent.installment > 0 ? intent.installment : 0;
      if (installment === 0) {
        const totalProfit = amount * apr * (tenure / 12);
        installment = Math.round((amount + totalProfit) / tenure);
      }
      const simulator = new LoanSimulator(language);
      return simulator.calculate(context, { amount, tenure, installment, projectionMonths: tenure });
    }

    // CASH — one-time purchase/expense paid upfront
    const simulator = new PurchaseSimulator(language, "generic");
    return simulator.calculate(context, {
      price: amount,
      tenure,
      installment: 0,
      downPayment: amount,
      decisionName: isRtl ? meta.ar : meta.en,
      projectionMonths: tenure
    });
  }
}
