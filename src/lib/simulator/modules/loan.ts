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

export class LoanSimulator extends BaseSimulator {
  calculate(context: UserContext, params: any): SimulationResult {
    const amount = params.amount || 50000;
    const tenure = params.tenure || 60; // 5 years
    const apr = 0.04; // 4.0% Alinma profit rate

    // Calculate installment: total simple profit = amount * APR * years
    const years = tenure / 12;
    const totalProfit = amount * apr * years;
    const totalPaid = amount + totalProfit;
    const installment = params.installment || Math.round(totalPaid / tenure);

    // Scenario Adjusted: Borrow 25% less (Downsize loan)
    const adjustedAmount = Math.round(amount * 0.75);
    const adjustedTotalProfit = adjustedAmount * apr * years;
    const adjustedTotalPaid = adjustedAmount + adjustedTotalProfit;
    const adjustedInstallment = Math.round(adjustedTotalPaid / tenure);

    // Core metrics calculations for Now
    const dtiNow = calculateDTI(context.monthlyIncome, context.existingFinancingPayments, installment);
    const emergencyMonthsNow = calculateEmergencyFundMonths(context.currentSavings, context.monthlyFixedExpenses, installment);
    const savingsImpactNow = calculateSavingsReduction(installment, context.monthlyIncome, context.monthlyTotalExpenses, context.existingFinancingPayments);
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

    // Scenarios Setup
    const verdictNow = this.isRtl
      ? `تمويل بقيمة ${amount.toLocaleString()} ريال بتكلفة تمويل (أرباح) تبلغ ${totalProfit.toLocaleString()} ريال.`
      : `Loan of ${amount.toLocaleString()} SAR with profit/borrowing cost of ${totalProfit.toLocaleString()} SAR.`;

    const verdictAdjusted = this.isRtl
      ? `اقتراض ${adjustedAmount.toLocaleString()} ريال يخفض القسط لـ ${adjustedInstallment.toLocaleString()} ريال ويوفر ${(totalProfit - adjustedTotalProfit).toLocaleString()} ريال أرباح.`
      : `Borrowing ${adjustedAmount.toLocaleString()} SAR reduces installment to ${adjustedInstallment.toLocaleString()} SAR, saving ${(totalProfit - adjustedTotalProfit).toLocaleString()} SAR in profit.`;

    const verdictWait = this.isRtl
      ? `تأجيل القرض 6 أشهر والاعتماد على الادخار الذاتي لتوفير ${(currentSurplus * 6).toLocaleString()} ريال.`
      : `Postponing the loan for 6 months and saving yields ${(currentSurplus * 6).toLocaleString()} SAR in self-funding.`;

    const projectionMonths = tenure; // Match timeline projection to loan tenure (typically 60 or 36)
    const endBalanceNow = context.currentSavings - 0 + (projectionMonths * (currentSurplus - installment)); // no downpayment for cash loan
    const endBalanceAdjusted = context.currentSavings - 0 + (projectionMonths * (currentSurplus - adjustedInstallment));
    const endBalanceWait = context.currentSavings + (6 * currentSurplus) - 0 + ((projectionMonths - 6) * (currentSurplus - installment));

    const scenarios: Scenario[] = [
      {
        name: this.isRtl ? "البدء فوراً" : "Proceed Today",
        monthly_impact: -installment,
        balance_in_period: Math.round(endBalanceNow),
        verdict: verdictNow
      },
      {
        name: this.isRtl ? "تقليص مبلغ القرض" : "Increase Down Payment", // Standardized name
        monthly_impact: -adjustedInstallment,
        balance_in_period: Math.round(endBalanceAdjusted),
        verdict: verdictAdjusted
      },
      {
        name: this.isRtl ? "تأجيل الاقتراض" : "Delay Purchase", // Standardized name
        monthly_impact: 0,
        balance_in_period: Math.round(endBalanceWait),
        verdict: verdictWait
      }
    ];



    // Compile Smart Insights
    const insights: SmartInsight[] = [];
    const savingsReductionPct = Math.round(savingsImpactNow * 100);

    if (this.isRtl) {
      insights.push({ text: `هذا الالتزام المالي يلتهم ${savingsReductionPct}% من فائضك النقدي القابل للادخار.` });
      const interestSaved = Math.max(0, totalProfit - adjustedTotalProfit);
      if (interestSaved > 0) {
        insights.push({ text: `تخفيض مبلغ التمويل بنسبة 25% يوفر عليك ${interestSaved.toLocaleString()} ريال من الأرباح.` });
      }
    } else {
      insights.push({ text: `This loan obligation consumes ${savingsReductionPct}% of your monthly saving capacity.` });
      const interestSaved = Math.max(0, totalProfit - adjustedTotalProfit);
      if (interestSaved > 0) {
        insights.push({ text: `Reducing the borrow amount by 25% saves you ${interestSaved.toLocaleString()} SAR in financing fees.` });
      }
    }

    // "Why?" Diagnostic bullet points
    const reasons: string[] = [];
    const dtiPercent = Math.round(dtiNow * 100);
    if (dtiNow <= 0.33) {
      reasons.push(this.isRtl 
        ? `نسبة الالتزام الشهري (${dtiPercent}%) متوافقة مع ضوابط البنك المركزي السعودي (ساما) - أقل من 33% من الدخل.` 
        : `Total debt obligations (${dtiPercent}%) stand below SAMA's 33% regulatory threshold.`);
    } else {
      reasons.push(this.isRtl 
        ? `نسبة الالتزام الشهري مرتفعة وتصل إلى ${dtiPercent}% من الدخل، مما يتجاوز حد ساما الموصى به (33%).` 
        : `Debt burden ratio (DTI) is elevated at ${dtiPercent}%, exceeding SAMA's regulatory limit of 33%.`);
    }

    if (savingsImpactNow <= 0.30) {
      reasons.push(this.isRtl 
        ? "القسط المقترح منخفض ولا يؤثر سلباً على قدرتك الادخارية الأساسية." 
        : "The proposed monthly payment is low and doesn't hinder your essential savings trend.");
    } else {
      reasons.push(this.isRtl 
        ? `القسط المقترح يستنزف نسبة عالية (${savingsReductionPct}%) من فائضك النقدي.` 
        : `The proposed monthly payment consumes a significant portion (${savingsReductionPct}%) of your cash surplus.`);
    }

    if (failedShocksCount === 0) {
      reasons.push(this.isRtl 
        ? "لديك مرونة ميزانية ممتازة ومقاومة كاملة لتقلبات الدخل والأزمات الطارئة." 
        : "Your budget shows excellent resilience, successfully absorbing income and expense shocks.");
    } else {
      reasons.push(this.isRtl 
        ? `تتعرض ميزانيتك لعجز نقدي في ${failedShocksCount} من اختبارات الحساسية الطارئة.` 
        : `Your budget falls into deficit under ${failedShocksCount} of the emergency stress-test shocks.`);
    }

    // Warnings
    const warnings: string[] = [];
    if (dtiNow > 0.33) {
      warnings.push(this.isRtl 
        ? "مرفوض نظاماً من البنك المركزي السعودي (ساما) لتجاوز عبء الدين الشهري نسبة 33% من دخلك." 
        : "Rejected by SAMA regulations: Total monthly debt obligations exceed the 33% threshold.");
    }
    if (newSurplusNow < 0) {
      warnings.push(this.isRtl 
        ? "تحذير: قسط القرض المقترح يتجاوز فائضك الجاري بالكامل مما يقودك لعجز نقدي فوري." 
        : "Critical: The monthly installment exceeds your surplus, causing immediate cash flow deficits.");
    }

    // Sensitivity grid
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

    // Metric rows for comparison (Loan amount, monthly installment only)
    const tableData: MetricRow[] = [];

    tableData.push({
      metric: this.isRtl ? "مبلغ القرض المقترح" : "Proposed Loan Amount",
      scenarioNow: `${amount.toLocaleString()} ${this.isRtl ? "ريال" : "SAR"}`,
      scenarioAdjusted: `${adjustedAmount.toLocaleString()} ${this.isRtl ? "ريال" : "SAR"}`,
      scenarioWait: `0 ${this.isRtl ? "ريال (تأجيل)" : "SAR (Delayed)"}`
    });

    tableData.push({
      metric: this.isRtl ? "القسط الشهري" : "Monthly Installment",
      scenarioNow: `${installment.toLocaleString()} ${this.isRtl ? "ريال" : "SAR"}`,
      scenarioAdjusted: `${adjustedInstallment.toLocaleString()} ${this.isRtl ? "ريال" : "SAR"}`,
      scenarioWait: `0 ${this.isRtl ? "ريال" : "SAR"}`
    });

    // Timeline Balance projection
    const timeline = this.generateTimeline(
      context,
      projectionMonths,
      installment,
      adjustedInstallment,
      0, // no down payment for cash loan
      0
    );

    // Summary
    let summary = "";
    if (this.isRtl) {
      summary = `يُشير التحليل المالي للتمويل الشخصي المقترح بقيمة ${amount.toLocaleString()} ريال إلى درجة أمان مالي تبلغ ${score}/100 وبمعدل مخاطر (${riskLevel}). تظهر المؤشرات أن تقليص مبلغ القرض بنسبة 25% أو تأجيل الالتزام لـ 6 أشهر يدعم خطتك الادخارية وتفادي مخاطر العجز المالي.`;
    } else {
      summary = `Based on your available data, financial analysis indicates a safety score of ${score}/100 with a risk rating of ${riskLevel} for the proposed loan of ${amount.toLocaleString()} SAR. Borrowing 25% less or delaying this loan for 6 months represents a significantly safer financial decision.`;
    }

    return {
      type: "simulation",
      decision: this.isRtl 
        ? `طلب تمويل شخصي بقيمة ${amount.toLocaleString()} ريال` 
        : `Personal Loan of ${amount.toLocaleString()} SAR`,
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
