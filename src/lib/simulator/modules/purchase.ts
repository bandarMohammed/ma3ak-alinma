import { BaseSimulator } from "./base";
import { UserContext, SimulationResult, Scenario, SmartInsight, MetricRow, SensitivityMetric } from "../types";
import { 
  calculateDTI, 
  calculateEmergencyFundMonths, 
  calculateSavingsReduction, 
  runSensitivityAnalysis, 
  determineRiskLevel, 
  calculateDecisionScore 
} from "../utils";

export interface ProductConfig {
  key: string;
  nameAr: string;
  nameEn: string;
  defaultPrice: number;
  defaultInstallment: number;
  defaultTenure: number;
  defaultDownPaymentPercent: number;
  projectionMonths: number;
}

export const PRODUCTS: Record<string, ProductConfig> = {
  car: {
    key: "car",
    nameAr: "شراء سيارة",
    nameEn: "Car Purchase",
    defaultPrice: 120000,
    defaultInstallment: 2000,
    defaultTenure: 60,
    defaultDownPaymentPercent: 0.10,
    projectionMonths: 60 // 5 years
  },
  iphone: {
    key: "iphone",
    nameAr: "شراء آيفون",
    nameEn: "iPhone Purchase",
    defaultPrice: 5000,
    defaultInstallment: 450,
    defaultTenure: 12,
    defaultDownPaymentPercent: 0.10,
    projectionMonths: 12 // 1 year
  },
  laptop: {
    key: "laptop",
    nameAr: "شراء لابتوب",
    nameEn: "Laptop Purchase",
    defaultPrice: 7000,
    defaultInstallment: 600,
    defaultTenure: 12,
    defaultDownPaymentPercent: 0.10,
    projectionMonths: 12 // 1 year
  },
  generic: {
    key: "generic",
    nameAr: "شراء أصول",
    nameEn: "Asset Purchase",
    defaultPrice: 15000,
    defaultInstallment: 1000,
    defaultTenure: 24,
    defaultDownPaymentPercent: 0.10,
    projectionMonths: 24 // 2 years
  }
};

export class PurchaseSimulator extends BaseSimulator {
  private config: ProductConfig;

  constructor(language: "ar" | "en", productKey: string = "generic") {
    super(language);
    this.config = PRODUCTS[productKey] || PRODUCTS.generic;
  }

  calculate(context: UserContext, params: any): SimulationResult {
    const price = params.price || this.config.defaultPrice;
    const tenure = params.tenure || this.config.defaultTenure;
    // Use !== undefined (not ||) so an explicit cash purchase (installment: 0) is respected
    // instead of falling back to the phantom default installment.
    const installment = params.installment !== undefined ? params.installment : this.config.defaultInstallment;
    
    const isCash = installment === 0;
    const finalPayment = params.finalPayment || 0; // optional balloon / final lump (financing)
    const downPaymentPercent = this.config.defaultDownPaymentPercent;
    
    const downPaymentNow = isCash 
      ? price 
      : (params.downPayment !== undefined ? params.downPayment : Math.round(price * downPaymentPercent));

    const downPaymentAdjusted = isCash
      ? Math.round(price * 0.75) // 25% cheaper model
      : Math.round(price * 0.25); // 25% down payment

    const adjustedInstallment = isCash
      ? 0
      : Math.round(installment * 0.70); // ~30% reduction

    // 1. Core metrics calculations for Proceed Today (Now)
    const dtiNow = calculateDTI(context.monthlyIncome, context.existingFinancingPayments, installment);
    // Deduct upfront cost from savings immediately if cash purchase (allow negative to indicate deficit)
    const savingsNow = isCash ? context.currentSavings - price : context.currentSavings;
    const emergencyMonthsNow = calculateEmergencyFundMonths(savingsNow, context.monthlyFixedExpenses, installment);
    const savingsImpactNow = isCash ? 0 : calculateSavingsReduction(installment, context.monthlyIncome, context.monthlyTotalExpenses, context.existingFinancingPayments);
    const currentSurplus = context.monthlyIncome - context.monthlyTotalExpenses - context.existingFinancingPayments;
    const newSurplusNow = currentSurplus - installment;

    // Run sensitivity tests
    const sensitivityResults = runSensitivityAnalysis(context, installment);
    let failedShocksCount = 0;
    if (sensitivityResults.incomeShock.failed) failedShocksCount++;
    if (sensitivityResults.expenseShock.failed) failedShocksCount++;
    if (sensitivityResults.emergencyShock.failed) failedShocksCount++;

    // Scoring & Risk
    const { score, color, label } = calculateDecisionScore(
      dtiNow,
      emergencyMonthsNow,
      savingsImpactNow,
      newSurplusNow,
      failedShocksCount
    );

    const riskLevel = determineRiskLevel(dtiNow, emergencyMonthsNow, savingsImpactNow, newSurplusNow);

    // 2. Generate Scenarios
    const totalFinancingPaidNow = downPaymentNow + (installment * tenure) + finalPayment;
    const financingCostNow = Math.max(0, totalFinancingPaidNow - price);

    const totalFinancingPaidAdjusted = downPaymentAdjusted + (adjustedInstallment * tenure) + finalPayment;
    const financingCostAdjusted = Math.max(0, totalFinancingPaidAdjusted - price);

    const verdictNow = isCash
      ? (this.isRtl
          ? `شراء نقدي فوري بمبلغ ${price.toLocaleString()} ريال، يقلص المدخرات مباشرة.`
          : `One-time cash purchase of ${price.toLocaleString()} SAR, immediately reduces savings.`)
      : (this.isRtl
          ? `تكلفة تمويل إجمالية تبلغ ${financingCostNow.toLocaleString()} ريال. ${riskLevel === "High Risk" ? "مخاطرة مرتفعة على التدفقات النقدية." : "التزام شهري مباشر."}`
          : `Total financing cost of ${financingCostNow.toLocaleString()} SAR. ${riskLevel === "High Risk" ? "High risk on cash flow." : "Direct monthly commitment."}`);

    const verdictAdjusted = isCash
      ? (this.isRtl
          ? `بديل اقتصادي بقيمة ${downPaymentAdjusted.toLocaleString()} ريال (توفير 25%)، يقلل السحب من المدخرات.`
          : `Cheaper alternative at ${downPaymentAdjusted.toLocaleString()} SAR (25% saved), preserves more savings.`)
      : (this.isRtl
          ? `يخفض القسط بنسبة 30% إلى ${adjustedInstallment.toLocaleString()} ريال، مما يوفر أماناً مالياً أكبر.`
          : `Reduces installment by 30% to ${adjustedInstallment.toLocaleString()} SAR, providing higher cash flow safety.`);

    const verdictWait = isCash
      ? (this.isRtl
          ? `تأجيل الشراء 6 أشهر وتجميع وفورات إضافية بقيمة ${(currentSurplus * 6).toLocaleString()} ريال.`
          : `Delaying purchase for 6 months allows building ${(currentSurplus * 6).toLocaleString()} SAR in savings.`)
      : (this.isRtl
          ? `يسمح بمراكمة وفورات إضافية بقيمة ${(currentSurplus * 6).toLocaleString()} ريال قبل الالتزام بالقسط.`
          : `Allows building additional savings of ${(currentSurplus * 6).toLocaleString()} SAR prior to starting installments.`);

    const projectionMonths = isCash ? 6 : tenure;
    // A final/balloon payment lands at the end of the term, reducing every end balance.
    const endBalanceNow = context.currentSavings - downPaymentNow + (projectionMonths * (currentSurplus - installment)) - finalPayment;
    const endBalanceAdjusted = context.currentSavings - downPaymentAdjusted + (projectionMonths * (currentSurplus - adjustedInstallment)) - finalPayment;
    const endBalanceWait = context.currentSavings + (6 * currentSurplus) - downPaymentNow + ((projectionMonths - 6) * (currentSurplus - installment)) - finalPayment;

    const scenarios: Scenario[] = [
      {
        name: this.isRtl ? "البدء فوراً" : "Proceed Today",
        monthly_impact: -installment,
        balance_in_period: Math.round(endBalanceNow),
        verdict: verdictNow
      },
      {
        name: isCash 
          ? (this.isRtl ? "بديل اقتصادي" : "Cheaper Alternative")
          : (this.isRtl ? "زيادة الدفعة الأولى" : "Increase Down Payment"),
        monthly_impact: -adjustedInstallment,
        balance_in_period: Math.round(endBalanceAdjusted),
        verdict: verdictAdjusted
      },
      {
        name: this.isRtl ? "تأجيل الشراء" : "Delay Purchase",
        monthly_impact: 0, // 0 for the first 6 months
        balance_in_period: Math.round(endBalanceWait),
        verdict: verdictWait
      }
    ];

    // 3. Compile Programmatic Smart Insights
    const insights: SmartInsight[] = [];
    const savingsReductionPct = Math.round(savingsImpactNow * 100);

    if (isCash) {
      if (this.isRtl) {
        insights.push({ text: `هذا الشراء يستقطع ${price.toLocaleString()} ريال مباشرة من رصيد مدخراتك الجارية.` });
        insights.push({ text: `اختيار بديل اقتصادي يوفر لك ${(price - downPaymentAdjusted).toLocaleString()} ريال فوراً في حسابك.` });
      } else {
        insights.push({ text: `This purchase immediately deducts ${price.toLocaleString()} SAR from your savings.` });
        insights.push({ text: `Opting for a cheaper alternative saves you ${(price - downPaymentAdjusted).toLocaleString()} SAR today.` });
      }
    } else {
      if (this.isRtl) {
        insights.push({ text: `هذا الشراء يُقلّل من وفرك المالي الشهري المتاح للادخار بنسبة ${savingsReductionPct}%.` });
        const interestSaved = Math.max(0, financingCostNow - financingCostAdjusted);
        if (interestSaved > 0) {
          insights.push({ text: `زيادة الدفعة الأولى إلى 25% تُوفّر عليك ${interestSaved.toLocaleString()} ريال من تكلفة التمويل.` });
        }
      } else {
        insights.push({ text: `This purchase reduces your monthly savings capacity by ${savingsReductionPct}%.` });
        const interestSaved = Math.max(0, financingCostNow - financingCostAdjusted);
        if (interestSaved > 0) {
          insights.push({ text: `Increasing the down payment to 25% saves you ${interestSaved.toLocaleString()} SAR in financing costs.` });
        }
      }
    }

    // 4. "Why?" diagnostic points
    const reasons: string[] = [];
    if (isCash) {
      if (price > context.currentSavings) {
        reasons.push(this.isRtl
          ? `رصيد مدخراتك الحالي (${context.currentSavings.toLocaleString()} ريال) غير كافٍ لتغطية التكلفة الإجمالية للشراء نقداً.`
          : `Your savings buffer (${context.currentSavings.toLocaleString()} SAR) is insufficient to cover the total cash cost.`);
      } else {
        reasons.push(this.isRtl 
          ? "الشراء النقدي يوفر عليك تكاليف الفوائد والتمويل الإضافية تماماً." 
          : "Paying in cash completely avoids any interest charges or financing costs.");
      }
    } else {
      const dtiPercent = Math.round(dtiNow * 100);
      if (dtiNow <= 0.33) {
        reasons.push(this.isRtl 
          ? `نسبة الالتزامات الشهرية (${dtiPercent}%) متوافقة مع ضوابط البنك المركزي السعودي (ساما) - أقل من 33% من الدخل.` 
          : `Monthly debt obligations (${dtiPercent}%) are fully SAMA compliant — below 33% of income.`);
      } else {
        reasons.push(this.isRtl 
          ? `نسبة الالتزامات الشهرية مرتفعة وتصل إلى ${dtiPercent}% من الدخل، مما يتجاوز حد ساما الموصى به (33%).` 
          : `Monthly debt obligations are elevated at ${dtiPercent}%, exceeding SAMA's regulatory limit of 33%.`);
      }
    }

    if (!isCash) {
      if (savingsImpactNow <= 0.30) {
        reasons.push(this.isRtl 
          ? "تأثير القسط على الفائض المالي منخفض ويسمح باستمرارية الادخار الجيد." 
          : "The installment has a low impact on your monthly cash surplus, allowing continued savings.");
      } else {
        reasons.push(this.isRtl 
          ? `القسط المقترح يستنزف نسبة كبيرة (${savingsReductionPct}%) من وفوراتك الجارية.` 
          : `The proposed installment consumes a significant percentage (${savingsReductionPct}%) of your monthly surplus.`);
      }
    }

    if (failedShocksCount === 0) {
      reasons.push(this.isRtl 
        ? "تُظهر الميزانية مرونة ممتازة ومقاومة كاملة لتقلبات الدخل والمصاريف." 
        : "Your budget shows excellent resilience, successfully absorbing income and expense shocks.");
    } else {
      reasons.push(this.isRtl 
        ? `الميزانية حساسة ومكشوفة للمخاطر في ${failedShocksCount} من اختبارات الحساسية الطارئة.` 
        : `Budget is highly sensitive and failed ${failedShocksCount} of the emergency stress-test shocks.`);
    }

    // 5. Warnings
    const warnings: string[] = [];
    if (isCash && price > context.currentSavings) {
      warnings.push(this.isRtl
        ? `رصيدك الجاري لا يغطي قيمة الشراء كاش (تحتاج إلى ${(price - context.currentSavings).toLocaleString()} ريال إضافية لإتمام العملية).`
        : `Your current balance is insufficient for this cash purchase (you need an additional ${(price - context.currentSavings).toLocaleString()} SAR to proceed).`);
    }
    if (dtiNow > 0.33 && !isCash) {
      warnings.push(this.isRtl 
        ? "مرفوض نظاماً من البنك المركزي السعودي (ساما) لتجاوز عبء الدين الشهري نسبة 33% من دخلك." 
        : "Rejected by SAMA regulations: Total monthly debt obligations exceed the 33% threshold.");
    }
    if (newSurplusNow < 0) {
      warnings.push(this.isRtl 
        ? "تنبيه حرج: القسط المقترح يتجاوز فائضك الشهري، مما يعني الدخول في عجز نقدي فوري بمجرد إتمام الشراء." 
        : "Critical: The proposed installment exceeds your monthly surplus, causing an immediate cash flow deficit.");
    }

    // 6. Sensitivity grid (Stress Tests)
    const sensitivity: SensitivityMetric[] = [
      {
        metric: this.isRtl ? "انخفاض الدخل بنسبة 15%" : "15% Income Decrease",
        value: this.isRtl 
          ? `${Math.round(sensitivityResults.incomeShock.surplus).toLocaleString()} ريال فائض` 
          : `${Math.round(sensitivityResults.incomeShock.surplus).toLocaleString()} SAR net`,
        impactText: sensitivityResults.incomeShock.failed 
          ? (this.isRtl ? "عجز مالي" : "Cash Flow Deficit") 
          : (this.isRtl ? "مستقر" : "Stable Buffer"),
        isCritical: sensitivityResults.incomeShock.failed
      },
      {
        metric: this.isRtl ? "زيادة المصاريف المعيشية بنسبة 10%" : "10% Expense Increase",
        value: this.isRtl 
          ? `${Math.round(sensitivityResults.expenseShock.surplus).toLocaleString()} ريال فائض` 
          : `${Math.round(sensitivityResults.expenseShock.surplus).toLocaleString()} SAR net`,
        impactText: sensitivityResults.expenseShock.failed 
          ? (this.isRtl ? "عجز مالي" : "Cash Flow Deficit") 
          : (this.isRtl ? "مستقر" : "Stable Buffer"),
        isCritical: sensitivityResults.expenseShock.failed
      }
    ];

    // 7. Metric rows for comparison table (Only includes dynamic rows: Price, Down Payment, Installment, Final Payment)
    const tableData: MetricRow[] = [];

    tableData.push({
      metric: this.isRtl ? "سعر السلعة الإجمالي" : "Total Price / Cost",
      scenarioNow: `${price.toLocaleString()} ${this.isRtl ? "ريال" : "SAR"}`,
      scenarioAdjusted: isCash
        ? `${Math.round(price * 0.75).toLocaleString()} ${this.isRtl ? "ريال" : "SAR"}`
        : `${price.toLocaleString()} ${this.isRtl ? "ريال" : "SAR"}`,
      scenarioWait: `${price.toLocaleString()} ${this.isRtl ? "ريال" : "SAR"}`
    });

    if (downPaymentNow > 0 || !isCash) {
      tableData.push({
        metric: this.isRtl ? "الدفعة الأولى" : "Down Payment",
        scenarioNow: `${downPaymentNow.toLocaleString()} ${this.isRtl ? "ريال" : "SAR"}`,
        scenarioAdjusted: isCash
          ? `${Math.round(price * 0.75).toLocaleString()} ${this.isRtl ? "ريال" : "SAR"}`
          : `${downPaymentAdjusted.toLocaleString()} ${this.isRtl ? "ريال" : "SAR"}`,
        scenarioWait: `${downPaymentNow.toLocaleString()} ${this.isRtl ? "ريال" : "SAR"}`
      });
    }

    if (installment > 0 || !isCash) {
      tableData.push({
        metric: this.isRtl ? "القسط الشهري" : "Monthly Installment",
        scenarioNow: `${installment.toLocaleString()} ${this.isRtl ? "ريال" : "SAR"}`,
        scenarioAdjusted: `${adjustedInstallment.toLocaleString()} ${this.isRtl ? "ريال" : "SAR"}`,
        scenarioWait: `${installment.toLocaleString()} ${this.isRtl ? "ريال" : "SAR"}`
      });
    }

    if (finalPayment > 0) {
      tableData.push({
        metric: this.isRtl ? "الدفعة الأخيرة" : "Final Payment",
        scenarioNow: `${finalPayment.toLocaleString()} ${this.isRtl ? "ريال" : "SAR"}`,
        scenarioAdjusted: `${finalPayment.toLocaleString()} ${this.isRtl ? "ريال" : "SAR"}`,
        scenarioWait: `${finalPayment.toLocaleString()} ${this.isRtl ? "ريال" : "SAR"}`
      });
    }
    // Timeline Points
    const timeline = this.generateTimeline(
      context,
      projectionMonths,
      installment,
      adjustedInstallment,
      downPaymentNow,
      downPaymentAdjusted,
      finalPayment
    );

    // Summary text
    let summary = "";
    if (this.isRtl) {
      summary = isCash
        ? `وفقاً لبياناتك المالية المتاحة، يُشير التحليل المالي إلى أن خيار الشراء نقداً فوراً يُمثّل درجة أمان مقدرة بـ ${score}/100 وبمعدل مخاطر (${riskLevel}). بناءً عليه، يتضح أن شراء بديل اقتصادي (توفير 25%) أو تأجيل الشراء لمدة 6 أشهر هو الخيار الأمثل لحماية خطتك الادخارية وتفادي السحب الكامل لمدخراتك.`
        : `وفقاً لبياناتك المالية المتاحة، يُشير التحليل المالي إلى أن خيار الشراء فوراً يُمثّل درجة أمان مقدرة بـ ${score}/100 وبمعدل مخاطر (${riskLevel}). بناءً عليه، يتضح من تحليل سلوكك الإنفاقي أن اعتماد سيناريو تأجيل الشراء لمدة 6 أشهر أو رفع الدفعة الأولى لـ 25% يظل الخيار الأمثل لحماية خطتك الادخارية وتجنب الضغوط المعيشية الجارية.`;
    } else {
      summary = isCash
        ? `Based on your available financial data, the simulation estimates the safety of this cash purchase at ${score}/100 with a risk rating of ${riskLevel}. Financial analysis indicates that choosing a cheaper alternative (saving 25%) or postponing the purchase for 6 months is recommended to avoid depleting your savings buffer.`
        : `Based on your available financial data, the simulation estimates the safety of this decision at ${score}/100 with a risk rating of ${riskLevel}. Financial analysis indicates that postponing this purchase for 6 months or increasing the down payment to 25% is recommended to preserve your cash buffer and secure your savings plan.`;
    }

    return {
      type: "simulation",
      decision: params.decisionName 
        ? (this.isRtl ? `${params.decisionName} بقيمة ${price.toLocaleString()} ريال` : `${params.decisionName} worth ${price.toLocaleString()} SAR`)
        : (this.isRtl ? `${this.config.nameAr} بقيمة ${price.toLocaleString()} ريال` : `${this.config.nameEn} worth ${price.toLocaleString()} SAR`),
      score: {
        score,
        color,
        label: this.isRtl 
          ? (color === "green" ? "موصى به" : "غير موصى به") 
          : label,
        reasons
      },
      riskLevel,
      scenarios,
      insights,
      timeline,
      tableData,
      sensitivity,
      warnings,
      summary,
      projectionMonths
    };
  }
}
