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
    
    const finalPayment = params.finalPayment || 0; // optional balloon / final lump (financing)
    const downPaymentPercent = this.config.defaultDownPaymentPercent;
    const downPaymentNow = params.downPayment !== undefined ? params.downPayment : Math.round(price * downPaymentPercent);
    const downPaymentAdjusted = Math.round(price * 0.25); // 25% down payment for adjusted scenario

    const adjustedInstallment = Math.round(installment * 0.70); // ~30% reduction

    // 1. Core metrics calculations for Proceed Today (Now)
    const dtiNow = calculateDTI(context.monthlyIncome, context.existingFinancingPayments, installment);
    const emergencyMonthsNow = calculateEmergencyFundMonths(context.currentSavings, context.monthlyFixedExpenses, installment);
    const savingsImpactNow = calculateSavingsReduction(installment, context.monthlyIncome, context.monthlyFixedExpenses, context.existingFinancingPayments);
    const currentSurplus = context.monthlyIncome - context.monthlyFixedExpenses - context.existingFinancingPayments;
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

    const verdictNow = this.isRtl
      ? `تكلفة تمويل إجمالية تبلغ ${financingCostNow.toLocaleString()} ريال. ${riskLevel === "High Risk" ? "مخاطرة مرتفعة على التدفقات النقدية." : "التزام شهري مباشر."}`
      : `Total financing cost of ${financingCostNow.toLocaleString()} SAR. ${riskLevel === "High Risk" ? "High risk on cash flow." : "Direct monthly commitment."}`;

    const verdictAdjusted = this.isRtl
      ? `يخفض القسط بنسبة 30% إلى ${adjustedInstallment.toLocaleString()} ريال، مما يوفر أماناً مالياً أكبر.`
      : `Reduces installment by 30% to ${adjustedInstallment.toLocaleString()} SAR, providing higher cash flow safety.`;

    const verdictWait = this.isRtl
      ? `يسمح بمراكمة وفورات إضافية بقيمة ${(currentSurplus * 6).toLocaleString()} ريال قبل الالتزام بالقسط.`
      : `Allows building additional savings of ${(currentSurplus * 6).toLocaleString()} SAR prior to starting installments.`;

    const projectionMonths = params.projectionMonths || params.tenure || this.config.projectionMonths;
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
        name: this.isRtl ? "زيادة الدفعة الأولى" : "Increase Down Payment",
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
    const emergencyFundMonthsRounded = Math.round(emergencyMonthsNow * 10) / 10;

    if (this.isRtl) {
      insights.push({ text: `هذا الشراء يُقلّل من وفرك المالي الشهري المتاح للادخار بنسبة ${savingsReductionPct}%.` });
      if (financingCostNow > 0) {
        insights.push({ text: `ستتحمل تكاليف تمويل إضافية (أرباح/فوائد) تراكمية تبلغ ${financingCostNow.toLocaleString()} ريال.` });
      }
      insights.push({ text: `رصيد الطوارئ الحالي سيكفي لتغطية مصاريفك لمدة ${emergencyFundMonthsRounded} أشهر فقط بعد دفع القسط.` });
      
      const interestSaved = Math.max(0, financingCostNow - financingCostAdjusted);
      if (interestSaved > 0) {
        insights.push({ text: `زيادة الدفعة الأولى إلى 25% تُوفّر عليك ${interestSaved.toLocaleString()} ريال من تكلفة التمويل.` });
      }
    } else {
      insights.push({ text: `This purchase reduces your monthly savings capacity by ${savingsReductionPct}%.` });
      if (financingCostNow > 0) {
        insights.push({ text: `You will pay a total of ${financingCostNow.toLocaleString()} SAR in financing costs over the term.` });
      }
      insights.push({ text: `Your emergency fund will cover only ${emergencyFundMonthsRounded} months of total commitments.` });
      
      const interestSaved = Math.max(0, financingCostNow - financingCostAdjusted);
      if (interestSaved > 0) {
        insights.push({ text: `Increasing the down payment to 25% saves you ${interestSaved.toLocaleString()} SAR in financing costs.` });
      }
    }

    // 4. "Why?" diagnostic points
    const reasons: string[] = [];
    if (dtiNow <= 0.33) {
      reasons.push(this.isRtl 
        ? "نسبة الالتزام الشهري آمنة وتقل عن 33% من إجمالي دخلك." 
        : "Monthly debt obligation ratio is safe and under 33% of your income.");
    } else {
      reasons.push(this.isRtl 
        ? `نسبة الالتزام الشهري مرتفعة وتصل إلى ${Math.round(dtiNow * 100)}% مما يتجاوز الحدود الصحية.` 
        : `Monthly debt obligation ratio is elevated at ${Math.round(dtiNow * 100)}%, exceeding healthy bounds.`);
    }

    if (emergencyMonthsNow >= 4.0) {
      reasons.push(this.isRtl 
        ? `رصيد الطوارئ كافٍ ويغطي مصاريفك لمدة ${emergencyFundMonthsRounded} أشهر.` 
        : `Emergency reserves are healthy, covering ${emergencyFundMonthsRounded} months of expenses.`);
    } else if (emergencyMonthsNow >= 2.0) {
      reasons.push(this.isRtl 
        ? `رصيد الطوارئ ضعيف نسبياً ويغطي مصاريفك لمدة ${emergencyFundMonthsRounded} أشهر فقط.` 
        : `Emergency reserves are thin, covering only ${emergencyFundMonthsRounded} months of expenses.`);
    } else {
      reasons.push(this.isRtl 
        ? `رصيد الطوارئ حرج جداً ولا يغطي سوى ${emergencyFundMonthsRounded} أشهر من التزاماتك.` 
        : `Emergency reserves are critical, covering only ${emergencyFundMonthsRounded} months.`);
    }

    if (savingsImpactNow <= 0.30) {
      reasons.push(this.isRtl 
        ? "تأثير القسط على الفائض المالي منخفض ويسمح باستمرارية الادخار الجيد." 
        : "The installment has a low impact on your monthly cash surplus, allowing continued savings.");
    } else {
      reasons.push(this.isRtl 
        ? `القسط المقترح يستنزف نسبة كبيرة (${savingsReductionPct}%) من وفوراتك الجارية.` 
        : `The proposed installment consumes a significant percentage (${savingsReductionPct}%) of your monthly surplus.`);
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
    if (dtiNow > 0.45) {
      warnings.push(this.isRtl 
        ? "تنبيه: نسبة عبء الدين (DTI) تتجاوز النسبة التنظيمية الموصى بها في مصرف الإنماء." 
        : "Warning: Debt-to-Income (DTI) exceeds Alinma Bank's regulatory guidance limits.");
    }
    if (emergencyMonthsNow < 2.0) {
      warnings.push(this.isRtl 
        ? "تحذير: رصيد الطوارئ المتبقي منخفض جداً وقد يضعك في منطقة العجز المالي في حال حدوث طوارئ مفاجئة." 
        : "Caution: Leftover emergency fund is highly depleted. Any unexpected expense may trigger a deficit.");
    }
    if (newSurplusNow < 0) {
      warnings.push(this.isRtl 
        ? "تنبيه حرج: القسط المقترح يتجاوز فائضك الشهري، مما يعني الدخول في عجز نقدي فوري بمجرد إتمام الشراء." 
        : "Critical: The proposed installment exceeds your monthly surplus, causing an immediate cash flow deficit.");
    }

    // 6. Sensitivity grid
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
      },
      {
        metric: this.isRtl ? "مصروف طارئ بقيمة 5,000 ريال" : "5,000 SAR Emergency Expense",
        value: this.isRtl 
          ? `يغطي ${Math.round(sensitivityResults.emergencyShock.months * 10) / 10} أشهر` 
          : `Covers ${Math.round(sensitivityResults.emergencyShock.months * 10) / 10} months`,
        impactText: sensitivityResults.emergencyShock.failed 
          ? (this.isRtl ? "رصيد طوارئ حرج" : "Critical Buffer") 
          : (this.isRtl ? "مقبول" : "Acceptable"),
        isCritical: sensitivityResults.emergencyShock.failed
      }
    ];

    // 7. Metric rows for comparison table
    const tableData: MetricRow[] = [
      {
        metric: this.isRtl ? "الدفعة الأولى المطلوبة" : "Required Down Payment",
        scenarioNow: `${downPaymentNow.toLocaleString()} ${this.isRtl ? "ريال" : "SAR"}`,
        scenarioAdjusted: `${downPaymentAdjusted.toLocaleString()} ${this.isRtl ? "ريال" : "SAR"}`,
        scenarioWait: `${downPaymentNow.toLocaleString()} ${this.isRtl ? "ريال" : "SAR"}`
      },
      {
        metric: this.isRtl ? "القسط الشهري" : "Monthly Installment",
        scenarioNow: `${installment.toLocaleString()} ${this.isRtl ? "ريال" : "SAR"}`,
        scenarioAdjusted: `${adjustedInstallment.toLocaleString()} ${this.isRtl ? "ريال" : "SAR"}`,
        scenarioWait: `${installment.toLocaleString()} ${this.isRtl ? "ريال" : "SAR"}`
      },
      {
        metric: this.isRtl ? "أشهر تغطية الطوارئ" : "Emergency Coverage (Months)",
        scenarioNow: `${emergencyFundMonthsRounded}`,
        scenarioAdjusted: `${(Math.round(calculateEmergencyFundMonths(context.currentSavings, context.monthlyFixedExpenses, adjustedInstallment) * 10) / 10)}`,
        scenarioWait: `${(Math.round(calculateEmergencyFundMonths(context.currentSavings + (6 * currentSurplus), context.monthlyFixedExpenses, installment) * 10) / 10)}`
      },
      {
        metric: this.isRtl ? "تكلفة التمويل الإضافية" : "Financing Cost",
        scenarioNow: `${financingCostNow.toLocaleString()} ${this.isRtl ? "ريال" : "SAR"}`,
        scenarioAdjusted: `${financingCostAdjusted.toLocaleString()} ${this.isRtl ? "ريال" : "SAR"}`,
        scenarioWait: `${financingCostNow.toLocaleString()} ${this.isRtl ? "ريال" : "SAR"} (تأجيل)`
      }
    ];

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
      summary = `وفقاً لبياناتك المالية المتاحة، يُشير التحليل المالي إلى أن خيار الشراء فوراً يُمثّل درجة أمان مقدرة بـ ${score}/100 وبمعدل مخاطر (${riskLevel}). بناءً عليه، يتضح من تحليل سلوكك الإنفاقي أن اعتماد سيناريو تأجيل الشراء لمدة 6 أشهر أو رفع الدفعة الأولى لـ 25% يظل الخيار الأمثل لحماية خطتك الادخارية وتجنب الضغوط المعيشية الجارية.`;
    } else {
      summary = `Based on your available financial data, the simulation estimates the safety of this decision at ${score}/100 with a risk rating of ${riskLevel}. Financial analysis indicates that postponing this purchase for 6 months or increasing the down payment to 25% is recommended to preserve your cash buffer and secure your savings plan.`;
    }

    return {
      type: "simulation",
      decision: params.decisionName 
        ? (this.isRtl ? `${params.decisionName} بقيمة ${price.toLocaleString()} ريال` : `${params.decisionName} worth ${price.toLocaleString()} SAR`)
        : (this.isRtl ? `${this.config.nameAr} بقيمة ${price.toLocaleString()} ريال` : `${this.config.nameEn} worth ${price.toLocaleString()} SAR`),
      score: {
        score,
        color,
        label,
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
