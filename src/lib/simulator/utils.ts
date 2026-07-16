import { UserContext, RiskLevel, ScoreColor } from "./types";

/**
 * Calculates Debt-to-Income (DTI) ratio
 */
export function calculateDTI(
  monthlyIncome: number,
  existingPayments: number,
  newPayment: number
): number {
  if (monthlyIncome <= 0) return 1;
  return (existingPayments + newPayment) / monthlyIncome;
}

/**
 * Calculates how many months the emergency fund (savings) covers
 */
export function calculateEmergencyFundMonths(
  currentSavings: number,
  fixedExpenses: number,
  newPayment: number
): number {
  const totalCommitments = fixedExpenses + newPayment;
  if (totalCommitments <= 0) return 999;
  return currentSavings / totalCommitments;
}

/**
 * Calculates the percentage reduction in monthly savings surplus
 */
export function calculateSavingsReduction(
  newPayment: number,
  monthlyIncome: number,
  fixedExpenses: number,
  existingPayments: number
): number {
  const currentSurplus = monthlyIncome - fixedExpenses - existingPayments;
  if (currentSurplus <= 0) return 1; // 100% reduction
  return Math.min(1, newPayment / currentSurplus);
}

/**
 * Run sensitivity shock tests on the user's cash flow
 */
export function runSensitivityAnalysis(
  context: UserContext,
  newPayment: number
) {
  // Shocks are applied to the REAL surplus (income − TOTAL living outflow −
  // existing financing). Using fixed expenses only ignored groceries, fuel,
  // food etc., overstating the surplus and making every stress test pass
  // too easily.
  const currentSurplus = context.monthlyIncome - context.monthlyTotalExpenses - context.existingFinancingPayments;
  const newSurplus = currentSurplus - newPayment;

  // 1. Income drops 15%
  const shockedIncome = context.monthlyIncome * 0.85;
  const shockedIncomeSurplus = shockedIncome - context.monthlyTotalExpenses - context.existingFinancingPayments - newPayment;
  const incomeShockFailed = shockedIncomeSurplus < 0;

  // 2. Expenses increase 10%
  const shockedExpenses = context.monthlyTotalExpenses * 1.10;
  const shockedExpensesSurplus = context.monthlyIncome - shockedExpenses - context.existingFinancingPayments - newPayment;
  const expenseShockFailed = shockedExpensesSurplus < 0;

  // 3. Emergency cost of 5,000 SAR
  const shockedSavings = Math.max(0, context.currentSavings - 5000);
  const shockedEmergencyMonths = calculateEmergencyFundMonths(
    shockedSavings,
    context.monthlyFixedExpenses,
    newPayment
  );
  const emergencyShockFailed = shockedEmergencyMonths < 2.0;

  return {
    incomeShock: {
      value: "15%",
      failed: incomeShockFailed,
      surplus: shockedIncomeSurplus
    },
    expenseShock: {
      value: "10%",
      failed: expenseShockFailed,
      surplus: shockedExpensesSurplus
    },
    emergencyShock: {
      value: "5,000 SAR",
      failed: emergencyShockFailed,
      months: shockedEmergencyMonths
    }
  };
}

/**
 * Determines risk level based on DTI, emergency months, savings impact, and cashflow
 */
export function determineRiskLevel(
  dti: number,
  emergencyMonths: number,
  savingsImpact: number,
  newSurplus: number
): RiskLevel {
  const exceedsSama = dti > 0.33;
  if (exceedsSama || emergencyMonths < 1.0 || savingsImpact > 0.80 || newSurplus < 0) {
    return "High Risk";
  }
  if (dti > 0.25 || emergencyMonths < 2.0 || savingsImpact > 0.40) {
    return "Medium Risk";
  }
  return "Low Risk";
}

/**
 * Programmatically calculates a financial decision score from 0-100
 */
export function calculateDecisionScore(
  dti: number,
  emergencyMonths: number,
  savingsImpact: number,
  newSurplus: number,
  shocksFailedCount: number
): { score: number; color: ScoreColor; label: string } {
  let score = 100;

  // 1. DTI Deductions (max 30 pts)
  if (dti > 0.33) {
    const excessDti = dti - 0.33;
    score -= Math.min(30, excessDti * 120); // Scale deduction
  }

  // 2. Savings Impact / Cashflow Deductions (max 40 pts)
  if (newSurplus < 0) {
    score -= 40; // Deficit cashflow
  } else if (savingsImpact > 0.30) {
    const excessImpact = savingsImpact - 0.30;
    score -= Math.min(25, excessImpact * 50);
  }

  // 3. Emergency Buffer Deductions (max 20 pts)
  if (emergencyMonths < 3.0) {
    const gap = 3.0 - emergencyMonths;
    score -= Math.min(20, gap * 10);
  }

  // 4. Sensitivity failure deductions (max 10 pts)
  score -= shocksFailedCount * 3.3;

  score = Math.max(0, Math.min(100, Math.round(score)));

  // If total debt obligations exceed 33% SAMA limit, or if savings go negative, it is a hard red.
  const exceedsSama = dti > 0.33;
  const isInsufficientSavings = emergencyMonths < 0;
  
  if (exceedsSama || isInsufficientSavings) {
    score = Math.min(score, 45); // SAMA rejection or insufficient funds
  }

  let color: ScoreColor = "red";
  let label = "Not Recommended";

  if (score >= 60 && !exceedsSama && !isInsufficientSavings) {
    color = "green";
    label = "Recommended";
  } else {
    color = "red";
    label = "Not Recommended";
  }

  return { score, color, label };
}

