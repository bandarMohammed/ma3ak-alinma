import { UserContext, SimulationResult, TimelinePoint } from "../types";

export abstract class BaseSimulator {
  constructor(public language: "ar" | "en") {}

  protected get isRtl(): boolean {
    return this.language === "ar";
  }

  abstract calculate(userContext: UserContext, params: any): SimulationResult;

  /**
   * The user's real monthly cash surplus: income minus TOTAL living outflow and
   * existing financing. One definition, used by the timeline AND the scenario
   * cards — previously the timeline used fixed expenses only, so the graph and
   * the cards disagreed about the same future.
   */
  protected monthlySurplus(userContext: UserContext): number {
    return userContext.monthlyIncome - userContext.monthlyTotalExpenses - userContext.existingFinancingPayments;
  }

  /**
   * Generates the account-balance projection for the three scenarios.
   *
   * All three lines are ACTUAL account balances (what the account would hold
   * that month) — no scenario gets fictional adjustments:
   *  - Proceed: pay down payment now (and receive the loan principal now, if any),
   *    then surplus minus installment each month.
   *  - Wait: accumulate plain surplus for `delayMonths`, then start the same
   *    commitment (down payment / principal at the delay month).
   *  - Adjusted: the cheaper variant from month 0.
   *
   * `principalNow` / `principalAdjusted` are CASH INFLOWS (e.g. a personal loan's
   * borrowed amount) credited when the commitment starts. Previously a cash loan
   * showed installments draining the balance without the borrowed money ever
   * arriving — the graph was wrong from month 0.
   *
   * A final/balloon payment lands at the END OF THE TERM: month `projectionMonths`
   * for Proceed/Adjusted; for Wait the term ends `delayMonths` later, outside the
   * window, so no balloon is deducted from the Wait line inside the window.
   */
  protected generateTimeline(
    userContext: UserContext,
    projectionMonths: number,
    installment: number,
    adjustedInstallment: number,
    downPaymentNow: number,
    downPaymentAdjusted: number,
    finalPayment: number = 0,
    principalNow: number = 0,
    principalAdjusted: number = 0,
    delayMonths: number = 6
  ): TimelinePoint[] {
    const timeline: TimelinePoint[] = [];
    const surplus = this.monthlySurplus(userContext);
    const startBalance = userContext.currentSavings;

    for (let month = 0; month <= projectionMonths; month++) {
      const balloon = month === projectionMonths ? finalPayment : 0;

      // 1. Proceed Today
      const balanceNow =
        startBalance + principalNow - downPaymentNow + month * (surplus - installment) - balloon;

      // 2. Delay by `delayMonths`
      let balanceWait: number;
      if (month < delayMonths) {
        balanceWait = startBalance + month * surplus;
      } else {
        balanceWait =
          startBalance + delayMonths * surplus + principalNow - downPaymentNow +
          (month - delayMonths) * (surplus - installment);
      }

      // 3. Adjusted (cheaper variant) from month 0
      const balanceAdjusted =
        startBalance + principalAdjusted - downPaymentAdjusted + month * (surplus - adjustedInstallment) - balloon;

      const monthName = this.isRtl ? `شهر ${month}` : `Month ${month}`;

      timeline.push({
        month,
        monthName,
        balanceNow: Math.round(balanceNow),
        balanceWait: Math.round(balanceWait),
        balanceAdjusted: Math.round(balanceAdjusted)
      });
    }

    return timeline;
  }
}
