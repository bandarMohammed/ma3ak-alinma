import { UserContext, SimulationResult, TimelinePoint } from "../types";

export abstract class BaseSimulator {
  constructor(public language: "ar" | "en") {}

  protected get isRtl(): boolean {
    return this.language === "ar";
  }

  abstract calculate(userContext: UserContext, params: any): SimulationResult;

  /**
   * Generates a realistic timeline balance projection
   */
  protected generateTimeline(
    userContext: UserContext,
    projectionMonths: number,
    installment: number,
    adjustedInstallment: number,
    downPaymentNow: number,
    downPaymentAdjusted: number,
    finalPayment: number = 0
  ): TimelinePoint[] {
    const timeline: TimelinePoint[] = [];
    const baseSavingsSurplus = userContext.monthlyIncome - userContext.monthlyFixedExpenses - userContext.existingFinancingPayments;
    const startBalance = userContext.currentSavings;

    for (let month = 0; month <= projectionMonths; month++) {
      // A final/balloon payment is deducted once, at the end of the term.
      const balloon = month === projectionMonths ? finalPayment : 0;
      // 1. Proceed Today (Now)
      // Month 0: deduct down payment
      // Month 1+: add surplus minus installment
      let balanceNow = startBalance - downPaymentNow;
      if (month > 0) {
        balanceNow += month * (baseSavingsSurplus - installment);
      }

      // 2. Delay Purchase (Wait)
      // Month 0 to 5: add base surplus
      // Month 6: deduct down payment
      // Month 7+: add surplus minus installment
      let balanceWait = startBalance;
      if (month < 6) {
        balanceWait += month * baseSavingsSurplus;
      } else {
        balanceWait += 6 * baseSavingsSurplus - downPaymentNow + (month - 6) * (baseSavingsSurplus - installment);
      }

      // 3. Increase Down Payment (Adjusted)
      // Month 0: deduct adjusted down payment
      // Month 1+: add surplus minus adjusted installment
      let balanceAdjusted = startBalance - downPaymentAdjusted;
      if (month > 0) {
        balanceAdjusted += month * (baseSavingsSurplus - adjustedInstallment);
      }

      const monthName = this.isRtl 
        ? `شهر ${month}` 
        : `Month ${month}`;

      timeline.push({
        month,
        monthName,
        balanceNow: Math.round(balanceNow - balloon),
        balanceWait: Math.round(balanceWait - balloon),
        balanceAdjusted: Math.round(balanceAdjusted - balloon)
      });
    }

    return timeline;
  }
}
